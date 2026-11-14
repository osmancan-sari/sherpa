import { z } from "zod";
import type { DayType } from "@/core/types";

// The day's frame settings (docs/03-veri-modeli.md, `settings.day_frame`): the waking and
// bedtime ranges, the sleep target, ranges per day type, and whether "Uyandım" starts the first
// routine. One schema for the stored value and the settings form. Pure.

export type ClockRange = [string, string];

export type FrameSettings = {
  /** "HH:mm" in Istanbul; from before to, inside one day. */
  wake: ClockRange;
  /** "HH:mm"; may run past midnight (a time before 12:00 is on the next calendar day). */
  bed: ClockRange;
  sleepMinutes: number;
  byDayType: Partial<Record<DayType, { wake?: ClockRange; bed?: ClockRange }>>;
  startOnWake: boolean;
  /** Ç3f: the chain's next work starts when one ends with Bitti or Ertele. On unless said off. */
  chainAuto: boolean;
};

/** What the user said (12 Nov 2026): wake 06:00–09:00, bed 22:00–01:00, eight hours. */
export const DEFAULT_FRAME: FrameSettings = {
  wake: ["06:00", "09:00"],
  bed: ["22:00", "01:00"],
  sleepMinutes: 480,
  byDayType: {},
  startOnWake: false,
  chainAuto: true,
};

export const SLEEP_MIN = 240;
export const SLEEP_MAX = 720;

const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** Minutes after midnight of "HH:mm". */
export const clockOf = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

/** Minutes of a bedtime counted from the noon before: 22:00 is 600, 01:00 is 780. */
export const nightOf = (time: string) => {
  const minutes = clockOf(time);
  return minutes < 12 * 60 ? minutes + 24 * 60 - 12 * 60 : minutes - 12 * 60;
};

const clock = z.string().regex(CLOCK, "HH:mm");

const wakeRange = z
  .tuple([clock, clock])
  .refine(([from, to]) => clockOf(from) < clockOf(to), "from must be before to");

const bedRange = z
  .tuple([clock, clock])
  .refine(([from, to]) => nightOf(from) < nightOf(to), "from must be before to (night time)");

const ranges = z.strictObject({ wake: wakeRange.optional(), bed: bedRange.optional() });

export const frameSchema = z.strictObject({
  wake: wakeRange,
  bed: bedRange,
  sleep_minutes: z.number().int().min(SLEEP_MIN).max(SLEEP_MAX),
  by_day_type: z
    .strictObject({ home: ranges.optional(), office: ranges.optional(), campus: ranges.optional() })
    .optional(),
  start_on_wake: z.boolean().optional(),
  chain_auto: z.boolean().optional(),
});

export type StoredFrame = z.infer<typeof frameSchema>;

export type FrameIssue = { path: string[]; message: string };

function fromStored(stored: StoredFrame): FrameSettings {
  const byDayType: FrameSettings["byDayType"] = {};
  for (const [type, value] of Object.entries(stored.by_day_type ?? {})) {
    if (!value || (!value.wake && !value.bed)) continue;
    byDayType[type as DayType] = {
      ...(value.wake ? { wake: value.wake } : {}),
      ...(value.bed ? { bed: value.bed } : {}),
    };
  }
  return {
    wake: stored.wake,
    bed: stored.bed,
    sleepMinutes: stored.sleep_minutes,
    byDayType,
    startOnWake: stored.start_on_wake ?? false,
    chainAuto: stored.chain_auto ?? true,
  };
}

/** The value as it is stored (snake case, empty parts left out). */
export function toStoredFrame(frame: FrameSettings): StoredFrame {
  const byDayType = Object.fromEntries(
    Object.entries(frame.byDayType).filter(([, value]) => value && (value.wake || value.bed)),
  );
  return {
    wake: frame.wake,
    bed: frame.bed,
    sleep_minutes: frame.sleepMinutes,
    ...(Object.keys(byDayType).length > 0 ? { by_day_type: byDayType } : {}),
    ...(frame.startOnWake ? { start_on_wake: true } : {}),
    // On is the default: only "off" is written.
    ...(frame.chainAuto ? {} : { chain_auto: false }),
  };
}

/** Checks a value for saving; the issues name the field (`wake`, `by_day_type.office.bed`). */
export function checkFrame(value: unknown): { frame: FrameSettings | null; issues: FrameIssue[] } {
  const parsed = frameSchema.safeParse(value);
  if (!parsed.success) {
    return {
      frame: null,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String),
        message: issue.message,
      })),
    };
  }
  return { frame: fromStored(parsed.data), issues: [] };
}

/**
 * The stored value read for planning. Null (or nothing) is "the frame is off". A value that
 * does not pass the schema is read as the defaults: the frame was meant to be on, and the
 * planner never fails on a bad row.
 */
export function readFrame(value: unknown): FrameSettings | null {
  if (value === null || value === undefined) return null;
  const parsed = frameSchema.safeParse(value);
  return parsed.success ? fromStored(parsed.data) : DEFAULT_FRAME;
}

/** The waking and bedtime ranges that hold on a day of this type. */
export function rangesFor(
  frame: FrameSettings,
  dayType: DayType,
): { wake: ClockRange; bed: ClockRange } {
  const own = frame.byDayType[dayType];
  return { wake: own?.wake ?? frame.wake, bed: own?.bed ?? frame.bed };
}
