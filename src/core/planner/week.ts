import type { Block, LifeMode, ModuleRow, Rhythm, RhythmLog, Task, WorkItem } from "@/core/types";
import { isBlocked } from "@/core/today/select";
import { dayKey, istanbulInstant, shiftDay, weekStart } from "@/lib/date";
import { nextSessionMinutes } from "@/core/contract/envelope";
import { readTiming, type Timing } from "@/core/contract/timing";
import { moduleWeight, rhythmState, rhythmTarget, shareWorked, weeklyFloor } from "./candidates";
import { busyRanges, dayCapacity, freeRanges } from "./slots";
import { allowedOn } from "./timing";
import type { PlannerSettings, PlannerStat, WeekShare } from "./types";

// The far horizons (docs/04-planlayici.md, "Plan ufukları"): week by week demand and capacity,
// and the week's commitment with its items cut into sittings.

const DAY = 86_400_000;
const SITTING_MAX = 90;
const SITTING_MIN = 15;
const SITTING_DEFAULT = 45;

export type WeekRange = { from: string; weeks: number };

export type WeekLoad = {
  weekStart: string;
  capacityMinutes: number;
  demandMinutes: number;
  /** Demand per module id: dated items, rhythms and floors. */
  byModule: Record<string, number>;
  /** Items and tasks due in the week, heaviest first. */
  deadlines: { id: string; title: string; dueAt: string; weight: number }[];
  over: boolean;
};

export type LoadInput = {
  now: Date;
  items: WorkItem[];
  tasks: Task[];
  rhythms: Rhythm[];
  modules: ModuleRow[];
  blocks: Block[];
  settings: PlannerSettings;
  stats: PlannerStat[];
  lifeMode: LifeMode | ((weekStart: string) => LifeMode);
};

const modeOf = (input: LoadInput, week: string) =>
  typeof input.lifeMode === "function" ? input.lifeMode(week) : input.lifeMode;

/** Capacity of a week from the given moment on: past days of it count for nothing. */
export function weekCapacity(
  week: string,
  now: Date,
  blocks: Block[],
  settings: PlannerSettings,
  stats: PlannerStat[],
  /** Only up to this moment (a deadline inside the week). */
  until?: Date,
): number {
  const today = dayKey(now);
  const last = until ? dayKey(until) : null;
  let total = 0;
  for (let index = 0; index < 7; index++) {
    const day = shiftDay(week, index);
    if (day < today || (last !== null && day > last)) continue;
    total += dayCapacity(day, blocks, settings, stats, {
      ...(day === today ? { from: now } : {}),
      ...(day === last ? { until } : {}),
    });
  }
  return Math.round(total);
}

/** Effort an item still needs. An item without an estimate counts as one sitting. */
export function remainingEffort(item: WorkItem): number {
  if (item.effort_total_minutes === null) return item.session_minutes ?? SITTING_DEFAULT;
  return Math.max(0, item.effort_total_minutes - item.effort_done_minutes);
}

/** Items that take part in planning: active, not a container of open pieces. */
export function plannableItems(items: WorkItem[], activeModules: Set<string>): WorkItem[] {
  const containers = new Set(
    items
      .filter((item) => item.status === "active" || item.status === "waiting")
      .map((item) => item.parent_id),
  );
  return items.filter(
    (item) =>
      item.status === "active" && activeModules.has(item.module_id) && !containers.has(item.id),
  );
}

/**
 * How an item's remaining effort spreads over the weeks: between its earliest start (or now)
 * and its deadline, in proportion to each week's capacity. Weeks outside the range get
 * nothing. An item without a deadline is not spread (it has no week of its own).
 */
export function spreadItem(
  item: WorkItem,
  weeks: string[],
  /** A week's capacity; with `until`, only up to that moment (the deadline's week). */
  capacityOf: (week: string, until?: Date) => number,
  now: Date,
): Map<string, number> {
  const share = new Map<string, number>();
  if (item.due_at === null) return share;
  const left = remainingEffort(item);
  if (left <= 0) return share;
  const start = Math.max(now.getTime(), item.earliest_at ? Date.parse(item.earliest_at) : 0);
  const firstWeek = weekStart(dayKey(new Date(start)));
  const lastWeek = weekStart(dayKey(new Date(Math.max(start, Date.parse(item.due_at)))));
  const span = weeks.filter((week) => week >= firstWeek && week <= lastWeek);
  // A deadline that has passed, or lies beyond the range, still loads the weeks it reaches.
  const inRange = span.length > 0 ? span : weeks.filter((week) => week === lastWeek);
  if (inRange.length === 0) return share;
  // The deadline's week holds only the time before the deadline.
  const due = new Date(item.due_at);
  const capacities = inRange.map((week) =>
    Math.max(1, week === lastWeek ? capacityOf(week, due) : capacityOf(week)),
  );
  const total = capacities.reduce((sum, value) => sum + value, 0);
  // Weeks beyond the range would take their part too: the range only sees its own share.
  const beyond =
    lastWeek > weeks[weeks.length - 1]
      ? Math.round(
          (Date.parse(item.due_at) -
            istanbulInstant(shiftDay(weeks[weeks.length - 1], 7)).getTime()) /
            (7 * DAY),
        )
      : 0;
  const totalWeeks = inRange.length + Math.max(0, beyond);
  const rangePart = left * (inRange.length / totalWeeks);
  inRange.forEach((week, index) => share.set(week, (rangePart * capacities[index]) / total));
  return share;
}

/** Fixed demand of a module in a week: its rhythms, or its weekly floor if that is more. */
export function fixedDemand(
  input: LoadInput,
  mod: ModuleRow,
  week: string,
  daysInWeek: number,
): number {
  const mode = modeOf(input, week);
  let rhythms = 0;
  for (const rhythm of input.rhythms) {
    if (!rhythm.active || rhythm.module_id !== mod.id) continue;
    const target = rhythmTarget(rhythm, mode);
    const perWeek =
      rhythm.period === "day"
        ? target * daysInWeek
        : rhythm.period === "week"
          ? target * (daysInWeek / 7)
          : (target * daysInWeek) / 30;
    // Each doing brings its travel along (docs/04-planlayici.md, "Zaman kısıtları", rule 8).
    rhythms += perWeek * (rhythm.est_minutes + travelMinutes(readTiming(rhythm.timing)));
  }
  const floor = mod.kind === "lifelong" ? weeklyFloor(mod, mode) * (daysInWeek / 7) : 0;
  return Math.max(rhythms, floor);
}

/** Demand and capacity week by week (docs/04-planlayici.md, `loadByWeek`). */
export function loadByWeek(input: LoadInput, range: WeekRange): WeekLoad[] {
  const weeks = Array.from({ length: range.weeks }, (_, index) =>
    shiftDay(weekStart(range.from), 7 * index),
  );
  const today = dayKey(input.now);
  const capacity = new Map(
    weeks.map((week) => [
      week,
      weekCapacity(week, input.now, input.blocks, input.settings, input.stats),
    ]),
  );
  const active = new Set(
    input.modules.filter((mod) => mod.status === "active").map((mod) => mod.id),
  );
  const loads = new Map<string, WeekLoad>(
    weeks.map((week) => [
      week,
      {
        weekStart: week,
        capacityMinutes: capacity.get(week)!,
        demandMinutes: 0,
        byModule: {},
        deadlines: [],
        over: false,
      },
    ]),
  );
  const add = (week: string, moduleId: string, minutes: number) => {
    const load = loads.get(week);
    if (!load || minutes <= 0) return;
    load.byModule[moduleId] = (load.byModule[moduleId] ?? 0) + minutes;
    load.demandMinutes += minutes;
  };

  for (const item of plannableItems(input.items, active)) {
    const capacityOf = (w: string, until?: Date) =>
      until
        ? weekCapacity(w, input.now, input.blocks, input.settings, input.stats, until)
        : (capacity.get(w) ?? 0);
    // Each sitting of the share brings its travel along.
    const travel = travelMinutes(readTiming(item.timing));
    const sitting = Math.min(
      SITTING_MAX,
      Math.max(SITTING_MIN, item.session_minutes ?? SITTING_DEFAULT),
    );
    for (const [week, minutes] of spreadItem(item, weeks, capacityOf, input.now)) {
      add(week, item.module_id, minutes + (travel > 0 ? (minutes / sitting) * travel : 0));
    }
  }
  for (const mod of input.modules) {
    if (!active.has(mod.id)) continue;
    for (const week of weeks) {
      const days = weeks[0] === week ? 7 - Math.max(0, daysBetweenKeys(week, today)) : 7;
      add(week, mod.id, fixedDemand(input, mod, week, Math.max(0, days)));
    }
  }

  // Deadlines per week: dated items and standalone tasks.
  const weightOf = (moduleId: string, importance: number) => {
    const mod = input.modules.find((row) => row.id === moduleId);
    return (mod ? moduleWeight(mod, modeOf(input, weeks[0])) : 1) * importance;
  };
  const dated = [
    ...plannableItems(input.items, active).map((item) => ({
      id: item.id,
      title: item.title,
      dueAt: item.due_at,
      moduleId: item.module_id,
      importance: item.importance,
    })),
    ...input.tasks
      .filter(
        (task) =>
          task.work_item_id === null &&
          (task.status === "todo" || task.status === "doing") &&
          active.has(task.module_id),
      )
      .map((task) => ({
        id: task.id,
        title: task.title,
        dueAt: task.due_at,
        moduleId: task.module_id,
        importance: task.importance,
      })),
  ];
  for (const entry of dated) {
    if (entry.dueAt === null) continue;
    const load = loads.get(weekStart(dayKey(new Date(entry.dueAt))));
    load?.deadlines.push({
      id: entry.id,
      title: entry.title,
      dueAt: entry.dueAt,
      weight: weightOf(entry.moduleId, entry.importance),
    });
  }

  return weeks.map((week) => {
    const load = loads.get(week)!;
    load.demandMinutes = Math.round(load.demandMinutes);
    for (const key of Object.keys(load.byModule))
      load.byModule[key] = Math.round(load.byModule[key]);
    load.deadlines.sort((a, b) => b.weight - a.weight || Date.parse(a.dueAt) - Date.parse(b.dueAt));
    load.over = load.demandMinutes > load.capacityMinutes;
    return load;
  });
}

/** Travel before and after one doing of the work, in minutes. */
export function travelMinutes(timing: Timing | null): number {
  return (timing?.travel?.before ?? 0) + (timing?.travel?.after ?? 0);
}

export type NoTime = { id: string; title: string; moduleId: string };

/**
 * Work the week cannot hold for its windows (docs/04-planlayici.md, "Zaman kısıtları", rule 8):
 * a committed item, or one due this week, or a rhythm with a floor, whose windows in the rest
 * of the week leave no free stretch for one footprint (travel may lie outside the window, not
 * outside the free time). "Bu hafta uygun saat yok".
 */
export function weekNoTime(
  input: WeekInput & {
    committed: string[] | null;
    /** The committed items' shares: an item whose share is worked needs no more time. */
    shares?: Record<string, WeekShare>;
    /** Rhythm logs: a floor already met needs no more time. */
    rhythmLogs?: RhythmLog[];
  },
): NoTime[] {
  const week = weekStart(input.weekStart);
  const weekEnd = istanbulInstant(shiftDay(week, 7)).getTime();
  const mode = modeOf(input, week);
  const active = new Set(
    input.modules.filter((mod) => mod.status === "active").map((mod) => mod.id),
  );
  const committed = new Set(input.committed ?? []);
  const today = dayKey(input.now);
  const days: string[] = [];
  for (let index = 0; index < 7; index++) {
    const day = shiftDay(week, index);
    if (day >= today) days.push(day);
  }
  const busy = busyRanges(input.blocks);
  const free = new Map(
    days.map((day) => {
      const start = Math.max(
        input.now.getTime(),
        istanbulInstant(day, input.settings.dayStart).getTime(),
      );
      const end = istanbulInstant(day, input.settings.finishLine).getTime();
      return [day, end > start ? freeRanges({ start, end }, busy, 0) : []];
    }),
  );
  const holds = (timing: Timing, minutes: number) => {
    const before = (timing.travel?.before ?? 0) * 60_000;
    const after = (timing.travel?.after ?? 0) * 60_000;
    return days.some((day) =>
      (allowedOn(timing, day) ?? []).some((window) =>
        free.get(day)!.some((range) => {
          const workStart = Math.max(range.start + before, window.start);
          const workEnd = workStart + minutes * 60_000;
          return workEnd <= window.end && workEnd + after <= range.end;
        }),
      ),
    );
  };

  const found: NoTime[] = [];
  for (const item of plannableItems(input.items, active)) {
    const timing = readTiming(item.timing);
    if (!timing?.windows || remainingEffort(item) <= 0) continue;
    const due = item.due_at !== null && Date.parse(item.due_at) < weekEnd;
    if (!committed.has(item.id) && !due) continue;
    if (!due && shareWorked(input, item)) continue;
    if (!holds(timing, nextSessionMinutes(item))) {
      found.push({ id: item.id, title: item.title, moduleId: item.module_id });
    }
  }
  if (mode !== "holiday") {
    for (const rhythm of input.rhythms) {
      // A weekly floor that is still owed; a month's or a day's rhythm is not judged by a week.
      if (!rhythm.active || !active.has(rhythm.module_id) || rhythm.floor_count <= 0) continue;
      if (rhythm.period !== "week") continue;
      const timing = readTiming(rhythm.timing);
      if (!timing?.windows) continue;
      const state = rhythmState(rhythm, input.rhythmLogs ?? [], today, mode);
      if (state.done >= Math.min(rhythm.floor_count, state.target)) continue;
      if (!holds(timing, rhythm.est_minutes)) {
        found.push({ id: rhythm.id, title: rhythm.title, moduleId: rhythm.module_id });
      }
    }
  }
  return found;
}

function daysBetweenKeys(from: string, to: string): number {
  return Math.round(
    (istanbulInstant(to, "12:00").getTime() - istanbulInstant(from, "12:00").getTime()) / DAY,
  );
}

// --- The week's commitment ------------------------------------------------------------------

export type WeekAdvice = {
  /** Items to work on this week, in the AI's order. */
  committed?: string[];
  /** Items to leave out this week. */
  drop?: string[];
  /** Minutes per module slug. */
  moduleBudgets?: Record<string, number>;
  reasons?: Record<string, string>;
};

export type WeekInput = LoadInput & { weekStart: string };

export type CommittedItem = {
  itemId: string;
  /** This week's share of the item's effort. */
  minutes: number;
  /** Lengths of the sittings the share is cut into. */
  sittings: number[];
  /** Due this week: committed whatever the capacity. */
  required: boolean;
  /** The item's done effort when it was committed; the share counts from here. */
  from: number;
};

export type WeekPlan = {
  weekStart: string;
  committed: CommittedItem[];
  /** Minutes per module slug: committed shares plus rhythms and floors. */
  moduleBudgets: Record<string, number>;
  capacityMinutes: number;
  /**
   * Each day's whole capacity, from the day of the commitment to the end of the week. Lost
   * capacity is measured against it day by day, so time passing never counts as a loss.
   */
  capacityByDay: Record<string, number>;
  /** Items that did not fit this week. */
  left: string[];
  /** The life mode the commitment was made in (a change of mode re-commits). */
  lifeMode: LifeMode;
  source: "ai" | "auto";
  reasons: Record<string, string>;
};

/** A share of effort cut into sittings of the item's length (90 minutes at most). */
export function cutSittings(minutes: number, sessionMinutes: number | null): number[] {
  const length = Math.min(SITTING_MAX, Math.max(SITTING_MIN, sessionMinutes ?? SITTING_DEFAULT));
  if (minutes <= 0) return [];
  const count = Math.ceil(minutes / length);
  const sittings = Array.from({ length: count }, () => length);
  const last = minutes - length * (count - 1);
  sittings[count - 1] = Math.max(SITTING_MIN, Math.round(last / 5) * 5);
  return sittings;
}

/**
 * The week's commitment (docs/04-planlayici.md, `commitWeek`): which items are worked on this
 * week and how much of each, cut into sittings. Items due this week are always in. With the
 * AI's advice its order is followed and its drops honoured, within the engine's rules: no
 * item whose dependency is open, no drop of required work, capacity respected. Without
 * advice, urgency and importance choose until the capacity is used up.
 */
export function commitWeek(input: WeekInput, advice?: WeekAdvice): WeekPlan {
  const week = weekStart(input.weekStart);
  const weekEnd = istanbulInstant(shiftDay(week, 7)).getTime();
  const mode = modeOf(input, week);
  const loads = loadByWeek(input, { from: week, weeks: 8 });
  const [load] = loads;
  const active = new Set(
    input.modules.filter((mod) => mod.status === "active").map((mod) => mod.id),
  );
  const today = dayKey(input.now);
  const daysLeft = 7 - Math.max(0, daysBetweenKeys(week, today));
  let fixed = 0;
  const budgets: Record<string, number> = {};
  const fixedOf: Record<string, number> = {};
  for (const mod of input.modules) {
    if (!active.has(mod.id)) continue;
    const minutes = Math.round(fixedDemand(input, mod, week, Math.max(0, Math.min(7, daysLeft))));
    fixed += minutes;
    fixedOf[mod.slug] = minutes;
    if (minutes > 0) budgets[mod.slug] = minutes;
  }
  let free = load.capacityMinutes - fixed;

  const capacityOf = (w: string, until?: Date) =>
    until
      ? weekCapacity(w, input.now, input.blocks, input.settings, input.stats, until)
      : (loads.find((row) => row.weekStart === w)?.capacityMinutes ?? 0);
  const weeks = loads.map((row) => row.weekStart);
  const dropped = new Set(advice?.drop ?? []);
  const items = plannableItems(input.items, active).filter((item) => {
    if (isBlocked(item, input.items)) return false;
    if (item.earliest_at !== null && Date.parse(item.earliest_at) >= weekEnd) return false;
    return remainingEffort(item) > 0;
  });

  const shareOf = (item: WorkItem) => {
    const left = remainingEffort(item);
    if (item.due_at === null) return Math.min(left, item.session_minutes ?? SITTING_DEFAULT);
    if (Date.parse(item.due_at) < weekEnd) return left;
    return Math.min(
      left,
      Math.round(spreadItem(item, weeks, capacityOf, input.now).get(week) ?? 0),
    );
  };
  const required = (item: WorkItem) => item.due_at !== null && Date.parse(item.due_at) < weekEnd;

  const byUrgency = [...items].sort((a, b) => {
    if (required(a) !== required(b)) return required(a) ? -1 : 1;
    const due =
      (a.due_at ? Date.parse(a.due_at) : Infinity) - (b.due_at ? Date.parse(b.due_at) : Infinity);
    if (due !== 0 && Number.isFinite(due)) return due;
    if (a.due_at === null && b.due_at !== null) return 1;
    if (b.due_at === null && a.due_at !== null) return -1;
    return b.importance - a.importance || Date.parse(a.created_at) - Date.parse(b.created_at);
  });
  const order = advice?.committed
    ? [
        ...byUrgency.filter(required),
        ...advice.committed.flatMap((id) =>
          byUrgency.filter((item) => item.id === id && !required(item)),
        ),
      ]
    : byUrgency;

  const committed: CommittedItem[] = [];
  const left: string[] = [];
  const taken = new Set<string>();
  for (const item of order) {
    if (taken.has(item.id)) continue;
    const must = required(item);
    if (!must && dropped.has(item.id)) continue;
    const minutes = shareOf(item);
    if (minutes <= 0) continue;
    if (!must && minutes > free) {
      left.push(item.id);
      continue;
    }
    taken.add(item.id);
    free -= minutes;
    committed.push({
      from: item.effort_done_minutes,
      itemId: item.id,
      minutes,
      sittings: cutSittings(minutes, item.session_minutes),
      required: must,
    });
    const slug = input.modules.find((mod) => mod.id === item.module_id)?.slug;
    if (slug) budgets[slug] = (budgets[slug] ?? 0) + minutes;
  }
  for (const item of items) {
    if (
      !taken.has(item.id) &&
      !left.includes(item.id) &&
      !(dropped.has(item.id) && !required(item))
    ) {
      if (!advice?.committed || advice.committed.includes(item.id)) continue;
      left.push(item.id);
    }
  }

  // The AI's hours per module stand, as long as no module gets less than its rhythms and
  // floor need (the engine checks; docs/10-yapay-zeka.md, "İş bölümü").
  if (advice?.moduleBudgets) {
    for (const [slug, minutes] of Object.entries(advice.moduleBudgets)) {
      const mod = input.modules.find((row) => row.slug === slug && active.has(row.id));
      if (!mod || !Number.isFinite(minutes)) continue;
      budgets[slug] = Math.max(Math.round(minutes), fixedOf[slug] ?? 0);
    }
  }

  return {
    weekStart: week,
    committed,
    moduleBudgets: budgets,
    capacityMinutes: load.capacityMinutes,
    capacityByDay: dayCapacities(input, week),
    left,
    lifeMode: mode,
    source: advice ? "ai" : "auto",
    reasons: advice?.reasons ?? {},
  };
}

/** What the commitment means for the sittings: which to open and which open ones to drop. */
export type SittingChanges = {
  create: { itemId: string; minutes: number; position: number }[];
  drop: string[];
};

/**
 * The sittings a commitment needs, against the ones that exist. A sitting that is running or
 * waiting is never touched; open sittings of items that left the commitment are dropped.
 */
export function sittingChanges(plan: Pick<WeekPlan, "committed">, tasks: Task[]): SittingChanges {
  const changes: SittingChanges = { create: [], drop: [] };
  const committed = new Map(plan.committed.map((row) => [row.itemId, row]));
  const todoOf = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.work_item_id === null) continue;
    if (task.status === "todo") {
      todoOf.set(task.work_item_id, [...(todoOf.get(task.work_item_id) ?? []), task]);
    }
  }
  for (const [itemId, todos] of todoOf) {
    if (!committed.has(itemId)) changes.drop.push(...todos.map((task) => task.id));
  }
  for (const row of plan.committed) {
    const busy = tasks.filter(
      (task) =>
        task.work_item_id === row.itemId && (task.status === "doing" || task.status === "waiting"),
    ).length;
    const todos = (todoOf.get(row.itemId) ?? []).sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    );
    const wanted = Math.max(0, row.sittings.length - busy);
    for (const extra of todos.slice(wanted)) changes.drop.push(extra.id);
    // New sittings go after every sitting the item has had, so two never share a place.
    const last = Math.max(
      0,
      ...tasks.filter((task) => task.work_item_id === row.itemId).map((task) => task.position ?? 0),
    );
    row.sittings.slice(busy + todos.length).forEach((minutes, index) => {
      changes.create.push({ itemId: row.itemId, minutes, position: last + index + 1 });
    });
  }
  return changes;
}

export type StoredWeek = {
  committed: string[];
  capacityMinutes: number | null;
  /** `WeekPlan.capacityByDay` as it was stored; empty for a commitment without it. */
  capacityByDay: Record<string, number>;
  lifeMode: LifeMode | null;
};

/** The whole capacity of each day from today to the end of the week. */
export function dayCapacities(input: LoadInput, week: string): Record<string, number> {
  const today = dayKey(input.now);
  const days: Record<string, number> = {};
  for (let index = 0; index < 7; index++) {
    const day = shiftDay(week, index);
    if (day < today) continue;
    days[day] = Math.round(dayCapacity(day, input.blocks, input.settings, input.stats));
  }
  return days;
}

export type RecommitReason = "new_required" | "capacity_lost" | "mode_changed";

/** Capacity may shrink by this much before the week is committed again. */
export const CAPACITY_SLACK = 30;

/**
 * Plan stability: a week's commitment changes on its own only for a new required item, lost
 * capacity or a change of life mode (and when the user asks, which the caller handles).
 */
export function recommitReason(stored: StoredWeek, input: WeekInput): RecommitReason | null {
  const week = weekStart(input.weekStart);
  const weekEnd = istanbulInstant(shiftDay(week, 7)).getTime();
  const mode = modeOf(input, week);
  if (stored.lifeMode !== null && stored.lifeMode !== mode) return "mode_changed";
  const active = new Set(
    input.modules.filter((mod) => mod.status === "active").map((mod) => mod.id),
  );
  const known = new Set(stored.committed);
  const newRequired = plannableItems(input.items, active).some(
    (item) =>
      !known.has(item.id) &&
      item.due_at !== null &&
      Date.parse(item.due_at) < weekEnd &&
      (item.earliest_at === null || Date.parse(item.earliest_at) < weekEnd) &&
      remainingEffort(item) > 0 &&
      !isBlocked(item, input.items),
  );
  if (newRequired) return "new_required";
  // Each remaining day as a whole, against the same day when the week was committed: a new
  // block or a longer one is lost capacity, the hours that have gone by are not.
  const now = dayCapacities(input, week);
  let lost = 0;
  for (const [day, before] of Object.entries(stored.capacityByDay)) {
    if (now[day] !== undefined) lost += Math.max(0, before - now[day]);
  }
  if (lost > CAPACITY_SLACK) return "capacity_lost";
  return null;
}

// --- Keeping the week -------------------------------------------------------------------------

/** The stored commitment as `weekAction` reads it. */
export type StoredWeekPlan = StoredWeek & {
  /** Minutes per committed item id. */
  shares: Record<string, WeekShare>;
  /** When the commitment was last written: items created later are new to it. */
  committedAt: string;
};

export type WeekAction =
  | { kind: "commit"; reason: RecommitReason | "none" }
  | { kind: "append"; items: string[] }
  | { kind: "repair"; items: string[] }
  | null;

/**
 * What the week needs now: a commitment (none yet, or a trigger fired), new items added to it,
 * or nothing. New items are those created after the commitment was written; they join it when
 * the week has room, without changing the shares of what was committed. An item the user added
 * by hand (no module key) always joins: adding it was the user's request.
 */
export function weekAction(stored: StoredWeekPlan | null, input: WeekInput): WeekAction {
  if (!stored) return { kind: "commit", reason: "none" };
  const reason = recommitReason(stored, input);
  if (reason) return { kind: "commit", reason };
  const items = appendable(stored, input);
  if (items.length > 0) return { kind: "append", items: items.map((row) => row.itemId) };
  const missing = missingSittings(stored, input);
  return missing.length > 0 ? { kind: "repair", items: missing.map((row) => row.itemId) } : null;
}

/**
 * Committed items with part of the week's share left but no open sitting: their sittings were
 * never written (a write cut short: the week row and the sittings are two writes) or were all
 * dropped. The rest of the share is cut into sittings again. An item worked to its share, split
 * into pieces, or waiting is left alone.
 */
export function missingSittings(stored: StoredWeekPlan, input: WeekInput): CommittedItem[] {
  const weekEnd = istanbulInstant(shiftDay(weekStart(input.weekStart), 7)).getTime();
  const containers = new Set(
    input.items
      .filter((item) => item.status === "active" || item.status === "waiting")
      .map((item) => item.parent_id),
  );
  const missing: CommittedItem[] = [];
  for (const id of stored.committed) {
    const item = input.items.find((row) => row.id === id);
    const share = stored.shares[id];
    if (!item || !share || item.status !== "active" || containers.has(id)) continue;
    const left = Math.min(
      remainingEffort(item),
      share.minutes - (item.effort_done_minutes - share.from),
    );
    if (left <= 0) continue;
    const open = input.tasks.some(
      (task) => task.work_item_id === id && ["todo", "doing", "waiting"].includes(task.status),
    );
    if (open) continue;
    missing.push({
      itemId: id,
      minutes: share.minutes,
      from: share.from,
      sittings: cutSittings(left, item.session_minutes),
      required: item.due_at !== null && Date.parse(item.due_at) < weekEnd,
    });
  }
  return missing;
}

/** The new items that join the commitment, with their share and sittings. */
export function appendable(stored: StoredWeekPlan, input: WeekInput): CommittedItem[] {
  const week = weekStart(input.weekStart);
  const weekEnd = istanbulInstant(shiftDay(week, 7)).getTime();
  const active = new Set(
    input.modules.filter((mod) => mod.status === "active").map((mod) => mod.id),
  );
  const known = new Set(stored.committed);
  const since = Date.parse(stored.committedAt);
  const fresh = plannableItems(input.items, active).filter(
    (item) =>
      !known.has(item.id) &&
      Date.parse(item.created_at) > since &&
      !isBlocked(item, input.items) &&
      (item.earliest_at === null || Date.parse(item.earliest_at) < weekEnd) &&
      remainingEffort(item) > 0,
  );
  if (fresh.length === 0) return [];
  // Each new item's share as a commitment would give it, the committed ones left aside.
  const plan = commitWeek({ ...input, items: input.items.filter((item) => !known.has(item.id)) });
  const used = Object.values(stored.shares).reduce((sum, share) => sum + share.minutes, 0);
  let free = (stored.capacityMinutes ?? plan.capacityMinutes) - used - fixedTotal(input, week);
  const added: CommittedItem[] = [];
  for (const item of fresh) {
    const planned = plan.committed.find((row) => row.itemId === item.id);
    const minutes =
      planned?.minutes ?? Math.min(remainingEffort(item), item.session_minutes ?? SITTING_DEFAULT);
    const byHand = item.key === null;
    if (!byHand && minutes > free) continue;
    free -= minutes;
    added.push({
      from: item.effort_done_minutes,
      itemId: item.id,
      minutes,
      sittings: cutSittings(minutes, item.session_minutes),
      required: item.due_at !== null && Date.parse(item.due_at) < weekEnd,
    });
  }
  return added;
}

function fixedTotal(input: WeekInput, week: string): number {
  const today = dayKey(input.now);
  const daysLeft = Math.max(0, Math.min(7, 7 - Math.max(0, daysBetweenKeys(week, today))));
  return input.modules
    .filter((mod) => mod.status === "active")
    .reduce((sum, mod) => sum + Math.round(fixedDemand(input, mod, week, daysLeft)), 0);
}
