import { readTiming } from "@/core/contract/timing";
import type { Context } from "@/core/types";
import { blocksOfDay, currentBlock } from "@/core/today/select";
import { dayKey, formatDue, formatTime, istanbulInstant, shiftDay } from "@/lib/date";
import {
  availableUntil,
  buildCandidates,
  candidatesOf,
  compareScored,
  isReturning,
  shareWorked,
} from "./candidates";
import { buildSlots, capacityFactor, kindOf, slotMinutes } from "./slots";
import { anchoredIn, dayStartClock } from "./frame";
import { allowedOn, betterState, TIME_FACTOR, type TimeState, timeState } from "./timing";
import { weekNoTime } from "./week";
import type { Assignment, Candidate, NowState, Plan, PlanInput, Slot, Warning } from "./types";

// The day plan (docs/04-planlayici.md, "Gün nasıl kurulur"): slots, capacity, the mandatory
// work first, then the rest by score, the "now" state and at most two warnings. Pure: the same
// input always gives the same plan. Ç4a: the working window runs to the bedtime (less the
// bed-bound work), the plan is the day's rest; there are no three, no "vakit kalırsa", no evening.

const MINUTE = 60_000;
/** Before this hour a touch belongs to the night before, not to a new day. */
export const NIGHT_ENDS = "05:00";
/** At most this many warnings at a time (docs/04-planlayici.md, "Tek uyarı"). */
export const MAX_WARNINGS = 2;
/** Put off this many times, a task asks to be split, dropped or given a date. */
export const DEFER_LIMIT = 3;

/**
 * The day a moment belongs to for planning: before the night ends (05:00, or the day's start
 * if that is earlier) it is still the night of the day before.
 */
export function planningDay(now: Date, dayStart: string): string {
  const today = dayKey(now);
  const ends = istanbulInstant(today, dayStart < NIGHT_ENDS ? dayStart : NIGHT_ENDS);
  return now < ends ? shiftDay(today, -1) : today;
}

/**
 * The device context sees work of these contexts. The second screen is at the desk at home.
 * Ç4a: an unknown context (null) turns the filter off.
 */
export function contextFits(work: Context, device: Context | null): boolean {
  if (device === null || work === "any" || work === device) return true;
  return device === "desk" && work === "home";
}

/** Work with travel passes the context filter anywhere: the travel is the cost of going there. */
const travels = (candidate: Candidate) =>
  (candidate.travelBefore ?? 0) + (candidate.travelAfter ?? 0) > 0;

/**
 * The work is bound to its time: it has windows or travel, so where it lands inside a slot
 * and how far its footprint reaches matter (docs/04-planlayici.md, "Zaman kısıtları").
 */
const bound = (candidate: Candidate) => Boolean(candidate.timing?.windows) || travels(candidate);

/** The three filters: length, energy, context (docs/04-planlayici.md, "Süzgeçler"). */
export function fits(candidate: Candidate, slot: Slot, device: Context | null): boolean {
  if (candidate.minutes > slot.minutes) return false;
  if (!travels(candidate) && !contextFits(candidate.context, device)) return false;
  // Physical work (a run, a workout) is not desk work: it fits any slot it is short enough
  // for; a break takes it only when it is short (the length filter above).
  if (slot.kind === "deep") return true;
  if (slot.kind === "light") return candidate.energy !== "deep";
  return (
    candidate.energy === "physical" || (candidate.energy === "light" && candidate.minutes <= 15)
  );
}

/** Places work at the start of a slot; what is left of the slot stays a slot of its own. */
function place(slots: Slot[], index: number, assignment: Assignment, input: PlanInput): void {
  const slot = slots[index];
  const used = assignment.minutes;
  const rest = slot.minutes - used;
  const taken: Slot = {
    ...slot,
    end: new Date(slot.start.getTime() + used * MINUTE),
    minutes: used,
    assignment,
  };
  const pieces = [taken];
  const kind = slot.kind === "break" ? null : kindOf(rest, input.settings);
  if (kind) {
    pieces.push({ start: taken.end, end: slot.end, minutes: rest, kind, assignment: null });
  }
  slots.splice(index, 1, ...pieces);
}

/**
 * Where a piece of work with time constraints would go if its footprint started in this slot:
 * travel, work and travel. The work lies inside its windows; without travel it stays in the
 * slot, with travel the footprint may run on over the free slots and breaks right after it.
 */
type Spot = {
  index: number;
  /** The last slot the footprint reaches. */
  last: number;
  footStart: number;
  workStart: number;
  workEnd: number;
  footEnd: number;
  state: TimeState;
};

function energyFits(candidate: Candidate, slot: Slot): boolean {
  if (slot.kind === "deep") return true;
  if (slot.kind === "light") return candidate.energy !== "deep";
  return false;
}

function spotAt(
  slots: Slot[],
  index: number,
  candidate: Candidate,
  input: PlanInput,
  anyEnergy = false,
): Spot | null {
  const slot = slots[index];
  if (slot.assignment) return null;
  const minutes = candidate.minutes * MINUTE;
  if (!bound(candidate)) {
    const ok = anyEnergy
      ? slot.kind !== "break" &&
        slot.minutes >= candidate.minutes &&
        contextFits(candidate.context, input.context)
      : fits(candidate, slot, input.context);
    if (!ok) return null;
    const start = slot.start.getTime();
    return {
      index,
      last: index,
      footStart: start,
      workStart: start,
      workEnd: start + minutes,
      footEnd: start + minutes,
      state: timeState(candidate.timing ?? null, { start, end: start + minutes }, input.date),
    };
  }
  // A footprint never starts in a break; the 90-minute limit is on the work.
  if (slot.kind === "break" || candidate.minutes > input.settings.slot.deepMax) return null;
  if (!anyEnergy && !energyFits(candidate, slot)) return null;
  const before = (candidate.travelBefore ?? 0) * MINUTE;
  const after = (candidate.travelAfter ?? 0) * MINUTE;
  if (!travels(candidate) && !contextFits(candidate.context, input.context)) return null;
  // With travel the footprint may run over the free slots that follow without a gap.
  let last = index;
  if (travels(candidate)) {
    while (
      last + 1 < slots.length &&
      !slots[last + 1].assignment &&
      slots[last + 1].start.getTime() === slots[last].end.getTime()
    ) {
      last++;
    }
  }
  const start = slot.start.getTime();
  const end = slot.end.getTime();
  const limit = travels(candidate) ? slots[last].end.getTime() : end;
  const allowed = allowedOn(candidate.timing ?? null, input.date) ?? [
    { start: -Infinity, end: Infinity },
  ];
  for (const range of allowed) {
    const workStart = Math.max(start + before, range.start);
    const footStart = workStart - before;
    if (footStart >= end) continue;
    const workEnd = workStart + minutes;
    const footEnd = workEnd + after;
    if (workEnd > range.end || footEnd > limit) continue;
    let reach = index;
    while (reach < last && slots[reach + 1].start.getTime() < footEnd) reach++;
    return {
      index,
      last: reach,
      footStart,
      workStart,
      workEnd,
      footEnd,
      state: timeState(candidate.timing ?? null, { start: workStart, end: workEnd }, input.date),
    };
  }
  return null;
}

/** Every free slot the work could start in, in time order. */
function spotsOf(slots: Slot[], candidate: Candidate, input: PlanInput, anyEnergy = false): Spot[] {
  return slots.flatMap((_, index) => spotAt(slots, index, candidate, input, anyEnergy) ?? []);
}

/** The earliest of the spots in the best time state. */
function bestSpot(spots: Spot[]): Spot | null {
  let best: Spot | null = null;
  for (const spot of spots) if (!best || betterState(spot.state, best.state)) best = spot;
  return best;
}

/**
 * Places work at a spot. The slots its footprint covers are closed; what is left before the
 * footprint and after it stays a slot of its own (a break's rest is dropped). The travel's time
 * is in no slot: it goes to no other work. Returns whether a piece was kept before the work.
 */
function placeAt(slots: Slot[], spot: Spot, assignment: Assignment, input: PlanInput): boolean {
  const first = slots[spot.index];
  const last = slots[spot.last];
  const pieces: Slot[] = [];
  const before = (spot.footStart - first.start.getTime()) / MINUTE;
  const kindBefore = first.kind === "break" ? null : kindOf(before, input.settings);
  if (before > 0 && kindBefore) {
    pieces.push({
      start: first.start,
      end: new Date(spot.footStart),
      minutes: before,
      kind: kindBefore,
      assignment: null,
    });
  }
  pieces.push({
    start: new Date(spot.workStart),
    end: new Date(spot.workEnd),
    minutes: assignment.minutes,
    kind: kindAt(slots, spot, first),
    assignment,
  });
  const rest = (last.end.getTime() - spot.footEnd) / MINUTE;
  const kindAfter = last.kind === "break" ? null : kindOf(rest, input.settings);
  if (kindAfter) {
    pieces.push({
      start: new Date(spot.footEnd),
      end: last.end,
      minutes: rest,
      kind: kindAfter,
      assignment: null,
    });
  }
  slots.splice(spot.index, spot.last - spot.index + 1, ...pieces);
  return pieces[0].assignment === null;
}

/** The kind of the slot the work starts in (travel may have filled the slot before it). */
function kindAt(slots: Slot[], spot: Spot, first: Slot): Slot["kind"] {
  for (let index = spot.index; index <= spot.last; index++) {
    const slot = slots[index];
    if (slot.start.getTime() <= spot.workStart && spot.workStart < slot.end.getTime()) {
      return slot.kind === "break" ? first.kind : slot.kind;
    }
  }
  return first.kind;
}

/** The assignment of work at a spot: its travel rides along when it has any. */
function assignmentAt(candidate: Candidate, input: PlanInput): Assignment {
  const assignment: Assignment = {
    candidate,
    minutes: candidate.minutes,
    reasons: engineReasons(candidate, input),
  };
  if (travels(candidate)) {
    assignment.travelBefore = candidate.travelBefore ?? 0;
    assignment.travelAfter = candidate.travelAfter ?? 0;
  }
  return assignment;
}

function engineReasons(candidate: Candidate, input: PlanInput): string[] {
  const reasons: string[] = [];
  if (candidate.mandatory === "due_today") reasons.push("Son tarihi bugün.");
  if (candidate.mandatory === "urgent" && candidate.dueAt) {
    reasons.push(`Son tarih ${formatDue(candidate.dueAt, input.now)}; bugün başlanmazsa yetişmez.`);
  }
  if (candidate.mandatory === "floor") reasons.push("Haftalık taban tehlikede.");
  if (!candidate.mandatory && candidate.dueAt) {
    reasons.push(`Son tarih ${formatDue(candidate.dueAt, input.now)}.`);
  }
  if (candidate.type === "rhythm" && candidate.progress) {
    reasons.push(`Bu dönem ${candidate.progress}.`);
  }
  if (candidate.type === "follow_up") reasons.push("Takip günü geldi.");
  const ai = input.advice?.reasons?.[candidate.id];
  if (ai) reasons.push(ai);
  if (reasons.length === 0) reasons.push("Bugün için en uygun iş.");
  return reasons;
}

export function buildPlan(input: PlanInput, options: { warnings?: boolean } = {}): Plan {
  const { settings } = input;
  const found = candidatesOf(input);
  const { closed } = found;
  // Ç3g: without the frame an anchor still keeps its hour (docs/04-planlayici.md, "Çerçeve
  // kapalıyken çapalı iş"): wake-bound work at the day's set start, bed-bound work before the
  // bedtime; it is never spread over the day's slots.
  const unframed = input.frame ? [] : found.candidates.filter((row) => row.timing?.anchor);
  const candidates = input.frame
    ? found.candidates
    : found.candidates.filter((row) => !row.timing?.anchor);
  const anchored = input.frame ? found.anchored : unframed;
  const lines = input.frame ? framedLines(input, anchored) : unframedLines(input, anchored);
  let windowStart = input.now > input.dayStart ? input.now : input.dayStart;
  if (lines.workFrom && lines.workFrom > windowStart) windowStart = lines.workFrom;
  const slots = buildSlots(
    { start: windowStart, end: lines.workEnd },
    blocksOfDay(input.blocks, input.date),
    settings,
  );
  const usableMinutes = Math.round(
    slotMinutes(slots) * capacityFactor(input.dayType, settings, input.stats),
  );

  // The AI's advice that the windows do not allow today (rule 9): it is not followed.
  const advised = input.advice?.prefer ?? [];
  const outOfTime = advised.filter((id, at) => {
    if (advised.indexOf(id) !== at) return false;
    if (closed.some((row) => row.id === id)) return true;
    const candidate = candidates.find((row) => row.id === id);
    if (!candidate?.timing?.windows) return false;
    if (spotsOf(slots, candidate, input).length > 0) return false;
    // Mandatory work may go where its energy does not match; other work may not.
    return candidate.mandatory === null || spotsOf(slots, candidate, input, true).length === 0;
  });

  const placed = new Set<string>();
  let plannedMinutes = 0;
  /** Work with time constraints: the earliest of its best spots (rule 4). */
  const placeTimed = (candidate: Candidate, overCapacity: boolean): boolean => {
    let spots = spotsOf(slots, candidate, input);
    // Mandatory work goes in even where its energy does not match, never outside its time.
    if (spots.length === 0 && overCapacity) spots = spotsOf(slots, candidate, input, true);
    const spot = bestSpot(spots);
    if (!spot) return false;
    placeAt(slots, spot, assignmentAt(candidate, input), input);
    placed.add(candidate.id);
    plannedMinutes += candidate.minutes;
    return true;
  };
  const tryPlace = (candidate: Candidate, overCapacity: boolean): boolean => {
    if (placed.has(candidate.id)) return true;
    if (!overCapacity && plannedMinutes + candidate.minutes > usableMinutes) return false;
    if (candidate.timing && placeTimed(candidate, overCapacity)) return true;
    // Windows and travel are hard: such work goes nowhere else. Preferred and avoided hours
    // give way for mandatory work, as without them.
    if (bound(candidate) || (candidate.timing && !overCapacity)) return false;
    let index = slots.findIndex((slot) => !slot.assignment && fits(candidate, slot, input.context));
    // Mandatory work goes in even where its energy does not match, as long as it fits.
    if (index < 0 && overCapacity) {
      index = slots.findIndex(
        (slot) =>
          !slot.assignment &&
          slot.kind !== "break" &&
          slot.minutes >= candidate.minutes &&
          contextFits(candidate.context, input.context),
      );
    }
    // Mandatory work longer than any slot (its estimate times the learned multiplier) still
    // gets the longest deep slot: it is started today, and goes on in the next one.
    let minutes = candidate.minutes;
    if (index < 0 && overCapacity) {
      const deep = slots
        .map((slot, at) => ({ slot, at }))
        .filter(
          ({ slot }) =>
            !slot.assignment &&
            slot.kind === "deep" &&
            contextFits(candidate.context, input.context),
        )
        .sort((a, b) => b.slot.minutes - a.slot.minutes)[0];
      if (deep && deep.slot.minutes < candidate.minutes) {
        index = deep.at;
        minutes = deep.slot.minutes;
      }
    }
    if (index < 0) return false;
    place(slots, index, { candidate, minutes, reasons: engineReasons(candidate, input) }, input);
    placed.add(candidate.id);
    plannedMinutes += minutes;
    return true;
  };

  // 1. Mandatory work, by deadline, whatever the score; it may go past the capacity factor.
  const mandatory = candidates.filter((candidate) => candidate.mandatory !== null);
  for (const candidate of mandatory) tryPlace(candidate, true);

  // 2. Fill: each free slot in time order takes the best candidate that fits it. Work with
  // time constraints counts with its time factor here, and waits when a slot further on today
  // suits it better (rule 4).
  for (let index = 0; index < slots.length; index++) {
    const slot = slots[index];
    if (slot.assignment) continue;
    let best: { candidate: Candidate; spot: Spot | null; score: number } | null = null;
    for (const candidate of candidates) {
      if (placed.has(candidate.id)) continue;
      if (plannedMinutes + candidate.minutes > usableMinutes) continue;
      let spot: Spot | null = null;
      let score = candidate.score;
      if (candidate.timing) {
        spot = spotAt(slots, index, candidate, input);
        if (!spot) continue;
        if (candidate.timing.prefer || candidate.timing.avoid) {
          const later = bestSpot(
            spotsOf(slots, candidate, input).filter((other) => other.index > index),
          );
          if (later && betterState(later.state, spot.state)) continue;
        }
        score *= TIME_FACTOR[spot.state];
      } else if (!fits(candidate, slot, input.context)) continue;
      if (
        !best ||
        compareScored({ ...candidate, score }, { ...best.candidate, score: best.score }) < 0
      ) {
        best = { candidate, spot, score };
      }
    }
    if (!best) continue;
    if (!best.spot) {
      tryPlace(best.candidate, false);
      continue;
    }
    const keptBefore = placeAt(slots, best.spot, assignmentAt(best.candidate, input), input);
    placed.add(best.candidate.id);
    plannedMinutes += best.candidate.minutes;
    // The piece left before the work is a free slot again: look at it once more.
    if (keptBefore) index--;
  }

  // Anchored work at the waking and the bedtime (Ç3c, Ç3g), around the working window.
  const all = [...lines.wake, ...slots, ...lines.bed].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  return {
    date: input.date,
    slots: all,
    now: nowOf(input, all, lines.workEnd),
    warnings:
      options.warnings === false ? [] : warningsOf(input, candidates, placed, closed, outOfTime),
    usableMinutes,
    plannedMinutes,
    // Ç3g: every candidate of the day, anchored work without the frame included (as before).
    candidates: found.candidates,
    ...(input.frame
      ? {
          frame: {
            wake: input.frame.wake,
            workStart: input.dayStart,
            workEnd: lines.workEnd,
            bed: input.frame.bed,
          },
        }
      : {}),
  };
}

/** Minutes past its end the morning's line is still offered (Ç3c). */
export const WAKE_GRACE = 60;

/**
 * Ç3g: bed-bound work comes to "Şimdi" this many minutes before its place at the earliest (its
 * own length is in its place already): not hours before the bedtime. Until then the evening's
 * card says when; the work can be started from the list.
 */
export const BED_LEAD = 15;

/** An anchored work's slot at `start`. */
function lineSlot(input: PlanInput, candidate: Candidate, start: number, part: "wake" | "bed") {
  const slot: Slot = {
    start: new Date(start),
    end: new Date(start + candidate.minutes * MINUTE),
    minutes: candidate.minutes,
    kind: kindOf(candidate.minutes, input.settings) ?? "light",
    assignment: { candidate, minutes: candidate.minutes, reasons: engineReasons(candidate, input) },
    part,
  };
  return slot;
}

/** Back to back from `from`; kept while the line is not over by more than `grace` minutes. */
function lineOf(
  input: PlanInput,
  list: Candidate[],
  from: number,
  part: "wake" | "bed",
  grace = 0,
): Slot[] {
  const now = input.now.getTime();
  const slots: Slot[] = [];
  let cursor = from;
  for (const candidate of list) {
    const slot = lineSlot(input, candidate, cursor, part);
    cursor = slot.end.getTime();
    slots.push(slot);
  }
  return cursor + grace * MINUTE > now
    ? slots.filter((slot) => slot.end.getTime() > now || grace > 0)
    : [];
}

type Lines = { wake: Slot[]; bed: Slot[]; workFrom: Date | null; workEnd: Date };

/** Bed-bound work back to back, ending at the bedtime; the working window ends where it begins. */
function bedLine(input: PlanInput, anchored: Candidate[], bedtime: Date) {
  const bedWork = anchoredIn(anchored, "bed");
  const bedMinutes = bedWork.reduce((sum, candidate) => sum + candidate.minutes, 0);
  const bedFrom = bedtime.getTime() - bedMinutes * MINUTE;
  return { bed: lineOf(input, bedWork, bedFrom, "bed"), workEnd: new Date(bedFrom) };
}

/**
 * Ç3g: anchored work on a day without the frame. The waking is the day's set start (the
 * settings', not the first touch: a module switched on in the afternoon does not bring the
 * morning back), the bedtime is the default bedtime (Ç4a; before, the finish line). The working
 * window starts after the morning's line while it is offered and ends before the bed-bound work.
 */
function unframedLines(input: PlanInput, anchored: Candidate[]): Lines {
  const wakeAt = istanbulInstant(input.date, input.settings.dayStart).getTime();
  const wake = lineOf(input, anchoredIn(anchored, "wake"), wakeAt, "wake", WAKE_GRACE);
  const wakeEnd = wake.length > 0 ? wake[wake.length - 1].end : null;
  return { wake, ...bedLine(input, anchored, input.bedtime), workFrom: wakeEnd };
}

/**
 * The parts of a framed day outside its working window (docs/04-planlayici.md, "Günün
 * çerçevesi"): wake-bound work one after another from the waking, bed-bound work ending at the
 * expected bedtime; the working window (from `dayStart`, which holds the morning's work) ends
 * where the bed-bound work begins (Ç4a: no finish line, no evening). Anchored work whose time
 * has gone by is left out: a missed routine is not offered all day.
 */
function framedLines(input: PlanInput, anchored: Candidate[]): Lines {
  const frame = input.frame!;
  // A morning said late ("Biraz önce: 30 dk") still gets its routine: the line stays offered
  // until an hour after it would have ended.
  const wakeWork = anchoredIn(anchored, "wake");
  const wake = lineOf(input, wakeWork, frame.wake.getTime(), "wake", WAKE_GRACE);
  return { wake, ...bedLine(input, anchored, frame.bed), workFrom: null };
}

/**
 * Ç4a: the day had work to finish: a task done, dropped or put off today, or a work item or
 * rhythm put off today ("Ertele", `skippedToday`); a rhythm done today that is not bound to the
 * waking or the bedtime. With nothing of it left in the plan the day is done ("Bugün tamam"),
 * else it is empty. What the evening closing took out of the day (also kept as skipped) is not
 * work the day had.
 */
function dayHadWork(input: PlanInput): boolean {
  const today = (stamp: string | null | undefined) =>
    stamp !== null && stamp !== undefined && dayKey(new Date(stamp)) === input.date;
  if ((input.skippedToday ?? input.skipped ?? []).length > 0) return true;
  for (const task of input.tasks) {
    if (task.status === "done" && today(task.done_at)) return true;
    if (task.status === "dropped" && today(task.updated_at)) return true;
    if (
      task.status === "todo" &&
      task.defer_count > 0 &&
      task.planned_date !== null &&
      task.planned_date > input.date &&
      today(task.updated_at)
    ) {
      return true;
    }
  }
  const loose = new Set(
    input.rhythms.filter((rhythm) => !readTiming(rhythm.timing)?.anchor).map((rhythm) => rhythm.id),
  );
  return input.rhythmLogs.some((log) => log.done_on === input.date && loose.has(log.rhythm_id));
}

function nowOf(input: PlanInput, slots: Slot[], workEnd: Date): NowState {
  const session = input.openSession ?? null;
  if (session) {
    return {
      kind: "running",
      session,
      task: input.tasks.find((task) => task.id === session.task_id) ?? null,
      rhythm: input.rhythms.find((rhythm) => rhythm.id === session.rhythm_id) ?? null,
    };
  }
  const block = currentBlock(input.blocks, input.now);
  if (block) return { kind: "block", block };
  // The night ends at 05:00, or earlier when the day (or its waking range) starts earlier.
  const start = dayStartClock(input.settings);
  const nightEnds = istanbulInstant(input.date, start < NIGHT_ENDS ? start : NIGHT_ENDS);
  if (input.now < nightEnds) return { kind: "night" };
  const frame = input.frame;
  const parted = (part: "wake" | "bed") => (slot: Slot) =>
    slot.part === part && slot.assignment !== null && slot.end > input.now;
  // Ç3g: bed-bound work is offered from shortly before its place on (BED_LEAD).
  const bedDue = (slot: Slot) =>
    parted("bed")(slot) && input.now.getTime() >= slot.start.getTime() - BED_LEAD * MINUTE;
  if (frame) {
    // Ç3c: night comes with bed, or once the bedtime range is over; the evening before it, once
    // the working window is over (Ç4a: where the bed-bound work begins), the day was closed, or
    // the bedtime range has begun and nothing of the working window is left in the plan.
    if (frame.bedAt || input.now >= frame.bedEnd) return { kind: "night" };
    const workLeft = slots.some((slot) => slot.part === undefined && slot.assignment);
    const lateAndDone = !workLeft && frame.bedStart !== undefined && input.now >= frame.bedStart;
    if (input.closed || input.now >= workEnd || lateAndDone) {
      const next = slots.find(bedDue)?.assignment;
      const waiting = next ? undefined : slots.find((slot) => parted("bed")(slot));
      return {
        kind: "evening",
        next: next ?? null,
        closed: Boolean(input.closed),
        later: waiting?.assignment ? { assignment: waiting.assignment, at: waiting.start } : null,
      };
    }
    if (!frame.woke && input.now < frame.morningUntil) {
      return { kind: "morning", first: slots.find(parted("wake"))?.assignment ?? null };
    }
  } else if (input.closed || input.now >= input.bedtime) return { kind: "night" };

  // The working window's work still ahead (Ç4a: the plan is the day's rest).
  const loose = slots.find((slot) => slot.part === undefined && slot.assignment)?.assignment;
  if (isReturning(input)) return { kind: "return", next: loose ?? null };
  if (input.prompt) return { kind: "prompt", prompt: input.prompt };

  // A work item whose effort is used up asks "Bitti mi?" in its own slot, in time order (Ç4a:
  // while it is in the plan the day is not done).
  const finishedToday = input.tasks.filter(
    (task) =>
      task.status === "done" &&
      task.done_at !== null &&
      dayKey(new Date(task.done_at)) === input.date,
  );
  // Ç4a: "Bugün tamam" once no work of the working window is left in the plan (done, put off or
  // dropped) and none that is left fits what is left of the window: the plan is made again
  // every minute, so nothing placed means nothing fits. Work bound to the waking or the bedtime
  // is not waited for; the evening comes at its own time.
  if (!loose && dayHadWork(input)) {
    return {
      kind: "done",
      finished: finishedToday.length,
      minutes: finishedToday.reduce((sum, task) => sum + task.est_minutes, 0),
    };
  }
  // The next work in time order. Work bound to its time (windows, travel) is offered when its
  // footprint starts, the time to set off; before that the card says when (`at`).
  const next = slots.find(
    (slot) => slot.assignment && (slot.part === undefined || slot.part === "wake" || bedDue(slot)),
  );
  if (next?.assignment) {
    const footStart = next.start.getTime() - (next.assignment.travelBefore ?? 0) * MINUTE;
    if (bound(next.assignment.candidate) && footStart > input.now.getTime()) {
      return { kind: "suggest", assignment: next.assignment, at: new Date(footStart) };
    }
    return { kind: "suggest", assignment: next.assignment };
  }
  return { kind: "empty" };
}

/**
 * At most two, in order: a deadline that will not be met, no time left today (or this week), a
 * floor in danger, no next step, rejected advice, work put off too often. Ç4a: "Saatleri bitiş
 * çizgisinden sonra" is gone with the finish line.
 */
function warningsOf(
  input: PlanInput,
  candidates: Candidate[],
  placed: Set<string>,
  closed: Candidate[] = [],
  outOfTime: string[] = [],
): Warning[] {
  const warnings: Warning[] = [];
  const titleOf = (id: string) => candidates.find((row) => row.id === id)?.title ?? "";

  // A deadline that the time left cannot hold (work closed today by its windows included).
  const seen = new Set<string>();
  for (const candidate of [...candidates, ...closed]) {
    if (candidate.dueAt === null || candidate.type === "rhythm") continue;
    // Closed today and due today: "no time left today" says it.
    if (closed.includes(candidate) && candidate.mandatory === "due_today") continue;
    const due = new Date(candidate.dueAt);
    if (due.getTime() < input.now.getTime()) continue;
    const key = candidate.item?.id ?? candidate.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const item = candidate.item;
    const left =
      item && item.effort_total_minutes !== null
        ? item.effort_total_minutes - item.effort_done_minutes
        : candidate.minutes;
    if (left > availableUntil(input, due, candidate.timing ?? null)) {
      warnings.push({
        kind: "deadline",
        subjectId: key,
        text: `${item?.title ?? candidate.title}: ${formatDue(due, input.now)} için kalan süre yetmiyor.`,
      });
    }
  }

  // Mandatory work whose windows leave no room today is not placed outside them (rule 9).
  for (const candidate of [...closed, ...candidates]) {
    if (candidate.mandatory !== "due_today" && candidate.mandatory !== "urgent") continue;
    if (placed.has(candidate.id)) continue;
    if (!closed.includes(candidate) && !bound(candidate)) continue;
    warnings.push({
      kind: "no_time_today",
      subjectId: candidate.id,
      text: `Bugün uygun saat kalmadı: ${candidate.title}.`,
    });
  }

  // The week's committed or due work, and floors, whose windows the rest of the week cannot
  // hold (rule 8).
  const week = weekNoTime({
    now: input.now > input.dayStart ? input.now : input.dayStart,
    weekStart: input.date,
    items: input.workItems,
    tasks: input.tasks,
    rhythms: input.rhythms,
    modules: input.modules,
    blocks: input.blocks,
    settings: input.settings,
    stats: input.stats,
    committed: input.committed ?? null,
    shares: input.shares,
    rhythmLogs: input.rhythmLogs,
  });
  // One warning per piece of work: a sitting's "no time today" already speaks for its item.
  const spoken = (id: string) =>
    warnings.some(
      (warning) =>
        warning.subjectId === id ||
        [...closed, ...candidates].some(
          (row) => row.id === warning.subjectId && row.item?.id === id,
        ),
    );
  for (const row of week) {
    if (spoken(row.id)) continue;
    warnings.push({
      kind: "no_time_week",
      subjectId: row.id,
      text: `Bu hafta uygun saat yok: ${row.title}.`,
      moduleId: row.moduleId,
    });
  }

  for (const candidate of candidates) {
    // A floor whose week has no time left for it is already spoken for.
    if (candidate.mandatory === "floor" && !placed.has(candidate.id) && !spoken(candidate.id)) {
      warnings.push({
        kind: "floor",
        subjectId: candidate.id,
        text: `${candidate.title}: haftalık taban tehlikede, bugün yer açılamadı.`,
      });
    }
  }

  // A committed item must always have its next sitting.
  for (const id of input.committed ?? []) {
    const item = input.workItems.find((row) => row.id === id);
    if (!item || item.status !== "active") continue;
    const left =
      item.effort_total_minutes === null ? 1 : item.effort_total_minutes - item.effort_done_minutes;
    if (left <= 0 || shareWorked(input, item)) continue;
    const open = input.tasks.some(
      (task) => task.work_item_id === id && ["todo", "doing", "waiting"].includes(task.status),
    );
    const split = input.workItems.some(
      (row) => row.parent_id === id && (row.status === "active" || row.status === "waiting"),
    );
    if (!open && !split) {
      warnings.push({
        kind: "next_step",
        subjectId: id,
        text: `${item.title}: sıradaki adım tanımsız.`,
      });
    }
  }

  for (const id of input.advice?.defer ?? []) {
    const candidate = candidates.find((row) => row.id === id);
    if (candidate?.mandatory) {
      warnings.push({
        kind: "advice_rejected",
        subjectId: id,
        text: `${titleOf(id)}: ertelenemez, bugün planda kaldı.`,
      });
    }
  }

  for (const id of outOfTime) {
    const title = [...closed, ...candidates].find((row) => row.id === id)?.title ?? titleOf(id);
    warnings.push({
      kind: "advice_rejected",
      subjectId: id,
      text: `${title}: bu saatlerde yapılamaz, öneri plana alınmadı.`,
    });
  }

  for (const task of input.tasks) {
    if (task.status === "todo" && task.defer_count >= DEFER_LIMIT) {
      warnings.push({
        kind: "deferred_often",
        subjectId: task.id,
        text: `${task.title}: ${task.defer_count} kez ertelendi. Böl, bırak ya da bir tarihe bağla.`,
      });
    }
  }

  // Each warning knows its module, so the screen can take the user there.
  const moduleOf = (id: string) =>
    [...candidates, ...closed].find((row) => row.id === id || row.item?.id === id)?.moduleId ??
    input.tasks.find((row) => row.id === id)?.module_id ??
    input.workItems.find((row) => row.id === id)?.module_id;
  return warnings
    .slice(0, MAX_WARNINGS)
    .map((warning) => ({ ...warning, moduleId: warning.moduleId ?? moduleOf(warning.subjectId) }));
}

/** The work can start now: right away, or right after its travel there (not later in a window). */
function startsNow(spot: Spot | null, slot: Slot, candidate: Candidate): boolean {
  if (!spot) return false;
  return spot.workStart === slot.start.getTime() + (candidate.travelBefore ?? 0) * MINUTE;
}

/** "X dk'm var": the best work that fits in the given minutes, now, wherever it was planned. */
export function pickForMinutes(input: PlanInput, minutes: number): Candidate | null {
  // Under a light slot's length the minutes are a break: physical work or a short light one.
  const kind = kindOf(minutes, input.settings) ?? "break";
  const slot: Slot = {
    start: input.now,
    end: new Date(input.now.getTime() + minutes * MINUTE),
    minutes,
    kind,
    assignment: null,
  };
  return (
    buildCandidates(input).find((candidate) =>
      candidate.timing
        ? startsNow(spotAt([slot], 0, candidate, input), slot, candidate)
        : fits(candidate, slot, input.context),
    ) ?? null
  );
}

/** A short line of the slot: "10:40–11:25". */
export function slotLabel(slot: Slot): string {
  return `${formatTime(slot.start)}–${formatTime(slot.end)}`;
}
