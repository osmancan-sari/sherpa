import type { DayType, ModuleRow, Session, Task } from "@/core/types";
import { dayKey } from "@/lib/date";
import { MIN_SAMPLES } from "./slots";
import type { PlannerStat } from "./types";

// Learning (docs/04-planlayici.md, "Öğrenme"): once a week, from measured sessions only. It
// changes the planner's inputs (`planner_stats`), never the planner itself.

/** Sessions per (module, task kind) the estimate multiplier is taken from. */
export const ESTIMATE_WINDOW = 20;
export const MULTIPLIER_MIN = 0.5;
export const MULTIPLIER_MAX = 3;
/** Weight of the newest day in the capacity average. */
export const CAPACITY_ALPHA = 0.3;
/**
 * A learned capacity factor stays in this range: days with no sessions recorded (the user did
 * not track) must not empty the plan.
 */
export const CAPACITY_MIN = 0.2;
export const CAPACITY_MAX = 1;

const minutesOf = (session: Session) =>
  session.ended_at === null
    ? 0
    : (Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60_000;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Estimate multipliers: per (module, task kind), the median of real ÷ estimated minutes over
 * the last 20 measured, finished sessions; kept between 0.5 and 3. A pair with fewer than 5
 * samples is not written (the planner then uses 1).
 */
export function estimateMultipliers(
  sessions: Session[],
  tasks: Task[],
  modules: ModuleRow[],
): PlannerStat[] {
  const byPair = new Map<string, { at: number; ratio: number }[]>();
  for (const session of sessions) {
    if (!session.measured || session.ended_at === null || session.task_id === null) continue;
    const task = tasks.find((row) => row.id === session.task_id);
    if (!task || task.status !== "done" || task.est_minutes <= 0) continue;
    const slug = modules.find((mod) => mod.id === task.module_id)?.slug;
    if (!slug) continue;
    const key = `est_multiplier:${slug}:${task.kind}`;
    const list = byPair.get(key) ?? [];
    list.push({ at: Date.parse(session.started_at), ratio: minutesOf(session) / task.est_minutes });
    byPair.set(key, list);
  }
  const stats: PlannerStat[] = [];
  for (const [key, list] of byPair) {
    const recent = list.sort((a, b) => b.at - a.at).slice(0, ESTIMATE_WINDOW);
    if (recent.length < MIN_SAMPLES) continue;
    const value = Math.min(
      MULTIPLIER_MAX,
      Math.max(MULTIPLIER_MIN, median(recent.map((row) => row.ratio))),
    );
    stats.push({ key, value: round2(value), sample_size: recent.length });
  }
  return stats.sort((a, b) => a.key.localeCompare(b.key));
}

/** A planned day as the capacity learning sees it: its type and the slot time it had. */
export type PlannedDay = { date: string; dayType: DayType; slotMinutes: number };

/**
 * Capacity factors: per day type, worked minutes (measured sessions) ÷ slot minutes, as an
 * exponential moving average over the days in date order. Fewer than 5 days: not written.
 */
export function capacityFactors(days: PlannedDay[], sessions: Session[]): PlannerStat[] {
  const worked = new Map<string, number>();
  for (const session of sessions) {
    if (!session.measured || session.ended_at === null) continue;
    const day = dayKey(new Date(session.started_at));
    worked.set(day, (worked.get(day) ?? 0) + minutesOf(session));
  }
  const stats: PlannerStat[] = [];
  for (const type of ["home", "office", "campus"] as const) {
    const ofType = days
      .filter((day) => day.dayType === type && day.slotMinutes > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (ofType.length < MIN_SAMPLES) continue;
    let average: number | null = null;
    for (const day of ofType) {
      const ratio = Math.min(1, (worked.get(day.date) ?? 0) / day.slotMinutes);
      average = average === null ? ratio : CAPACITY_ALPHA * ratio + (1 - CAPACITY_ALPHA) * average;
    }
    const value = Math.min(CAPACITY_MAX, Math.max(CAPACITY_MIN, average!));
    stats.push({ key: `capacity:${type}`, value: round2(value), sample_size: ofType.length });
  }
  return stats;
}
