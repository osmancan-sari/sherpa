import { nextSessionMinutes } from "@/core/contract/envelope";
import type { LifeMode, ModuleRow, Rhythm, RhythmLog } from "@/core/types";
import { isBlocked } from "@/core/today/select";
import { dayKey, istanbulInstant, monthStart, shiftDay, weekStart, weekdayOf } from "@/lib/date";
import { dayCapacity, learned } from "./slots";
import type { Candidate, MandatoryReason, PlanInput } from "./types";

// Who could be worked on today, and how much each is worth (docs/04-planlayici.md, "Skor",
// "Süzgeçler", "Koruma kuralları").

/** Urgency from which a task is mandatory today: started later, it would not make it. */
export const URGENT = 0.8;
/** A follow-up of waiting work: a short, light reminder. */
export const FOLLOW_UP_MINUTES = 5;
/** Length of one sitting when the weekly floor of a module is counted in sittings. */
const FLOOR_SITTING_MINUTES = 45;

const IMPORTANCE_FACTOR: Record<number, number> = { 1: 0.5, 2: 1, 3: 1.5, 4: 2 };

type Behavior = { weightMultiplier?: number; floorMultiplier?: number };

function behavior(mod: ModuleRow, mode: LifeMode): Behavior {
  const all = (mod.mode_behavior ?? {}) as Record<string, Behavior | undefined>;
  return all[mode] ?? {};
}

/** The module's weight in this life mode. */
export function moduleWeight(mod: ModuleRow, mode: LifeMode): number {
  const multiplier = behavior(mod, mode).weightMultiplier;
  return Number(mod.weight) * (typeof multiplier === "number" ? multiplier : 1);
}

/**
 * The weekly floor of a module in this life mode. A lifelong module's floor shrinks in busy
 * mode but is never wiped out (at least half stays).
 */
export function weeklyFloor(mod: ModuleRow, mode: LifeMode): number {
  const raw = behavior(mod, mode).floorMultiplier;
  let multiplier = typeof raw === "number" ? raw : 1;
  if (mode === "busy" && mod.kind === "lifelong") multiplier = Math.max(multiplier, 0.5);
  return Math.round(mod.weekly_floor_minutes * Math.min(1, Math.max(0, multiplier)));
}

/** The rhythm's target in this life mode; busy mode never goes below the floor. */
export function rhythmTarget(rhythm: Rhythm, mode: LifeMode): number {
  const targets = (rhythm.mode_targets ?? {}) as Record<string, unknown>;
  const byMode = targets[mode];
  const target = typeof byMode === "number" ? byMode : rhythm.target_count;
  if (mode === "normal" || mode === "busy") return Math.max(target, rhythm.floor_count);
  return target;
}

/** First and last day of the rhythm's period that contains the day. */
export function periodBounds(period: Rhythm["period"], day: string): { from: string; to: string } {
  if (period === "day") return { from: day, to: day };
  if (period === "week") {
    const from = weekStart(day);
    return { from, to: shiftDay(from, 6) };
  }
  const from = monthStart(day);
  const next = monthStart(shiftDay(from, 31));
  return { from, to: shiftDay(next, -1) };
}

export type RhythmState = {
  done: number;
  target: number;
  debt: number;
  doneToday: number;
  /** Days left in the period, today included. */
  daysLeft: number;
  /** How far the period has gone, 0 to 1 (today counted as gone). */
  progress: number;
  floorInDanger: boolean;
};

/** Where a rhythm stands on the day; earlier periods are not seen at all. */
export function rhythmState(
  rhythm: Rhythm,
  logs: RhythmLog[],
  day: string,
  mode: LifeMode,
): RhythmState {
  const { from, to } = periodBounds(rhythm.period, day);
  const mine = logs.filter((log) => log.rhythm_id === rhythm.id);
  const done = mine.filter((log) => log.done_on >= from && log.done_on <= to).length;
  const doneToday = mine.filter((log) => log.done_on === day).length;
  const target = rhythmTarget(rhythm, mode);
  const total = dayCount(from, to);
  const daysLeft = dayCount(day, to);
  const floor = mode === "holiday" ? 0 : Math.min(rhythm.floor_count, target);
  const floorNeeded = Math.max(0, floor - done);
  return {
    done,
    target,
    debt: Math.max(0, target - done),
    doneToday,
    daysLeft,
    progress: (total - daysLeft + 1) / total,
    floorInDanger: floorNeeded > 0 && daysLeft <= floorNeeded,
  };
}

function dayCount(from: string, to: string): number {
  return (
    Math.round(
      (istanbulInstant(to, "12:00").getTime() - istanbulInstant(from, "12:00").getTime()) /
        86_400_000,
    ) + 1
  );
}

/** Days from one day key to another (negative when `to` is earlier). */
export function daysFrom(from: string, to: string): number {
  return dayCount(from, to) - 1;
}

/** Minutes of work the days from the plan's window to a deadline can hold. */
export function availableUntil(input: PlanInput, due: Date): number {
  const last = dayKey(due);
  let total = 0;
  for (let day = input.date; day <= last; day = shiftDay(day, 1)) {
    const from =
      day === input.date ? (input.now > input.dayStart ? input.now : input.dayStart) : undefined;
    total += dayCapacity(day, input.blocks, input.settings, input.stats, { from, until: due });
  }
  return total;
}

/** The learned estimate multiplier for a task of this module and kind; 1 until learned. */
export function estimateMultiplier(input: PlanInput, moduleId: string, kind: string): number {
  const slug = input.modules.find((mod) => mod.id === moduleId)?.slug;
  if (!slug) return 1;
  return learned(input.stats, `est_multiplier:${slug}:${kind}`) ?? 1;
}

const round5 = (minutes: number) => Math.max(5, Math.round(minutes / 5) * 5);

type Raw = Omit<Candidate, "score" | "mandatory"> & { remaining: number };

/** Everything that could be worked on today, scored, the mandatory ones marked. */
export function buildCandidates(input: PlanInput): Candidate[] {
  const { date, lifeMode } = input;
  const modules = new Map(
    input.modules.filter((mod) => mod.status === "active").map((mod) => [mod.id, mod]),
  );
  const skipped = new Set(input.skipped ?? []);
  const deferred = new Set(input.advice?.defer ?? []);
  const preferred = new Set(input.advice?.prefer ?? []);
  const raws: Raw[] = [];

  // Tasks: open ones planned for today or no day. In the return state the planned days are
  // forgotten: what was planned during the absence is spread again by the usual rules.
  const returning = isReturning(input);
  const openTasks = input.tasks.filter(
    (task) => (task.status === "todo" || task.status === "doing") && modules.has(task.module_id),
  );
  for (const task of openTasks) {
    if (!returning && task.planned_date !== null && task.planned_date > date) continue;
    if (skipped.has(task.id)) continue;
    const item = task.work_item_id
      ? input.workItems.find((row) => row.id === task.work_item_id)
      : undefined;
    if (item && (item.status === "waiting" || item.status === "proposed")) continue;
    const minutes = round5(task.est_minutes * estimateMultiplier(input, task.module_id, task.kind));
    const itemLeft =
      item && item.effort_total_minutes !== null
        ? Math.max(minutes, item.effort_total_minutes - item.effort_done_minutes)
        : minutes;
    raws.push({
      type: "task",
      id: task.id,
      title: task.title,
      moduleId: task.module_id,
      // With the learned multiplier a task may be longer than any slot: it then waits in the
      // overflow instead of squeezing into 90 minutes.
      minutes,
      energy: task.energy,
      context: task.context,
      dueAt: task.due_at,
      importance: task.importance,
      createdAt: task.created_at,
      remaining: itemLeft,
      task,
      item,
    });
  }

  // Follow-ups: waiting work whose follow-up day has come.
  for (const task of input.tasks) {
    if (task.status !== "waiting" || !modules.has(task.module_id)) continue;
    if (task.follow_up_on === null || task.follow_up_on > date || skipped.has(task.id)) continue;
    raws.push({
      type: "follow_up",
      id: task.id,
      title: task.title,
      moduleId: task.module_id,
      minutes: FOLLOW_UP_MINUTES,
      energy: "light",
      context: "any",
      dueAt: null,
      importance: task.importance,
      createdAt: task.created_at,
      remaining: FOLLOW_UP_MINUTES,
      task,
    });
  }

  // Work items without an open sitting. With a week plan only the committed ones are offered:
  // the rest wait for their week (docs/04-planlayici.md, "Plan ufukları").
  const committed =
    input.committed === undefined || input.committed === null ? null : new Set(input.committed);
  const withSitting = new Set(openTasks.map((task) => task.work_item_id).filter(Boolean));
  const split = new Set(
    input.workItems
      .filter((row) => row.status === "active" || row.status === "waiting")
      .map((row) => row.parent_id),
  );
  for (const item of input.workItems) {
    if (item.status !== "active" || !modules.has(item.module_id)) continue;
    if (withSitting.has(item.id) || split.has(item.id) || skipped.has(item.id)) continue;
    // Against the start of the planned window, not the clock: tomorrow's plan made the evening
    // before sees what may start tomorrow.
    const windowStart = Math.max(input.now.getTime(), input.dayStart.getTime());
    if (item.earliest_at !== null && Date.parse(item.earliest_at) > windowStart) continue;
    if (isBlocked(item, input.workItems)) continue;
    const usedUp =
      item.effort_total_minutes !== null && item.effort_done_minutes >= item.effort_total_minutes;
    if (committed && !committed.has(item.id) && !usedUp) continue;
    const minutes = nextSessionMinutes(item);
    raws.push({
      type: "item",
      id: item.id,
      title: item.title,
      moduleId: item.module_id,
      minutes,
      energy: item.energy ?? "light",
      context: item.context ?? "any",
      dueAt: item.due_at,
      importance: item.importance,
      createdAt: item.created_at,
      remaining:
        item.effort_total_minutes === null
          ? minutes
          : Math.max(minutes, item.effort_total_minutes - item.effort_done_minutes),
      item,
    });
  }

  // Rhythms with something left in their period; at most once a day unless the rhythm is daily.
  const rhythmStates = new Map<string, RhythmState>();
  for (const rhythm of input.rhythms) {
    if (!rhythm.active || !modules.has(rhythm.module_id) || skipped.has(rhythm.id)) continue;
    const state = rhythmState(rhythm, input.rhythmLogs, date, lifeMode);
    rhythmStates.set(rhythm.id, state);
    if (state.debt === 0) continue;
    if (rhythm.period !== "day" && state.doneToday > 0) continue;
    raws.push({
      type: "rhythm",
      id: rhythm.id,
      title: rhythm.title,
      moduleId: rhythm.module_id,
      minutes: Math.min(90, round5(rhythm.est_minutes)),
      energy: rhythm.energy,
      context: rhythm.context,
      dueAt: null,
      importance: 2,
      createdAt: rhythm.created_at,
      progress: `${state.done}/${state.target}`,
      remaining: rhythm.est_minutes,
      rhythm,
    });
  }

  const dayStart = istanbulInstant(date).getTime();
  const dayEnd = istanbulInstant(shiftDay(date, 1)).getTime();
  const scored: Candidate[] = [];
  for (const raw of raws) {
    const mod = modules.get(raw.moduleId)!;
    const weight = moduleWeight(mod, lifeMode);
    let urgency = 0;
    let mandatory: MandatoryReason | null = null;
    if (raw.dueAt !== null) {
      const due = Date.parse(raw.dueAt);
      // A deadline that has passed is not piled onto today (rule 2): the work stays in the
      // pool with a moderate urgency and is planned like the rest.
      if (due < Math.max(dayStart, input.now.getTime())) urgency = 0.5;
      else {
        const available = availableUntil(input, new Date(due));
        urgency = available <= 0 ? 2 : Math.min(2, raw.remaining / available);
        if (due < dayEnd) mandatory = "due_today";
        else if (urgency >= URGENT) mandatory = "urgent";
      }
    }
    let debt = 0;
    const state = raw.rhythm ? rhythmStates.get(raw.rhythm.id) : undefined;
    if (state) {
      debt = (state.debt / Math.max(1, state.target)) * state.progress;
      if (state.floorInDanger) mandatory = "floor";
    }
    // Waiting raises undated work slowly; a rhythm has its debt instead.
    const wait =
      raw.dueAt === null && raw.type !== "rhythm"
        ? Math.min(0.3, Math.max(0, daysFrom(dayKey(new Date(raw.createdAt)), date)) / 30)
        : 0;
    let score = weight * (IMPORTANCE_FACTOR[raw.importance] ?? 1) * (urgency + debt + wait);
    if (preferred.has(raw.id)) score *= 1.5;
    // A module that the life mode switches off offers nothing, unless it is due today.
    if (weight <= 0 && mandatory !== "due_today") continue;
    const { remaining: _remaining, ...rest } = raw;
    void _remaining;
    scored.push({ ...rest, score, mandatory });
  }

  markFloorWork(input, scored, modules);
  // The AI may put work off, but never mandatory work (the engine has the last word). This runs
  // after every mandatory mark, the weekly floors included.
  return scored
    .filter((candidate) => !deferred.has(candidate.id) || candidate.mandatory !== null)
    .sort(compareScored);
}

/**
 * A module whose weekly floor is in danger gets its best candidate made mandatory: the days
 * left in the week are no more than the sittings still needed.
 */
function markFloorWork(input: PlanInput, candidates: Candidate[], modules: Map<string, ModuleRow>) {
  const daysLeft = 8 - weekdayOf(input.date);
  for (const mod of modules.values()) {
    if (mod.kind !== "lifelong" || input.lifeMode === "holiday") continue;
    const floor = weeklyFloor(mod, input.lifeMode);
    const needed = floor - (input.spentThisWeek?.[mod.id] ?? 0);
    if (needed <= 0) continue;
    if (daysLeft > Math.ceil(needed / FLOOR_SITTING_MINUTES)) continue;
    const best = candidates
      .filter((candidate) => candidate.moduleId === mod.id && candidate.type !== "follow_up")
      .sort(compareScored)[0];
    if (best && best.mandatory === null) best.mandatory = "floor";
  }
}

/** Mandatory first (by deadline), then by score, then by the old order: deadline, importance, age. */
export function compareScored(a: Candidate, b: Candidate): number {
  if ((a.mandatory === null) !== (b.mandatory === null)) return a.mandatory === null ? 1 : -1;
  if (a.mandatory !== null && b.mandatory !== null) {
    const due = dueOrder(a) - dueOrder(b);
    if (due !== 0) return due;
  }
  if (a.score !== b.score) return b.score - a.score;
  const due = dueOrder(a) - dueOrder(b);
  if (due !== 0) return due;
  if (a.importance !== b.importance) return b.importance - a.importance;
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

const dueOrder = (candidate: Candidate) =>
  candidate.dueAt === null ? Number.MAX_SAFE_INTEGER : Date.parse(candidate.dueAt);

/** Back after `returnAfterDays` days or more without a touch, and nothing started yet today. */
export function isReturning(input: PlanInput): boolean {
  if (!input.lastSeenAt || input.startedToday) return false;
  return daysFrom(dayKey(input.lastSeenAt), input.date) >= input.settings.returnAfterDays;
}
