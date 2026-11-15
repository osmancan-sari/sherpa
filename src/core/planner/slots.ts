import { clockOf, DEFAULT_FRAME, readFrame } from "@/core/contract/frame";
import type { Block, DayType, Settings } from "@/core/types";
import { istanbulInstant, shiftDay } from "@/lib/date";
import { overlapMinutes, type Range } from "./timing";
import type { PlannerSettings, PlannerStat, Slot, SlotKind } from "./types";

// Slots: the free time of a day cut into pieces of work (docs/04-planlayici.md, "Gün nasıl
// kurulur", steps 1–4).

const MINUTE = 60_000;

export const DEFAULT_SETTINGS: PlannerSettings = {
  dayStart: "08:00",
  bedtime: DEFAULT_FRAME.bed[0],
  capacityFactors: { home: 0.7, office: 0.4, campus: 0.5 },
  slot: { deepMin: 45, deepMax: 90, lightMin: 15, breakMin: 15 },
  defaultDayType: "home",
  returnAfterDays: 3,
  frame: null,
};

/** A learned value is used only once this many samples are behind it. */
export const MIN_SAMPLES = 5;

const hhmm = (time: string | null | undefined, fallback: string) =>
  time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : fallback;

const num = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;

/** The settings row with every missing or broken value replaced by its default. */
export function plannerSettings(row: Settings | null | undefined): PlannerSettings {
  if (!row) return DEFAULT_SETTINGS;
  const factors = (row.capacity_factors ?? {}) as Record<string, unknown>;
  const slot = (row.slot ?? {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const frame = readFrame(row.day_frame);
  return {
    dayStart: hhmm(row.day_start_default, d.dayStart),
    // Ç4a: `finish_line_default` is not read; the day runs to the bedtime range's start.
    bedtime: frame ? frame.bed[0] : d.bedtime,
    capacityFactors: {
      home: num(factors.home, d.capacityFactors.home),
      office: num(factors.office, d.capacityFactors.office),
      campus: num(factors.campus, d.capacityFactors.campus),
    },
    slot: {
      deepMin: num(slot.deep_min, d.slot.deepMin),
      deepMax: num(slot.deep_max, d.slot.deepMax),
      lightMin: num(slot.light_min, d.slot.lightMin),
      breakMin: num(slot.break_min, d.slot.breakMin),
    },
    defaultDayType: row.default_day_type ?? d.defaultDayType,
    returnAfterDays: row.return_after_days ?? d.returnAfterDays,
    frame,
  };
}

/** A learned value, when enough samples stand behind it. */
export function learned(stats: PlannerStat[], key: string): number | null {
  const stat = stats.find((row) => row.key === key);
  return stat && stat.sample_size >= MIN_SAMPLES ? Number(stat.value) : null;
}

/** Share of the slot time that really gets worked on a day of this type. */
export function capacityFactor(
  dayType: DayType,
  settings: PlannerSettings,
  stats: PlannerStat[],
): number {
  return learned(stats, `capacity:${dayType}`) ?? settings.capacityFactors[dayType];
}

/** Blocks that are still on (not cancelled), widened by their travel time. */
export function busyRanges(blocks: Block[]): { start: number; end: number }[] {
  return blocks
    .filter((block) => block.status !== "cancelled")
    .map((block) => ({
      start: Date.parse(block.starts_at) - block.travel_before_min * MINUTE,
      end: Date.parse(block.ends_at) + block.travel_after_min * MINUTE,
    }))
    .sort((a, b) => a.start - b.start);
}

/** The window minus the busy ranges; gaps shorter than `minMinutes` are dropped. */
export function freeRanges(
  window: { start: number; end: number },
  busy: { start: number; end: number }[],
  minMinutes: number,
): { start: number; end: number }[] {
  const free: { start: number; end: number }[] = [];
  let cursor = window.start;
  for (const range of busy) {
    if (range.end <= cursor) continue;
    if (range.start >= window.end) break;
    if (range.start > cursor) free.push({ start: cursor, end: Math.min(range.start, window.end) });
    cursor = Math.max(cursor, range.end);
    if (cursor >= window.end) break;
  }
  if (cursor < window.end) free.push({ start: cursor, end: window.end });
  return free.filter((range) => (range.end - range.start) / MINUTE >= minMinutes);
}

const slotOf = (start: number, minutes: number, kind: SlotKind): Slot => ({
  start: new Date(start),
  end: new Date(start + minutes * MINUTE),
  minutes,
  kind,
  assignment: null,
});

/** The kind a piece of free time of this length is. */
export function kindOf(minutes: number, settings: PlannerSettings): SlotKind | null {
  if (minutes >= settings.slot.deepMin) return "deep";
  if (minutes >= settings.slot.lightMin) return "light";
  return null;
}

/**
 * One free range cut into slots: up to `deepMax` is one deep slot; a longer range gets deep
 * slots of `deepMax` with a break between them, and what is left at the end is a deep or a
 * light slot by its length.
 */
export function cutRange(range: { start: number; end: number }, settings: PlannerSettings): Slot[] {
  const { deepMax, breakMin } = settings.slot;
  const slots: Slot[] = [];
  let start = range.start;
  let left = Math.floor((range.end - range.start) / MINUTE);
  while (left > deepMax) {
    slots.push(slotOf(start, deepMax, "deep"));
    start += deepMax * MINUTE;
    left -= deepMax;
    const pause = Math.min(breakMin, left);
    if (pause >= breakMin) slots.push(slotOf(start, pause, "break"));
    start += pause * MINUTE;
    left -= pause;
  }
  const kind = kindOf(left, settings);
  if (kind) slots.push(slotOf(start, left, kind));
  return slots;
}

/** Every slot of a window, in time order. */
export function buildSlots(
  window: { start: Date; end: Date },
  blocks: Block[],
  settings: PlannerSettings,
): Slot[] {
  const span = { start: window.start.getTime(), end: window.end.getTime() };
  if (span.end <= span.start) return [];
  return freeRanges(span, busyRanges(blocks), settings.slot.lightMin).flatMap((range) =>
    cutRange(range, settings),
  );
}

export const slotMinutes = (slots: Slot[]) => slots.reduce((sum, slot) => sum + slot.minutes, 0);

/** A bedtime of the night after `day`: a time before noon is on the next calendar day. */
export function bedInstant(day: string, time: string): Date {
  return clockOf(time) < 12 * 60
    ? istanbulInstant(shiftDay(day, 1), time)
    : istanbulInstant(day, time);
}

/**
 * Where a day's work starts when the day itself is not being planned: what the frame worked out,
 * else the end of the waking range (with the frame) or the default start.
 */
export function dayStartOf(day: string, settings: PlannerSettings): Date {
  const own = settings.dayStarts?.[day];
  if (own !== undefined) return new Date(own);
  return istanbulInstant(day, settings.frame ? settings.frame.wake[1] : settings.dayStart);
}

/** Where a day's work ends (Ç4a): what the frame worked out, else the settings' bedtime. */
export function dayEndOf(day: string, settings: PlannerSettings): Date {
  const own = settings.dayEnds?.[day];
  return own !== undefined ? new Date(own) : bedInstant(day, settings.bedtime);
}

/** Slot minutes of a whole day, from its start to where its work ends, whatever the time now. */
export function wholeDaySlotMinutes(input: {
  date: string;
  dayStart: Date;
  dayEnd: Date;
  blocks: Block[];
  settings: PlannerSettings;
}): number {
  const start = istanbulInstant(input.date).getTime();
  const end = istanbulInstant(shiftDay(input.date, 1)).getTime();
  const ofDay = input.blocks.filter(
    (block) => Date.parse(block.starts_at) < end && Date.parse(block.ends_at) > start,
  );
  return slotMinutes(
    buildSlots({ start: input.dayStart, end: input.dayEnd }, ofDay, input.settings),
  );
}

/**
 * The day type of a day: what its blocks say, else the default (docs/03-veri-modeli.md,
 * "Türetilen değerler").
 */
export function dayTypeOf(day: string, blocks: Block[], settings: PlannerSettings): DayType {
  const start = istanbulInstant(day).getTime();
  const end = istanbulInstant(shiftDay(day, 1)).getTime();
  const typed = blocks.find(
    (block) =>
      block.status !== "cancelled" &&
      block.day_type !== null &&
      Date.parse(block.starts_at) < end &&
      Date.parse(block.ends_at) > start,
  );
  return typed?.day_type ?? settings.defaultDayType;
}

/**
 * Minutes of work a whole day holds: its slots between its start and where its work ends (Ç4a:
 * the bedtime, less the bed-bound work when the frame knows it), times the day type's capacity
 * factor. `from` cuts the start (today: now), `until` the end
 * (the day of a deadline).
 */
export function dayCapacity(
  day: string,
  blocks: Block[],
  settings: PlannerSettings,
  stats: PlannerStat[],
  bounds: { from?: Date; until?: Date } = {},
  /** Only the slot time inside these ranges (a work's windows); null for all of it. */
  allowed: Range[] | null = null,
): number {
  // With the day's frame the day starts where the frame says (its waking and morning work).
  // Days the frame did not work out start at the end of their waking range.
  const start = dayStartOf(day, settings);
  const end = dayEndOf(day, settings);
  const window = {
    start: bounds.from && bounds.from > start ? bounds.from : start,
    end: bounds.until && bounds.until < end ? bounds.until : end,
  };
  const slots = buildSlots(window, blocks, settings);
  const type = dayTypeOf(day, blocks, settings);
  const minutes = allowed
    ? slots.reduce(
        (sum, slot) =>
          sum + overlapMinutes(allowed, { start: slot.start.getTime(), end: slot.end.getTime() }),
        0,
      )
    : slotMinutes(slots);
  return minutes * capacityFactor(type, settings, stats);
}
