import type {
  Block,
  Context,
  DayRow,
  InboxEntry,
  LifeMode,
  LifeModePeriod,
  ModuleRow,
  PlannerStatRow,
  Prompt,
  Rhythm,
  RhythmLog,
  Session,
  Settings,
  Task,
  WeekPlanRow,
  WorkItem,
} from "@/core/types";
import { dayKey, istanbulInstant, shiftDay, weekStart } from "@/lib/date";
import { dayTypeOf, plannerSettings } from "./slots";
import type { PlanAdvice, PlanInput } from "./types";

// The planner's input put together from the rows the app reads. Pure, and the same for the
// screen (which re-plans on every change) and the server (which asks the AI): both plan the
// same day the same way.

export type PlanRows = {
  settings: Settings | null;
  modules: ModuleRow[];
  tasks: Task[];
  workItems: WorkItem[];
  rhythms: Rhythm[];
  rhythmLogs: RhythmLog[];
  blocks: Block[];
  sessions: Session[];
  openSession: Session | null;
  prompts: Prompt[];
  inbox: InboxEntry[];
  days: DayRow[];
  weekPlans: WeekPlanRow[];
  lifeModes: LifeModePeriod[];
  stats: PlannerStatRow[];
};

/** What the days row keeps in `plan` besides the slots: the AI's advice and the day's skips. */
export type StoredDayPlan = {
  version: 1;
  advice?: PlanAdvice | null;
  skipped?: string[];
  /** Slot minutes of the day when it was planned; the capacity learning reads it. */
  slotMinutes?: number;
  usableMinutes?: number;
};

export function storedPlan(day: DayRow | null | undefined): StoredDayPlan {
  const plan = day?.plan as Partial<StoredDayPlan> | null | undefined;
  return plan && typeof plan === "object" ? { version: 1, ...plan } : { version: 1 };
}

/** The life mode of a day: the period that covers it, else normal. */
export function lifeModeOn(periods: LifeModePeriod[], day: string): LifeMode {
  const covering = periods
    .filter((period) => period.starts_on <= day && period.ends_on >= day)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return covering[0]?.mode ?? "normal";
}

/** The latest sign of use before the given instant: a session, a rhythm log, an entry. */
export function lastActivityBefore(rows: PlanRows, before: Date): Date | null {
  const limit = before.getTime();
  let latest = 0;
  const see = (stamp: string | null | undefined) => {
    if (!stamp) return;
    const time = Date.parse(stamp);
    if (time < limit && time > latest) latest = time;
  };
  rows.sessions.forEach((row) => see(row.started_at));
  rows.rhythmLogs.forEach((row) => see(row.created_at));
  rows.inbox.forEach((row) => see(row.created_at));
  rows.tasks.forEach((row) => see(row.done_at));
  return latest > 0 ? new Date(latest) : null;
}

/** Minutes worked per module in the week of the day. */
export function minutesThisWeek(
  sessions: Session[],
  day: string,
  now: Date,
): Record<string, number> {
  const from = istanbulInstant(weekStart(day)).getTime();
  const totals: Record<string, number> = {};
  for (const session of sessions) {
    if (!session.module_id) continue;
    const start = Date.parse(session.started_at);
    if (start < from) continue;
    const end = session.ended_at ? Date.parse(session.ended_at) : now.getTime();
    totals[session.module_id] =
      (totals[session.module_id] ?? 0) + Math.max(0, (end - start) / 60_000);
  }
  return totals;
}

export function planInput(
  rows: PlanRows,
  options: { date: string; now: Date; context: Context },
): PlanInput {
  const { date, now, context } = options;
  const settings = plannerSettings(rows.settings);
  const day = rows.days.find((row) => row.date === date) ?? null;
  const stored = storedPlan(day);
  const week = rows.weekPlans.find((row) => row.week_start === weekStart(date)) ?? null;
  const dayBegins = istanbulInstant(date);
  return {
    now,
    date,
    dayType: day?.day_type ?? dayTypeOf(date, rows.blocks, settings),
    lifeMode: lifeModeOn(rows.lifeModes, date),
    dayStart: day?.started_at ? new Date(day.started_at) : istanbulInstant(date, settings.dayStart),
    finishLine: istanbulInstant(date, (day?.finish_line ?? settings.finishLine).slice(0, 5)),
    closed: day?.closed_at != null,
    blocks: rows.blocks,
    tasks: rows.tasks,
    workItems: rows.workItems,
    rhythms: rows.rhythms,
    rhythmLogs: rows.rhythmLogs,
    modules: rows.modules.filter((mod) => mod.status === "active"),
    context,
    settings,
    stats: rows.stats.map((row) => ({
      key: row.key,
      value: Number(row.value),
      sample_size: row.sample_size,
    })),
    spentThisWeek: minutesThisWeek(rows.sessions, date, now),
    committed: week ? week.committed : null,
    top3: day && day.top3.length > 0 ? day.top3 : undefined,
    skipped: stored.skipped ?? [],
    openSession: rows.openSession,
    prompt:
      rows.prompts.find((row) =>
        rows.modules.some((mod) => mod.id === row.module_id && mod.status === "active"),
      ) ?? null,
    lastSeenAt: lastActivityBefore(rows, dayBegins),
    startedToday: rows.sessions.some((row) => Date.parse(row.started_at) >= dayBegins.getTime()),
    advice: stored.advice ?? undefined,
  };
}

/** Tomorrow's input at the evening closing (and for the night screen's "first thing tomorrow"). */
export function tomorrowInput(rows: PlanRows, options: { now: Date; context: Context }): PlanInput {
  const date = shiftDay(dayKey(options.now), 1);
  return {
    ...planInput(rows, { ...options, date }),
    prompt: null,
    openSession: null,
    startedToday: false,
  };
}
