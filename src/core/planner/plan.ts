import type { Context } from "@/core/types";
import { blocksOfDay, currentBlock, effortUsedUp } from "@/core/today/select";
import { dayKey, formatDue, formatTime, istanbulInstant, shiftDay } from "@/lib/date";
import {
  availableUntil,
  buildCandidates,
  isReturning,
  rhythmState,
  shareWorked,
} from "./candidates";
import { buildSlots, capacityFactor, kindOf, slotMinutes } from "./slots";
import type { Assignment, Candidate, NowState, Plan, PlanInput, Slot, Warning } from "./types";

// The day plan (docs/04-planlayici.md, "Gün nasıl kurulur"): slots, capacity, the mandatory
// work first, then the rest by score, the day's three, the "now" state and at most two
// warnings. Pure: the same input always gives the same plan.

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

/** The device context sees work of these contexts. The second screen is at the desk at home. */
export function contextFits(work: Context, device: Context): boolean {
  if (work === "any" || work === device) return true;
  return device === "desk" && work === "home";
}

/** The three filters: length, energy, context (docs/04-planlayici.md, "Süzgeçler"). */
export function fits(candidate: Candidate, slot: Slot, device: Context): boolean {
  if (candidate.minutes > slot.minutes) return false;
  if (!contextFits(candidate.context, device)) return false;
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

/** Whether a member of the day's three is finished (or gone). */
export function isFinished(id: string, input: PlanInput): boolean {
  const task = input.tasks.find((row) => row.id === id);
  if (task) return task.status === "done" || task.status === "dropped";
  const rhythm = input.rhythms.find((row) => row.id === id);
  if (rhythm) {
    return rhythmState(rhythm, input.rhythmLogs, input.date, input.lifeMode).doneToday > 0;
  }
  const item = input.workItems.find((row) => row.id === id);
  if (item) {
    if (item.status === "done" || item.status === "dropped") return true;
    // An item stands in the three for its sitting of the day.
    return input.tasks.some(
      (row) =>
        row.work_item_id === id &&
        row.status === "done" &&
        row.done_at !== null &&
        dayKey(new Date(row.done_at)) === input.date,
    );
  }
  return true;
}

/** The id the day's three know a candidate by: a sitting stands for its work item. */
function matches(id: string, candidate: Candidate): boolean {
  return candidate.id === id || candidate.task?.work_item_id === id;
}

export function buildPlan(input: PlanInput): Plan {
  const { settings } = input;
  const candidates = buildCandidates(input);
  const windowStart = input.now > input.dayStart ? input.now : input.dayStart;
  const slots = buildSlots(
    { start: windowStart, end: input.finishLine },
    blocksOfDay(input.blocks, input.date),
    settings,
  );
  const usableMinutes = Math.round(
    slotMinutes(slots) * capacityFactor(input.dayType, settings, input.stats),
  );

  const placed = new Set<string>();
  let plannedMinutes = 0;
  const tryPlace = (candidate: Candidate, overCapacity: boolean): boolean => {
    if (placed.has(candidate.id)) return true;
    if (!overCapacity && plannedMinutes + candidate.minutes > usableMinutes) return false;
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

  // 2. The day's three as fixed when the day was planned, else the AI's three; cut at capacity.
  // They are placed by their score now, not in the order they were chosen in: a deadline that
  // moved since puts its work first.
  const chosen = input.top3 ?? input.advice?.top3 ?? [];
  for (const candidate of candidates) {
    if (chosen.some((id) => matches(id, candidate))) tryPlace(candidate, false);
  }

  // 3. Fill: each free slot in time order takes the best candidate that fits it.
  for (let index = 0; index < slots.length; index++) {
    const slot = slots[index];
    if (slot.assignment) continue;
    const best = candidates.find(
      (candidate) =>
        !placed.has(candidate.id) &&
        fits(candidate, slot, input.context) &&
        plannedMinutes + candidate.minutes <= usableMinutes,
    );
    if (best) tryPlace(best, false);
  }

  const assignments = slots.filter((slot) => slot.assignment).map((slot) => slot.assignment!);
  const top3 = input.top3 ?? pickTop3(assignments, chosen);
  const top3Done = top3.filter((id) => isFinished(id, input)).length;
  const overflow = candidates.filter((candidate) => !placed.has(candidate.id));

  return {
    date: input.date,
    slots,
    top3,
    top3Done,
    now: nowOf(input, slots, candidates, top3, top3Done),
    overflow,
    warnings: warningsOf(input, candidates, placed),
    usableMinutes,
    plannedMinutes,
    candidates,
  };
}

/** Mandatory work first, then the AI's or the user's choice, then the best of the rest. */
function pickTop3(assignments: Assignment[], chosen: string[]): string[] {
  const ordered = [
    ...assignments.filter((row) => row.candidate.mandatory !== null),
    ...chosen.flatMap((id) => assignments.filter((row) => matches(id, row.candidate))),
    ...[...assignments].sort((a, b) => b.candidate.score - a.candidate.score),
  ];
  const ids: string[] = [];
  for (const { candidate } of ordered) {
    if (!ids.includes(candidate.id) && candidate.type !== "follow_up") ids.push(candidate.id);
    if (ids.length === 3) break;
  }
  return ids;
}

function nowOf(
  input: PlanInput,
  slots: Slot[],
  candidates: Candidate[],
  top3: string[],
  top3Done: number,
): NowState {
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
  // The night ends at 05:00, or earlier when the day is set to start earlier.
  const nightEnds = istanbulInstant(
    input.date,
    input.settings.dayStart < NIGHT_ENDS ? input.settings.dayStart : NIGHT_ENDS,
  );
  if (input.closed || input.now >= input.finishLine || input.now < nightEnds)
    return { kind: "night" };
  if (isReturning(input)) {
    return {
      kind: "return",
      top3: top3.flatMap((id) =>
        candidates.filter((candidate) => matches(id, candidate)).slice(0, 1),
      ),
    };
  }
  if (input.prompt) return { kind: "prompt", prompt: input.prompt };

  // A work item whose effort is used up asks "Bitti mi?" in its own slot, and before the day
  // can be done.
  const usedUp = slots.find(
    (slot) =>
      slot.assignment?.candidate.type === "item" &&
      slot.assignment.candidate.item &&
      effortUsedUp(slot.assignment.candidate.item),
  )?.assignment;

  const mandatoryLeft = candidates.some((candidate) => candidate.mandatory !== null);
  const finishedToday = input.tasks.filter(
    (task) =>
      task.status === "done" &&
      task.done_at !== null &&
      dayKey(new Date(task.done_at)) === input.date,
  );
  if (top3.length > 0 && top3Done === top3.length && !mandatoryLeft) {
    if (usedUp) return { kind: "suggest", assignment: usedUp };
    return {
      kind: "done",
      finished: finishedToday.length,
      minutes: finishedToday.reduce((sum, task) => sum + task.est_minutes, 0),
    };
  }
  const next = slots.find((slot) => slot.assignment)?.assignment;
  if (next) return { kind: "suggest", assignment: next };
  if (finishedToday.length > 0 && !mandatoryLeft) {
    if (usedUp) return { kind: "suggest", assignment: usedUp };
    return {
      kind: "done",
      finished: finishedToday.length,
      minutes: finishedToday.reduce((sum, task) => sum + task.est_minutes, 0),
    };
  }
  return { kind: "empty" };
}

/** At most two, in order: a deadline that will not be met, a floor in danger, no next step. */
function warningsOf(input: PlanInput, candidates: Candidate[], placed: Set<string>): Warning[] {
  const warnings: Warning[] = [];
  const titleOf = (id: string) => candidates.find((row) => row.id === id)?.title ?? "";

  // A deadline that the time left cannot hold.
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.dueAt === null || candidate.type === "rhythm") continue;
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
    if (left > availableUntil(input, due)) {
      warnings.push({
        kind: "deadline",
        subjectId: key,
        text: `${item?.title ?? candidate.title}: ${formatDue(due, input.now)} için kalan süre yetmiyor.`,
      });
    }
  }

  for (const candidate of candidates) {
    if (candidate.mandatory === "floor" && !placed.has(candidate.id)) {
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
    candidates.find((row) => row.id === id || row.item?.id === id)?.moduleId ??
    input.tasks.find((row) => row.id === id)?.module_id ??
    input.workItems.find((row) => row.id === id)?.module_id;
  return warnings
    .slice(0, MAX_WARNINGS)
    .map((warning) => ({ ...warning, moduleId: moduleOf(warning.subjectId) }));
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
  return buildCandidates(input).find((candidate) => fits(candidate, slot, input.context)) ?? null;
}

/** A short line of the slot: "10:40–11:25". */
export function slotLabel(slot: Slot): string {
  return `${formatTime(slot.start)}–${formatTime(slot.end)}`;
}
