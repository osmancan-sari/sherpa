import {
  capacityFactors,
  commitWeek,
  estimateMultipliers,
  lifeModeOn,
  type PlannerStat,
  type PlanRows,
  weekSettings,
  readShares,
  storedPlan,
  type WeekAdvice,
  type WeekInput,
  type WeekPlan,
} from "@/core/planner";
import type { PlannedDay } from "@/core/planner/learn";
import {
  appendable,
  missingSittings,
  type StoredWeekPlan,
  type WeekAction,
  weekAction,
} from "@/core/planner/week";
import { type Db, type Task, unwrap, type WeekPlanRow } from "@/core/types";
import { dayKey, shiftDay, weekStart } from "@/lib/date";
import { listBlocks } from "./blocks";
import { getSettings, listDuePrompts, listInbox } from "./inbox";
import { listModules } from "./module-rows";
import {
  listDays,
  listLifeModes,
  listStats,
  listWeekPlans,
  saveStats,
  saveWeekPlan,
} from "./planning";
import { getOpenSession, listSessions } from "./sessions";
import { listRhythmLogs, listRhythms, listTasks, listWorkItems } from "./work";

// Keeping the plan's horizons up to date: the week's commitment (made, re-made on a trigger,
// new items added) and what the planner learns. The same code runs in the browser (without
// AI) and on the server (with the AI's advice, Ç3 step 7).

/** Every row the planner reads, as the screens read them. */
export async function loadPlanRows(db: Db, now: Date): Promise<PlanRows> {
  const today = dayKey(now);
  const [
    settings,
    modules,
    tasks,
    workItems,
    rhythms,
    rhythmLogs,
    blocks,
    sessions,
    openSession,
    prompts,
    inbox,
    days,
    weekPlans,
    lifeModes,
    stats,
  ] = await Promise.all([
    getSettings(db),
    listModules(db),
    listTasks(db, now),
    listWorkItems(db),
    listRhythms(db),
    listRhythmLogs(db, shiftDay(today, -31)),
    listBlocks(db, now),
    listSessions(db, now),
    getOpenSession(db),
    listDuePrompts(db, now),
    listInbox(db),
    listDays(db, shiftDay(today, -56)),
    listWeekPlans(db, shiftDay(weekStart(today), -7)),
    listLifeModes(db),
    listStats(db),
  ]);
  return {
    settings,
    modules,
    tasks,
    workItems,
    rhythms,
    rhythmLogs,
    blocks,
    sessions,
    openSession,
    prompts,
    inbox,
    days,
    weekPlans,
    lifeModes,
    stats,
  };
}

/** The week's input from the rows: the week of `now`. */
export function weekInput(rows: PlanRows, now: Date): WeekInput {
  const today = dayKey(now);
  return {
    now,
    weekStart: weekStart(today),
    items: rows.workItems,
    tasks: rows.tasks,
    rhythms: rows.rhythms,
    modules: rows.modules,
    blocks: rows.blocks,
    // With the day's frame each day starts at its expected waking (Ç3c).
    settings: weekSettings(rows, now),
    stats: rows.stats.map((row) => ({
      key: row.key,
      value: Number(row.value),
      sample_size: row.sample_size,
    })),
    // The current week in today's mode; later weeks in their Monday's.
    lifeMode: (week) => lifeModeOn(rows.lifeModes, week === weekStart(today) ? today : week),
  };
}

export function storedWeek(row: WeekPlanRow | undefined): StoredWeekPlan | null {
  if (!row) return null;
  return {
    committed: row.committed,
    capacityMinutes: row.capacity_minutes,
    capacityByDay: (row.day_capacity ?? {}) as Record<string, number>,
    lifeMode: row.life_mode,
    shares: readShares(row.shares),
    committedAt: row.updated_at,
  };
}

export type KeepWeekResult = { action: WeekAction; plan: WeekPlanRow | null };

/**
 * Makes sure the current week has its commitment: commits it when there is none or a trigger
 * fired (or `force`: the user asked), adds new items when they come, and otherwise leaves it
 * alone. A fresh commitment is also when the planner learns (once a week).
 */
export async function keepWeek(
  db: Db,
  now: Date,
  options: {
    force?: boolean;
    rows?: PlanRows;
    /** The AI's advice for a new commitment; null when there is none. */
    advise?: (input: WeekInput) => Promise<WeekAdvice | null>;
  } = {},
): Promise<KeepWeekResult> {
  const rows = options.rows ?? (await loadPlanRows(db, now));
  const input = weekInput(rows, now);
  const row = rows.weekPlans.find((plan) => plan.week_start === input.weekStart);
  const stored = storedWeek(row);
  const action: WeekAction = options.force
    ? { kind: "commit", reason: "none" }
    : weekAction(stored, input);
  if (!action) return { action, plan: row ?? null };

  if ((action.kind === "append" || action.kind === "repair") && stored && row) {
    const added = action.kind === "append" ? appendable(stored, input) : [];
    const repaired = action.kind === "repair" ? missingSittings(stored, input) : [];
    const plan: WeekPlan = {
      weekStart: input.weekStart,
      committed: [
        // What was committed stays as it was; only its sittings are left alone.
        ...stored.committed.map(
          (itemId) =>
            repaired.find((entry) => entry.itemId === itemId) ?? {
              itemId,
              minutes: stored.shares[itemId]?.minutes ?? 0,
              from: stored.shares[itemId]?.from ?? 0,
              sittings: [] as number[],
              required: false,
            },
        ),
        ...added,
      ],
      moduleBudgets: addBudgets(row.module_budgets as Record<string, number>, added, rows),
      capacityMinutes: row.capacity_minutes ?? 0,
      capacityByDay: stored.capacityByDay,
      left: [],
      lifeMode: row.life_mode ?? "normal",
      source: (row.plan_source as WeekPlan["source"]) ?? "auto",
      reasons: (row.reasons as Record<string, string> | null) ?? {},
    };
    const saved = await saveWeekPlan(db, plan, {
      tasks: rows.tasks,
      items: rows.workItems,
      only: [...added, ...repaired].map((entry) => entry.itemId),
    });
    return { action, plan: saved };
  }

  // A new week is when the planner learns, before the week is committed: the commitment then
  // stands on this week's values, and nothing learned changes it until the next week.
  let current = input;
  if (!stored) {
    // Learning that fails leaves last week's values; the week is committed all the same.
    const learned = await learn(db, rows).catch(() => [] as PlannerStat[]);
    if (learned.length > 0) current = { ...input, stats: mergeStats(input.stats, learned) };
  }
  const advice = options.advise ? await options.advise(current).catch(() => null) : null;
  const plan = commitWeek(current, advice ?? undefined);
  const saved = await saveWeekPlan(db, plan, { tasks: rows.tasks, items: rows.workItems });
  return { action, plan: saved };
}

function addBudgets(budgets: Record<string, number>, added: WeekPlan["committed"], rows: PlanRows) {
  const next = { ...budgets };
  for (const entry of added) {
    const item = rows.workItems.find((row) => row.id === entry.itemId);
    const slug = rows.modules.find((mod) => mod.id === item?.module_id)?.slug;
    if (slug) next[slug] = (next[slug] ?? 0) + entry.minutes;
  }
  return next;
}

/** Learning (docs/04-planlayici.md, "Öğrenme"): from the last eight weeks' measured sessions. */
export async function learn(db: Db, rows: PlanRows): Promise<PlannerStat[]> {
  const ids = [
    ...new Set(rows.sessions.map((row) => row.task_id).filter((id): id is string => id !== null)),
  ];
  const tasks: Task[] = [];
  // In pieces: eight weeks of sessions would make one long request.
  for (let at = 0; at < ids.length; at += 100) {
    tasks.push(
      ...unwrap(
        await db
          .from("tasks")
          .select("*")
          .in("id", ids.slice(at, at + 100)),
      ),
    );
  }
  const planned: PlannedDay[] = rows.days.flatMap((day) => {
    const stored = storedPlan(day);
    if (!stored.slotMinutes || !day.day_type) return [];
    return [{ date: day.date, dayType: day.day_type, slotMinutes: stored.slotMinutes }];
  });
  const stats = [
    ...estimateMultipliers(rows.sessions, tasks, rows.modules),
    ...capacityFactors(planned, rows.sessions),
  ];
  await saveStats(db, stats);
  return stats;
}

function mergeStats(old: PlannerStat[], fresh: PlannerStat[]): PlannerStat[] {
  const keys = new Set(fresh.map((row) => row.key));
  return [...old.filter((row) => !keys.has(row.key)), ...fresh];
}
