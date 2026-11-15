import type { RhythmLog, Task, WorkItem } from "@/core/types";
import { shiftDay, weekStart } from "@/lib/date";
import { buildPlan } from "./plan";
import { dayEndOf, dayStartOf, dayTypeOf } from "./slots";
import { effectiveTiming, rhythmTiming } from "./timing";
import type { Assignment, Plan, PlanInput } from "./types";

// The plan of the days ahead (docs/04-planlayici.md, "Gelecek günlerin tahmini", Ç4a): what the
// engine would put on each coming day, day after day, with the same rules, counting what it put
// on the days before as done. Never stored: worked out again on every read, and on the day
// itself the real plan takes its place ("Plan tahminidir; o sabah yeniden kurulur."). Pure: the
// same input gives the same forecast, and today's plan is not touched.

/** The forecast reaches this many weeks ahead of today; further days have none. */
export const FORECAST_WEEKS = 8;

export type ForecastDay = {
  date: string;
  /** The work the day would hold, in time order (anchored routines are not forecast). */
  work: { start: Date; end: Date; assignment: Assignment }[];
  plannedMinutes: number;
  /** Minutes of work the day holds (its slots times the capacity factor). */
  usableMinutes: number;
};

/** What the forecast changes as it goes: the rows it counts as done. */
type State = {
  tasks: Task[];
  items: WorkItem[];
  logs: RhythmLog[];
  /** Minutes per module per week start, for the weekly floors. */
  spent: Map<string, Record<string, number>>;
};

/** Counts a planned piece of work as done on its day (copies; the input is never changed). */
function countDone(state: State, assignment: Assignment, day: string, end: Date): void {
  const { candidate, minutes } = assignment;
  const week = weekStart(day);
  const spent = { ...(state.spent.get(week) ?? {}) };
  spent[candidate.moduleId] = (spent[candidate.moduleId] ?? 0) + minutes;
  state.spent.set(week, spent);
  const addEffort = (itemId: string) => {
    state.items = state.items.map((item) =>
      item.id === itemId
        ? { ...item, effort_done_minutes: item.effort_done_minutes + minutes }
        : item,
    );
  };
  if (candidate.type === "task") {
    state.tasks = state.tasks.map((task) =>
      task.id === candidate.id
        ? { ...task, status: "done" as const, done_at: end.toISOString() }
        : task,
    );
    if (candidate.task?.work_item_id) addEffort(candidate.task.work_item_id);
  } else if (candidate.type === "item") {
    addEffort(candidate.id);
  } else if (candidate.type === "rhythm") {
    state.logs = [
      ...state.logs,
      {
        id: `forecast:${candidate.id}:${day}`,
        user_id: candidate.rhythm?.user_id ?? "",
        rhythm_id: candidate.id,
        done_on: day,
        session_id: null,
        created_at: end.toISOString(),
        updated_at: end.toISOString(),
      },
    ];
  } else {
    // A follow-up is a reminder of one day.
    state.tasks = state.tasks.map((task) =>
      task.id === candidate.id ? { ...task, follow_up_on: null } : task,
    );
  }
}

/** The input of a day ahead: its own start and end, no frame, no routines, nothing open. */
function dayInput(base: PlanInput, state: State, day: string): PlanInput {
  const { settings } = base;
  const start = dayStartOf(day, settings);
  const sameWeek = weekStart(day) === weekStart(base.date);
  // Anchored work (routines at the waking and the bedtime) is not forecast; its time is already
  // outside the day's start and end.
  const tasks = state.tasks.filter((task) => {
    const item = task.work_item_id
      ? state.items.find((row) => row.id === task.work_item_id)
      : undefined;
    return !effectiveTiming(task, item)?.anchor;
  });
  return {
    ...base,
    now: start,
    date: day,
    dayType: dayTypeOf(day, base.blocks, settings),
    dayStart: start,
    bedtime: dayEndOf(day, settings),
    frame: undefined,
    closed: false,
    tasks,
    workItems: state.items,
    rhythms: base.rhythms.filter((rhythm) => !rhythmTiming(rhythm)?.anchor),
    rhythmLogs: state.logs,
    // The week's commitment is this week's; a later week has none yet: all its work is open.
    committed: sameWeek ? base.committed : null,
    shares: sameWeek ? base.shares : {},
    spentThisWeek: state.spent.get(weekStart(day)) ?? {},
    skipped: [],
    openSession: null,
    prompt: null,
    lastSeenAt: null,
    startedToday: false,
    advice: undefined,
  };
}

/**
 * The days after today up to `to` (at most `FORECAST_WEEKS` weeks ahead), those from `from` on
 * returned. `today` is today's plan: what it holds counts as done for the days after.
 */
export function forecastDays(
  base: PlanInput,
  today: Plan,
  range: { from: string; to: string },
): ForecastDay[] {
  const last = shiftDay(base.date, FORECAST_WEEKS * 7);
  const to = range.to < last ? range.to : last;
  const state: State = {
    tasks: base.tasks,
    items: base.workItems,
    logs: base.rhythmLogs,
    spent: new Map([[weekStart(base.date), { ...(base.spentThisWeek ?? {}) }]]),
  };
  for (const slot of today.slots) {
    if (slot.assignment) countDone(state, slot.assignment, base.date, slot.end);
  }
  const days: ForecastDay[] = [];
  for (let day = shiftDay(base.date, 1); day <= to; day = shiftDay(day, 1)) {
    const plan = buildPlan(dayInput(base, state, day), { warnings: false });
    const work = plan.slots.flatMap((slot) =>
      slot.assignment && slot.part === undefined
        ? [{ start: slot.start, end: slot.end, assignment: slot.assignment }]
        : [],
    );
    for (const row of work) countDone(state, row.assignment, day, row.end);
    if (day >= range.from) {
      days.push({
        date: day,
        work,
        plannedMinutes: work.reduce((sum, row) => sum + row.assignment.minutes, 0),
        usableMinutes: plan.usableMinutes,
      });
    }
  }
  return days;
}
