import { type ClockRange, clockOf, type FrameSettings, rangesFor } from "@/core/contract/frame";
import { readTiming } from "@/core/contract/timing";
import type { Block, DayRow } from "@/core/types";
import { istanbulInstant, shiftDay, weekdayOf } from "@/lib/date";
import { candidatesOf } from "./candidates";
import { dayCapacity, dayTypeOf } from "./slots";
import type { Candidate, DayFrame, PlanInput, PlannerSettings, SleepPlan } from "./types";

// The day's frame (docs/04-planlayici.md, "Günün çerçevesi (Ç3c)"): the sleep plan of each
// night, the waking the day is planned with, where each day's work starts. Pure: the rows and
// "now" come in, dates come out.

const MINUTE = 60_000;
/** The waking is pulled earlier in steps of this many minutes. */
export const WAKE_STEP = 15;
/** The morning state lasts this long past the end of the waking range. */
export const MORNING_GRACE = 60;
/** Days ahead whose start the frame works out (the rest start at the waking range's end). */
const DAYS_AHEAD = 8;

/** A bedtime of the night after `day`: a time before noon is on the next calendar day. */
export function bedInstant(day: string, time: string): Date {
  return clockOf(time) < 12 * 60
    ? istanbulInstant(shiftDay(day, 1), time)
    : istanbulInstant(day, time);
}

const later = (a: Date, b: Date) => (a > b ? a : b);
const earlier = (a: Date, b: Date) => (a < b ? a : b);
const plus = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE);
const minutesBetween = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / MINUTE);

export type SleepArgs = {
  /** The morning's day. */
  day: string;
  /** The waking range of the day. */
  wake: ClockRange;
  /** The bedtime range of the night before it. */
  bed: ClockRange;
  sleepMinutes: number;
  /** The day's first fixed obligation: its first block's start minus its travel. */
  obligation: Date | null;
  /** Minutes of the day's wake-bound work. */
  footprint: number;
  /** Minutes the day must hold: its mandatory work and its part of the week's share. */
  load: number;
  /** The day's capacity in minutes when its work starts at this moment. */
  capacityAt: (workStart: Date) => number;
  /** The night's bedtime: recorded, or the user's own value for it. */
  bedAt?: Date | null;
  /** The user's own waking for the day ("yarın erken kalkacağım"). */
  expectedWake?: Date | null;
};

/** One night and the morning after it (docs/04-planlayici.md, "Uyku planı"). */
export function sleepPlan(args: SleepArgs): SleepPlan {
  const wakeStart = istanbulInstant(args.day, args.wake[0]);
  const wakeEnd = istanbulInstant(args.day, args.wake[1]);
  const night = shiftDay(args.day, -1);
  const bedStart = bedInstant(night, args.bed[0]);
  const bedEnd = bedInstant(night, args.bed[1]);
  const target = args.sleepMinutes;
  const clampBed = (instant: Date) => earlier(later(instant, bedStart), bedEnd);

  // 1. The latest waking: the first obligation less the morning's work; never past the range.
  let latestWake = wakeEnd;
  if (args.obligation) latestWake = earlier(latestWake, plus(args.obligation, -args.footprint));

  let wake: Date;
  if (args.expectedWake) {
    // 6. The user's own waking comes before the load.
    wake = args.expectedWake;
  } else {
    // 2–3. Pulled earlier while the load does not fit, but never so far that bed would have
    // to leave its range: sleep is not given up for work.
    const floor = later(wakeStart, plus(bedStart, target));
    wake = latestWake;
    while (
      args.load > args.capacityAt(plus(wake, args.footprint)) &&
      plus(wake, -WAKE_STEP) >= floor
    ) {
      wake = plus(wake, -WAKE_STEP);
    }
  }
  // 4. Bed: the waking less the target, inside its range.
  const bed = clampBed(plus(wake, -target));

  // 5. A real bedtime moves the morning: never before the range, never past the latest waking.
  let expectedWake = wake;
  if (args.bedAt && !args.expectedWake) {
    expectedWake = earlier(latestWake, later(wakeStart, plus(args.bedAt, target)));
  }
  const sleepMinutes = minutesBetween(args.bedAt ?? bed, expectedWake);
  let short: SleepPlan["short"] = null;
  if (sleepMinutes < target) {
    if (args.expectedWake) short = "early_wake";
    else if (args.bedAt && plus(args.bedAt, target) > latestWake) short = "late_bed";
    else short = "obligation";
  }
  return { latestWake, wake, bed, expectedWake, sleepMinutes, short };
}

/** The first fixed obligation of a day: the earliest block that starts on it, less its travel. */
export function firstObligation(blocks: Block[], day: string): Date | null {
  const start = istanbulInstant(day).getTime();
  const end = istanbulInstant(shiftDay(day, 1)).getTime();
  let first: number | null = null;
  for (const block of blocks) {
    if (block.status === "cancelled") continue;
    const at = Date.parse(block.starts_at);
    if (at < start || at >= end) continue;
    const leave = at - block.travel_before_min * MINUTE;
    if (first === null || leave < first) first = leave;
  }
  return first === null ? null : new Date(first);
}

/** Wake-bound or bed-bound candidates, in their order: `order` first (none last), then score. */
export function anchoredIn(candidates: Candidate[], anchor: "wake" | "bed"): Candidate[] {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.timing?.anchor === anchor)
    .sort(
      (a, b) =>
        (a.candidate.timing?.order ?? Number.MAX_SAFE_INTEGER) -
          (b.candidate.timing?.order ?? Number.MAX_SAFE_INTEGER) || a.index - b.index,
    )
    .map(({ candidate }) => candidate);
}

const sumMinutes = (list: Candidate[]) => list.reduce((sum, row) => sum + row.minutes, 0);

/**
 * Minutes a day must hold for the sleep plan: its mandatory work (not anchored) and its part of
 * what is left of the week's committed shares, spread evenly over the week's days left.
 */
export function dayLoad(input: PlanInput, candidates: Candidate[]): number {
  const mandatory = sumMinutes(
    candidates.filter((row) => row.mandatory !== null && !row.timing?.anchor),
  );
  let share = 0;
  for (const id of input.committed ?? []) {
    const item = input.workItems.find((row) => row.id === id);
    const part = input.shares?.[id];
    if (!item || item.status !== "active" || !part) continue;
    share += Math.max(0, part.minutes - (item.effort_done_minutes - part.from));
  }
  return mandatory + share / (8 - weekdayOf(input.date));
}

/** A rough morning footprint for a day further ahead: its wake-bound rhythms and tasks. */
function roughFootprint(input: PlanInput, day: string): number {
  const active = new Set(input.modules.map((mod) => mod.id));
  let total = 0;
  for (const rhythm of input.rhythms) {
    if (!rhythm.active || !active.has(rhythm.module_id)) continue;
    if (readTiming(rhythm.timing)?.anchor === "wake") total += Math.min(90, rhythm.est_minutes);
  }
  for (const task of input.tasks) {
    if (task.status !== "todo" || !active.has(task.module_id)) continue;
    if (task.planned_date !== null && task.planned_date !== day) continue;
    if (readTiming(task.timing)?.anchor === "wake") total += task.est_minutes;
  }
  return total;
}

/** What the days row tells the frame. */
export type FrameDay = Pick<
  DayRow,
  "date" | "woke_at" | "woke_estimated" | "bed_at" | "expected_wake" | "expected_bed"
>;

const clockText = (time: string | null | undefined) =>
  time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : null;

/** The input of another day, made from this day's (tomorrow's plan, the sleep plan's load). */
export function inputFor(base: PlanInput, day: string, start: Date): PlanInput {
  if (day === base.date) return { ...base, dayStart: start };
  return {
    ...base,
    date: day,
    dayType: dayTypeOf(day, base.blocks, base.settings),
    dayStart: start,
    finishLine: istanbulInstant(day, base.settings.finishLine),
    closed: false,
    top3: undefined,
    skipped: [],
    openSession: null,
    prompt: null,
    startedToday: false,
    advice: undefined,
    frame: undefined,
  };
}

/**
 * The frame of the input's day, and where each day's work starts from it (for the day
 * capacities): today from its waking, tomorrow from its expected waking, the days after from
 * their latest waking (the load's pull is not worked out that far).
 */
export function dayFrameOf(
  base: PlanInput,
  frame: FrameSettings,
  days: FrameDay[],
): { frame: DayFrame; dayStarts: Record<string, number> } {
  const { settings } = base;
  const rowOf = (day: string) => days.find((row) => row.date === day) ?? null;
  const typeOf = (day: string) => dayTypeOf(day, base.blocks, settings);
  const rangesOn = (day: string) => rangesFor(frame, typeOf(day));

  /** The sleep plan of the night before `day`, and the day's morning footprint. */
  const nightBefore = (day: string) => {
    const before = shiftDay(day, -1);
    const wakeRange = rangesOn(day).wake;
    const dayInput = inputFor(base, day, istanbulInstant(day, wakeRange[1]));
    const { candidates } = candidatesOf(dayInput);
    const footprint = sumMinutes(anchoredIn(candidates, "wake"));
    const own = rowOf(day);
    const night = rowOf(before);
    const ownWake = clockText(own?.expected_wake);
    const bedText = clockText(night?.expected_bed);
    const bedAt = night?.bed_at
      ? new Date(night.bed_at)
      : bedText
        ? bedInstant(before, bedText)
        : null;
    const plan = sleepPlan({
      day,
      wake: wakeRange,
      bed: rangesOn(before).bed,
      sleepMinutes: frame.sleepMinutes,
      obligation: firstObligation(base.blocks, day),
      footprint,
      load: dayLoad(dayInput, candidates),
      capacityAt: (start) =>
        dayCapacity(
          day,
          base.blocks,
          { ...settings, dayStarts: { [day]: start.getTime() } },
          base.stats,
        ),
      bedAt,
      expectedWake: ownWake ? istanbulInstant(day, ownWake) : null,
    });
    return { plan, footprint };
  };

  const date = base.date;
  const tomorrow = shiftDay(date, 1);
  const own = rowOf(date);
  const last = nightBefore(date);
  const next = nightBefore(tomorrow);
  const wake = own?.woke_at ? new Date(own.woke_at) : last.plan.expectedWake;
  const bedAt = own?.bed_at ? new Date(own.bed_at) : null;
  const bedText = clockText(own?.expected_bed);
  const bed = bedAt ?? (bedText ? bedInstant(date, bedText) : next.plan.bed);
  const ranges = rangesOn(date);

  const dayStarts: Record<string, number> = {
    [date]: plus(wake, last.footprint).getTime(),
    [tomorrow]: plus(next.plan.expectedWake, next.footprint).getTime(),
  };
  for (let index = 2; index < DAYS_AHEAD; index++) {
    const day = shiftDay(date, index);
    const footprint = roughFootprint(base, day);
    let start = istanbulInstant(day, rangesOn(day).wake[1]);
    const obligation = firstObligation(base.blocks, day);
    if (obligation) start = earlier(start, plus(obligation, -footprint));
    dayStarts[day] = plus(start, footprint).getTime();
  }

  return {
    frame: {
      wake,
      woke: own?.woke_at != null,
      estimated: own?.woke_estimated ?? false,
      bed,
      bedAt,
      bedEnd: bedInstant(date, ranges.bed[1]),
      morningUntil: plus(istanbulInstant(date, ranges.wake[1]), MORNING_GRACE),
      lastNight: last.plan,
      tonight: next.plan,
    },
    dayStarts,
  };
}

/** The clock time the night ends by (with `NIGHT_ENDS`): the waking range's start, or the day's. */
export function dayStartClock(settings: PlannerSettings): string {
  return settings.frame ? settings.frame.wake[0] : settings.dayStart;
}
