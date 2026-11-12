import { readTiming, type TimeWindow, type Timing } from "@/core/contract/timing";
import type { Context, Rhythm, Task, WorkItem } from "@/core/types";
import { istanbulInstant, shiftDay, weekdayOf } from "@/lib/date";

// Time constraints as the planner reads them (docs/04-planlayici.md, "Zaman kısıtları (Ç3b)").
// Pure: ranges are instants (ms) of one Istanbul day.

export type Range = { start: number; end: number };

/** The score factor of a placement by its time state (rule 4). One place, so it can move to settings. */
export const TIME_FACTOR = { preferred: 1.25, neutral: 1, avoided: 0.5 } as const;
export type TimeState = keyof typeof TIME_FACTOR;
/** Half the work in a range makes the placement preferred or avoided. */
export const TIME_SHARE = 0.5;

const RANK: Record<TimeState, number> = { avoided: 0, neutral: 1, preferred: 2 };
export const betterState = (a: TimeState, b: TimeState) => RANK[a] > RANK[b];

/** The effective timing of a task: its own, else its work item's (never merged). */
export function effectiveTiming(
  task: Pick<Task, "timing"> | undefined,
  item: Pick<WorkItem, "timing"> | undefined,
): Timing | null {
  return readTiming(task?.timing) ?? readTiming(item?.timing);
}

export const rhythmTiming = (rhythm: Pick<Rhythm, "timing">) => readTiming(rhythm.timing);

/** Whether a range applies on this weekday. */
const onDay = (range: TimeWindow, weekday: number) => !range.days || range.days.includes(weekday);

/** A list's ranges on a day, merged and sorted; null when the list is not given. */
export function rangesOn(list: TimeWindow[] | undefined, day: string): Range[] | null {
  if (!list) return null;
  const weekday = weekdayOf(day);
  const ranges = list
    .filter((range) => onDay(range, weekday))
    .map((range) => ({
      start: istanbulInstant(day, range.from).getTime(),
      end:
        range.to === "24:00"
          ? istanbulInstant(shiftDay(day, 1)).getTime()
          : istanbulInstant(day, range.to).getTime(),
    }))
    .sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

/** Where the work may be on the day: its windows, or the whole day (null) without any. */
export const allowedOn = (timing: Timing | null, day: string) => rangesOn(timing?.windows, day);

/** Whether any window covers this weekday (a timing without windows covers every day). */
export function coversDay(timing: Timing | null, day: string): boolean {
  if (!timing?.windows) return true;
  const weekday = weekdayOf(day);
  return timing.windows.some((range) => onDay(range, weekday));
}

/** Minutes of `range` that fall in `ranges`. */
export function overlapMinutes(ranges: Range[], range: Range): number {
  let total = 0;
  for (const piece of ranges) {
    total += Math.max(0, Math.min(piece.end, range.end) - Math.max(piece.start, range.start));
  }
  return total / 60_000;
}

/** Avoided if half the work falls in an avoided range; else preferred if half is preferred. */
export function timeState(timing: Timing | null, work: Range, day: string): TimeState {
  if (!timing) return "neutral";
  const length = (work.end - work.start) / 60_000;
  if (length <= 0) return "neutral";
  const avoid = rangesOn(timing.avoid, day);
  if (avoid && overlapMinutes(avoid, work) >= length * TIME_SHARE) return "avoided";
  const prefer = rangesOn(timing.prefer, day);
  if (prefer && overlapMinutes(prefer, work) >= length * TIME_SHARE) return "preferred";
  return "neutral";
}

/** The travel of a piece of work on this device: none when the device is in its context. */
export function travelOf(
  timing: Timing | null,
  context: Context,
  device: Context,
): { before: number; after: number } {
  if (!timing?.travel || context === device) return { before: 0, after: 0 };
  return { before: timing.travel.before ?? 0, after: timing.travel.after ?? 0 };
}

/**
 * How many more times a rhythm can be done in the days from `day` to `to`: on the days its
 * windows cover, once a day, `rest_days` apart after each doing (rule 7). Without timing it is
 * the number of days left.
 */
export function reachableCount(
  timing: Timing | null,
  day: string,
  to: string,
  lastDone: string | null,
): number {
  const rest = timing?.rest_days ?? 0;
  let next = lastDone && rest > 0 ? shiftDay(lastDone, rest + 1) : day;
  let count = 0;
  for (let current = day; current <= to; current = shiftDay(current, 1)) {
    if (current < next || !coversDay(timing, current)) continue;
    count++;
    next = shiftDay(current, rest + 1);
  }
  return count;
}
