import type { DayFrameRecord } from "@/core/contract/types";
import type { Tables } from "@/lib/supabase/database.types";
import { dayKey, formatTime, shiftDay } from "@/lib/date";

// The routine's rules that need no database, no clock and no screen (docs/moduller/rutin.md,
// "Kurallar"): which steps a run has on a day, which add-on is due, the day a run belongs to, the
// lengths. The current time is always a parameter. The scene and the rules both use these.

export type RoutineKey = "sabah" | "hazirlik" | "aksam";
export const ROUTINE_KEYS: RoutineKey[] = ["sabah", "hazirlik", "aksam"];

export type Routine = Tables<"rutin_routines">;
export type Step = Tables<"rutin_steps">;
export type Run = Tables<"rutin_runs">;
export type RunStep = Tables<"rutin_run_steps">;

/** A sub-step: `seconds` makes it timed; `timer` shows the counter; `hold` (default on) keeps
 * "Sonraki" from passing it before the time is up. */
export type Part = {
  title: string;
  note?: string | null;
  seconds?: number | null;
  timer?: boolean;
  hold?: boolean;
};

/** The routine each section of the module belongs to: the morning is two blocks. */
export const FACET_OF: Record<RoutineKey, "sabah" | "aksam"> = {
  sabah: "sabah",
  hazirlik: "sabah",
  aksam: "aksam",
};
export const ANCHOR_OF: Record<RoutineKey, "wake" | "bed"> = {
  sabah: "wake",
  hazirlik: "wake",
  aksam: "bed",
};
/** Places on the order axis the modules share (docs/moduller/ORTAK.md, section 1). */
export const ORDER_OF: Record<RoutineKey, number> = { sabah: 10, hazirlik: 30, aksam: 10 };

export const isRoutineKey = (value: unknown): value is RoutineKey =>
  value === "sabah" || value === "hazirlik" || value === "aksam";

/** The step's sub-steps as stored; anything that is not one is left out. */
export function partsOf(step: Pick<Step, "parts">): Part[] {
  if (!Array.isArray(step.parts)) return [];
  return step.parts.flatMap((raw) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
    const part = raw as Record<string, unknown>;
    if (typeof part.title !== "string" || part.title.trim() === "") return [];
    const seconds =
      typeof part.seconds === "number" && part.seconds > 0 ? Math.round(part.seconds) : null;
    return [
      {
        title: part.title,
        note: typeof part.note === "string" && part.note.trim() !== "" ? part.note : null,
        seconds,
        timer: seconds !== null && part.timer === true,
        hold: seconds !== null && part.hold !== false,
      },
    ];
  });
}

/** Whole days from one day key to another (positive when `to` is later). */
export function daysApart(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/**
 * Whether a step comes on a day. Without `every_days`, every run. With it, once that many days
 * have gone by since the day it was last done: counted from the last time, not the calendar, so
 * a missed one comes again the next day and a long break brings it once, not once per missed
 * turn. Never done: due.
 */
export function isDue(step: Pick<Step, "every_days">, lastDone: string | null, day: string) {
  if (!step.every_days || step.every_days <= 1) return true;
  if (!lastDone) return true;
  return daysApart(lastDone, day) >= step.every_days;
}

/** The last day each step was done, from the runs' records. */
export function lastDoneDays(
  records: { step_id: string | null; result: string; day: string }[],
): Map<string, string> {
  const last = new Map<string, string>();
  for (const record of records) {
    if (record.result !== "done" || !record.step_id) continue;
    const seen = last.get(record.step_id);
    if (!seen || record.day > seen) last.set(record.step_id, record.day);
  }
  return last;
}

export type DayStep = Step & {
  /** The step's lines in the "Bu adımda" panel: its parts, or itself; then its due add-ons. */
  lines: Line[];
  /** The add-ons that are due on this step today. */
  addOns: Step[];
};

export type Line =
  { kind: "part"; index: number; part: Part } | { kind: "addon"; step: Step; part: Part };

/** A step of the scene: switched on, of the routine's own kind, no add-on. */
const onScreen = (step: Step) => step.active && step.parent_id === null && step.kind === "tap";

/**
 * The steps a run of the routine has on a day, in order: the open steps that are due, each with
 * its lines (sub-steps, or the step itself as one line) and its due open add-ons after them.
 * Records of the day itself do not count: a step done today stays in today's list, so the run's
 * positions hold while it goes on.
 */
export function dayStepsOf(
  steps: Step[],
  routineId: string,
  day: string,
  lastDone: Map<string, string>,
): DayStep[] {
  const byPosition = (a: Step, b: Step) =>
    a.position - b.position || a.title.localeCompare(b.title);
  const due = (step: Step) => isDue(step, lastDoneBefore(lastDone, step.id, day), day);
  return steps
    .filter((step) => step.routine_id === routineId && onScreen(step) && due(step))
    .sort(byPosition)
    .map((step) => {
      const addOns = steps
        .filter((addOn) => addOn.parent_id === step.id && addOn.active && due(addOn))
        .sort(byPosition);
      const parts = partsOf(step);
      const own: Line[] =
        parts.length > 0
          ? parts.map((part, index) => ({ kind: "part", index, part }))
          : [{ kind: "part", index: 0, part: { title: step.title, note: null } }];
      return {
        ...step,
        addOns,
        lines: [
          ...own,
          ...addOns.map((addOn): Line => ({
            kind: "addon",
            step: addOn,
            part: { title: addOn.title, note: addOn.hint },
          })),
        ],
      };
    });
}

/** The last day before `day` a step was done (today's own record does not make it "not due"). */
function lastDoneBefore(lastDone: Map<string, string>, stepId: string, day: string) {
  const last = lastDone.get(stepId) ?? null;
  return last !== null && last >= day ? null : last;
}

/** The planned length of a routine: its open steps (add-ons not counted), in seconds. */
export function routineSeconds(steps: Step[], routineId: string): number {
  return steps
    .filter((step) => step.routine_id === routineId && onScreen(step))
    .reduce((sum, step) => sum + step.seconds, 0);
}

/**
 * The minutes the routine's rhythm is proposed with. The core takes 5 to 90 (a sitting); a
 * shorter morning block is proposed as 5, a longer one as 90. Whole minutes, rounded.
 */
export function proposalMinutes(seconds: number): number {
  return Math.min(90, Math.max(5, Math.round(seconds / 60)));
}

/** A length as the module page writes it: "3 dk", "25 sn", "1 sa 5 dk". */
export function formatSeconds(seconds: number): string {
  if (seconds > 0 && seconds < 60) return `${seconds} sn`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} dk`;
  const rest = minutes % 60;
  return rest === 0
    ? `${Math.floor(minutes / 60)} sa`
    : `${Math.floor(minutes / 60)} sa ${rest} dk`;
}

/** Istanbul wall-clock hour of an instant (0–23). */
function hourOf(at: Date): number {
  return Number(formatTime(at).slice(0, 2));
}

/**
 * The day a run belongs to: the core's day, not the calendar's (B3). The evening's run started
 * before noon belongs to the night before (a bedtime after midnight is the previous day's night,
 * as the core counts it). A morning run belongs to the calendar day once that day's waking is
 * recorded at or before it; before 05:00 without one, to the night before.
 */
export function runDay(at: Date, routine: RoutineKey, days: DayFrameRecord[]): string {
  const calendar = dayKey(at);
  if (ANCHOR_OF[routine] === "bed") return hourOf(at) < 12 ? shiftDay(calendar, -1) : calendar;
  const today = days.find((row) => row.date === calendar);
  if (today?.wokeAt && Date.parse(today.wokeAt) <= at.getTime()) return calendar;
  return hourOf(at) < 5 ? shiftDay(calendar, -1) : calendar;
}

/** Whether every open basic step of the day's list is done in the run. */
export function minimumDone(daySteps: DayStep[], results: Map<string, string>): boolean {
  const basic = daySteps.filter((step) => step.minimum);
  return basic.every((step) => results.get(step.id) === "done");
}

/** A run that closes steps faster than this did not really do them one by one ("bulk"). */
export const BULK_SECONDS = 3;

// --- The morning (or the evening) as one list ----------------------------------------------------

/** One row of the morning or the evening: a step of this module, or another module's work. */
export type Unit = {
  key: string;
  title: string;
  /** A step of one of this module's routines (false: another module's work in the chain). */
  mine: boolean;
  routineId: string | null;
  stepId: string | null;
  state: "done" | "current" | "next";
  /** Another module's work: its module and minutes ("Spor · 12 dk"); an add-on's day. */
  note: string | null;
};

type ChainItem = {
  id: string;
  title: string;
  module: { name: string };
  minutes: number;
  state: "done" | "running" | "next" | "passed";
  mine: boolean;
};

/**
 * The scene's list (8.2 "Sıradaki", the board's "Bu sabah"): the chain's work in its order, each
 * of this module's routines opened into its steps of the day, every other module's work one row;
 * work passed today is left out. Without a chain, the running routine alone. The count
 * "bu sabah n / m" is the current row's place in this list, so it follows the chain (6 without
 * another module's work, 7 with one).
 */
export function unitsOf(args: {
  chain: { items: ChainItem[] } | null;
  /** The running rhythm and its routine. */
  running: { rhythmId: string; routineId: string; position: number };
  /** This module's rhythm → its routine. */
  routineOf: (rhythmId: string) => string | null;
  stepsOf: (routineId: string) => DayStep[];
}): Unit[] {
  const items: ChainItem[] = args.chain?.items ?? [
    {
      id: args.running.rhythmId,
      title: "",
      module: { name: "" },
      minutes: 0,
      state: "running",
      mine: true,
    },
  ];
  const units: Unit[] = [];
  for (const item of items) {
    if (item.state === "passed") continue;
    const running = item.id === args.running.rhythmId;
    const routineId = running ? args.running.routineId : item.mine ? args.routineOf(item.id) : null;
    if (routineId) {
      for (const [index, step] of args.stepsOf(routineId).entries()) {
        const state: Unit["state"] = running
          ? index < args.running.position
            ? "done"
            : index === args.running.position
              ? "current"
              : "next"
          : item.state === "done"
            ? "done"
            : "next";
        units.push({
          key: step.id,
          title: step.title,
          mine: true,
          routineId,
          stepId: step.id,
          state,
          note: null,
        });
      }
      continue;
    }
    units.push({
      key: item.id,
      title: item.title,
      mine: false,
      routineId: null,
      stepId: null,
      state: item.state === "done" ? "done" : "next",
      note: `${item.module.name} · ${item.minutes} dk`,
    });
  }
  return units;
}
