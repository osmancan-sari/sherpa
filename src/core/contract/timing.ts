import { z } from "zod";
import type { FieldSource, Provenance } from "@/core/types";

// Time constraints of work (docs/03-veri-modeli.md, "Zaman kısıtları"): when it may be done,
// which hours it prefers or avoids, the travel around it and the rest days between two doings
// of a rhythm. One schema for the module's envelope and the user's form. Pure.

/** A range of wall-clock time in Istanbul on some days of the week (1 = Monday … 7 = Sunday). */
export type TimeWindow = { days?: number[]; from: string; to: string };

export type Timing = {
  /** Hard: the work is placed only inside these ranges. */
  windows?: TimeWindow[];
  /** Soft: these hours put the work ahead. */
  prefer?: TimeWindow[];
  /** Soft: these hours are avoided; used when nothing else is left. */
  avoid?: TimeWindow[];
  /** Hard: minutes of travel before and after the work. */
  travel?: { before?: number; after?: number };
  /** Hard, rhythms only: at least this many free days between two doings. */
  rest_days?: number;
};

export const TIMING_FIELDS = ["windows", "prefer", "avoid", "travel", "rest_days"] as const;
export type TimingField = (typeof TIMING_FIELDS)[number];

/** At most this many ranges in one list. */
export const MAX_WINDOWS = 14;
/** Travel each way, in minutes. */
export const MAX_TRAVEL = 180;
/** Rest days: a month (28 days) must still hold two doings. */
export const MAX_REST_DAYS = 26;

/** Why a timing value was refused; the form says it in one sentence (src/core/ui). */
export type TimingProblem =
  | "shape"
  | "clock"
  | "order"
  | "empty"
  | "too_many"
  | "days"
  | "travel"
  | "rest_days"
  | "rest_fit"
  | "not_used";

const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

/** Minutes after midnight of "HH:mm" ("24:00" is 1440). */
export function clockMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

const windowSchema = z
  .strictObject({
    days: z
      .array(z.number().int().min(1).max(7))
      .min(1, "an empty list is not written: leave days out for every day")
      .max(7)
      .optional(),
    from: z.string().regex(CLOCK, "HH:mm"),
    to: z.string().regex(CLOCK, "HH:mm (24:00 allowed)"),
  })
  .superRefine((range, ctx) => {
    if (range.days && new Set(range.days).size !== range.days.length) {
      ctx.addIssue({ code: "custom", path: ["days"], message: "a day twice" });
    }
    if (CLOCK.test(range.from) && CLOCK.test(range.to)) {
      if (range.from === "24:00" || clockMinutes(range.from) >= clockMinutes(range.to)) {
        ctx.addIssue({
          code: "custom",
          path: ["to"],
          message: "from must be before to (a range past midnight is written as two)",
        });
      }
    }
  });

const listSchema = z
  .array(windowSchema)
  .min(1, "an empty list is not written: leave the field out")
  .max(MAX_WINDOWS, `at most ${MAX_WINDOWS} ranges`);

const travelMinutes = z.number().int().min(0).max(MAX_TRAVEL, `at most ${MAX_TRAVEL} minutes`);

export const timingSchema = z.strictObject({
  windows: listSchema.optional(),
  prefer: listSchema.optional(),
  avoid: listSchema.optional(),
  travel: z
    .strictObject({ before: travelMinutes.optional(), after: travelMinutes.optional() })
    .optional(),
  rest_days: z.number().int().min(1).max(MAX_REST_DAYS).optional(),
});

/** Why the schema refused a value, from where and how it failed. */
function reasonOf(issue: { code: string; path: PropertyKey[] }): TimingProblem {
  const path = issue.path.map(String);
  const last = path[path.length - 1];
  if (path[0] === "travel") return "travel";
  if (path[0] === "rest_days") return "rest_days";
  if (path.includes("days")) return "days";
  if (last === "from" || last === "to") return issue.code === "custom" ? "order" : "clock";
  if (path.length === 1 && issue.code === "too_small") return "empty";
  if (path.length === 1 && issue.code === "too_big") return "too_many";
  return "shape";
}

/** What the work is: the form of its envelope, which decides the fields it may use. */
export type TimingForm =
  | { kind: "deadline" }
  | { kind: "recurrence"; count: number; period: "day" | "week" | "month" }
  | { kind: "fixed" }
  /** A task (a single job or a sitting): like a deadline. */
  | { kind: "task" };

export type TimingIssue = { path: string[]; message: string; reason: TimingProblem };

const PERIOD_DAYS = { week: 7, month: 28 } as const;

/** Problems a valid-shaped value has in this form (fields it may not use, rest days that do not fit). */
export function formIssues(timing: Timing, form: TimingForm): TimingIssue[] {
  const issues: TimingIssue[] = [];
  const notUsed = (field: TimingField, by: string) =>
    issues.push({ path: [field], message: `not used by a ${by}`, reason: "not_used" });
  if (form.kind === "fixed") {
    for (const field of TIMING_FIELDS) {
      if (field !== "travel" && timing[field] !== undefined) notUsed(field, "fixed time");
    }
  }
  if ((form.kind === "deadline" || form.kind === "task") && timing.rest_days !== undefined) {
    notUsed("rest_days", form.kind === "task" ? "task" : "deadline");
  }
  if (form.kind === "recurrence" && timing.rest_days !== undefined) {
    if (form.period === "day") notUsed("rest_days", "daily recurrence");
    else {
      const days = PERIOD_DAYS[form.period];
      if ((form.count - 1) * (timing.rest_days + 1) + 1 > days) {
        issues.push({
          path: ["rest_days"],
          message: `${form.count} times with ${timing.rest_days} rest days between them do not fit in ${days} days`,
          reason: "rest_fit",
        });
      }
    }
  }
  return issues;
}

/** A value with nothing in it is no constraint at all. */
export function normalizeTiming(timing: Timing | null | undefined): Timing | null {
  if (!timing) return null;
  const out: Timing = {};
  for (const field of TIMING_FIELDS) {
    const value = timing[field];
    if (value === undefined || value === null) continue;
    if (field === "travel") {
      const travel = value as NonNullable<Timing["travel"]>;
      const kept: NonNullable<Timing["travel"]> = {};
      if (travel.before !== undefined) kept.before = travel.before;
      if (travel.after !== undefined) kept.after = travel.after;
      if (Object.keys(kept).length > 0) out.travel = kept;
    } else (out as Record<string, unknown>)[field] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Checks a timing value for a form. Null and an empty object are "no constraint". The issues
 * name the field inside the value (`windows.0.to`) and why.
 */
export function checkTiming(
  value: unknown,
  form: TimingForm,
): { timing: Timing | null; issues: TimingIssue[] } {
  if (value === null || value === undefined) return { timing: null, issues: [] };
  const parsed = timingSchema.safeParse(value);
  if (!parsed.success) {
    return {
      timing: null,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String),
        message: issue.message,
        reason: reasonOf(issue),
      })),
    };
  }
  const timing = normalizeTiming(parsed.data);
  return { timing, issues: timing ? formIssues(timing, form) : [] };
}

/**
 * A stored value read for planning: anything that does not pass the schema counts as no
 * constraint (the planner never fails on a bad row).
 */
export function readTiming(value: unknown): Timing | null {
  if (value === null || value === undefined) return null;
  const parsed = timingSchema.safeParse(value);
  return parsed.success ? normalizeTiming(parsed.data) : null;
}

/** The provenance key of a timing field. */
export const timingSource = (field: TimingField) => `timing.${field}`;

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((key) => [key, canonical(source[key])]),
    );
  }
  return value;
}

/**
 * A proposal's timing merged into the stored one, field by field. Every field is a fact: the
 * module writes it each time and an empty one is removed, but a field the user changed stays.
 * Returns the new value (null when empty), the fields changed and kept (`timing.windows`…),
 * and updates `provenance` in place.
 */
export function mergeTiming(
  stored: Timing | null,
  incoming: Timing | null,
  provenance: Provenance,
  source: FieldSource = "module",
): { value: Timing | null; changed: string[]; kept: string[] } {
  const next: Record<string, unknown> = { ...(stored ?? {}) };
  const changed: string[] = [];
  const kept: string[] = [];
  for (const field of TIMING_FIELDS) {
    const key = timingSource(field);
    const current = stored?.[field];
    const wanted = incoming?.[field];
    if (provenance[key] === "user") {
      if (!same(current, wanted)) kept.push(key);
      continue;
    }
    if (wanted === undefined) {
      if (current !== undefined) {
        delete next[field];
        changed.push(key);
      }
      delete provenance[key];
      continue;
    }
    if (!same(current, wanted)) {
      next[field] = wanted;
      changed.push(key);
    }
    provenance[key] = source;
  }
  return { value: normalizeTiming(next as Timing), changed, kept };
}

export class TimingError extends Error {
  constructor(readonly issues: TimingIssue[]) {
    super(
      `Invalid timing: ${issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
    );
    this.name = "TimingError";
  }
}

/**
 * The user's edit of a timing value: checked with the same schema as the envelope, and every
 * field that changed becomes the user's (a later proposal keeps it). Throws TimingError.
 */
export function editTiming(
  current: unknown,
  next: unknown,
  form: TimingForm,
  provenance: Provenance | null,
): { timing: Timing | null; provenance: Provenance } {
  const { timing, issues } = checkTiming(next, form);
  if (issues.length > 0) throw new TimingError(issues);
  const before = readTiming(current);
  const sources: Provenance = { ...(provenance ?? {}) };
  for (const field of TIMING_FIELDS) {
    if (!same(before?.[field], timing?.[field])) sources[timingSource(field)] = "user";
  }
  return { timing, provenance: sources };
}
