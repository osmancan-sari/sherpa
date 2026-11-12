import { z } from "zod";
import {
  type FieldSource,
  type Provenance,
  SESSION_DEFAULT_MINUTES,
  TASK_MAX_MINUTES,
  TASK_MIN_MINUTES,
} from "@/core/types";
import {
  checkTiming,
  formIssues,
  mergeTiming,
  readTiming,
  type Timing,
  timingSchema,
} from "./timing";
import type { ProposalTarget, WorkProposal } from "./types";

// The work envelope, as pure functions: validate a proposal, turn it into column values, and
// merge those into what is already stored without touching anything the user changed.
// No database here; src/core/data/propose.ts does the reading and writing.

const instant = z.iso.datetime({ offset: true });

const proposalSchema = z
  .strictObject({
    schema: z.literal(1),
    // No spaces, commas, braces, quotes or backslashes: keys travel inside array filters.
    key: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[^\s,{}"\\]+$/, "no spaces, commas, braces, quotes or backslashes"),
    source: z.strictObject({ type: z.string().trim().min(1), id: z.guid() }),
    title: z.string().trim().min(1).max(300),
    when: z
      .strictObject({
        due: instant.nullish(),
        hard: z.boolean().nullish(),
        earliest: instant.nullish(),
        recurrence: z
          .strictObject({
            count: z.number().int().min(1),
            period: z.enum(["day", "week", "month"]),
            floor: z.number().int().min(0).optional(),
          })
          .nullish(),
        fixed: z
          .strictObject({
            starts_at: instant,
            ends_at: instant,
            location: z.string().nullish(),
          })
          .nullish(),
      })
      .optional(),
    effort: z
      .strictObject({
        total_minutes: z.number().int().min(1).nullish(),
        session_minutes: z.number().int().min(TASK_MIN_MINUTES).max(TASK_MAX_MINUTES).nullish(),
        bounds: z
          .strictObject({ min: z.number().int().min(1), max: z.number().int().min(1) })
          .nullish(),
      })
      .optional(),
    fit: z
      .strictObject({
        energy: z.enum(["deep", "light", "physical"]).nullish(),
        context: z.enum(["any", "desk", "home", "campus", "office", "out", "commute"]).nullish(),
      })
      .optional(),
    importance: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullish(),
    depends_on: z.array(z.string().regex(/^[^\s,{}"\\]+$/)).optional(),
    flex: z
      .strictObject({ splittable: z.boolean().nullish(), droppable: z.boolean().nullish() })
      .optional(),
    artifact: z.string().nullish(),
    meta: z.record(z.string(), z.unknown()).optional(),
    timing: timingSchema.nullish(),
  })
  .superRefine((proposal, ctx) => {
    const when = proposal.when ?? {};
    const hasDue = when.due != null || when.earliest != null || when.hard != null;
    const forms = [hasDue, when.recurrence != null, when.fixed != null].filter(Boolean).length;
    if (forms > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["when"],
        message: "when carries one form: a deadline, a recurrence or a fixed time",
      });
    }
    if (when.fixed && Date.parse(when.fixed.ends_at) <= Date.parse(when.fixed.starts_at)) {
      ctx.addIssue({ code: "custom", path: ["when", "fixed"], message: "ends before it starts" });
    }
    if (when.recurrence?.floor != null && when.recurrence.floor > when.recurrence.count) {
      ctx.addIssue({
        code: "custom",
        path: ["when", "recurrence", "floor"],
        message: "the floor cannot exceed the target",
      });
    }
    if (when.due && when.earliest && Date.parse(when.earliest) > Date.parse(when.due)) {
      ctx.addIssue({ code: "custom", path: ["when", "earliest"], message: "after the deadline" });
    }
    // A field the target table has no place for is a mistake in the module, not something to
    // drop silently.
    const given = (value: unknown) =>
      value !== null &&
      value !== undefined &&
      !(Array.isArray(value) && value.length === 0) &&
      !(typeof value === "object" && Object.keys(value as object).length === 0);
    const unusable = (form: string, fields: [string, unknown][]) => {
      for (const [field, value] of fields) {
        if (given(value)) {
          ctx.addIssue({
            code: "custom",
            path: field.split("."),
            message: `not used by a ${form}`,
          });
        }
      }
    };
    if (when.recurrence) {
      unusable("recurrence", [
        ["effort.total_minutes", proposal.effort?.total_minutes],
        ["effort.bounds", proposal.effort?.bounds],
        ["importance", proposal.importance],
        ["depends_on", proposal.depends_on],
        ["artifact", proposal.artifact],
        ["flex", proposal.flex],
      ]);
    }
    if (when.fixed) {
      unusable("fixed time", [
        ["effort", proposal.effort],
        ["fit", proposal.fit],
        ["importance", proposal.importance],
        ["depends_on", proposal.depends_on],
        ["artifact", proposal.artifact],
        ["flex", proposal.flex],
        ["meta", proposal.meta],
      ]);
    }
    // Time constraints: which fields the form may use, and rest days that fit the period.
    if (proposal.timing) {
      const form = when.recurrence
        ? ({ kind: "recurrence", ...when.recurrence } as const)
        : when.fixed
          ? ({ kind: "fixed" } as const)
          : ({ kind: "deadline" } as const);
      for (const issue of formIssues(proposal.timing as Timing, form)) {
        ctx.addIssue({ code: "custom", path: ["timing", ...issue.path], message: issue.message });
      }
    }
    const bounds = proposal.effort?.bounds;
    if (bounds && bounds.min > bounds.max) {
      ctx.addIssue({ code: "custom", path: ["effort", "bounds"], message: "min is above max" });
    }
    if (proposal.depends_on?.includes(proposal.key)) {
      ctx.addIssue({ code: "custom", path: ["depends_on"], message: "depends on itself" });
    }
  });

export class ProposalError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid work proposal: ${issues.join("; ")}`);
    this.name = "ProposalError";
  }
}

/** Checks a proposal against the envelope. Throws ProposalError listing every problem. */
export function parseProposal(input: unknown): WorkProposal {
  const result = proposalSchema.safeParse(input);
  if (!result.success) {
    throw new ProposalError(
      result.error.issues.map((issue) => `${issue.path.join(".") || "proposal"}: ${issue.message}`),
    );
  }
  return result.data as WorkProposal;
}

/** Which table a proposal lands in. */
export function proposalTarget(proposal: WorkProposal): ProposalTarget {
  if (proposal.when?.recurrence) return "rhythm";
  if (proposal.when?.fixed) return "block";
  return "work_item";
}

/**
 * The effort written when nobody knows better yet: the middle of the module's bounds,
 * rounded to five minutes. Null when the module gave no bounds.
 */
export function effortMidpoint(bounds: { min: number; max: number } | null | undefined) {
  if (!bounds) return null;
  return Math.max(5, Math.round((bounds.min + bounds.max) / 2 / 5) * 5);
}

/** A column value together with who it comes from. */
type Incoming = { value: unknown; source: FieldSource };

/**
 * `fact` fields are the module's knowledge: an empty value is written too (a deadline can go
 * away). `judgment` fields are estimates: an empty value means "I do not know" and is skipped.
 */
export type IncomingFields = {
  facts: Record<string, unknown>;
  judgments: Record<string, Incoming>;
  /**
   * Time constraints of a work item or rhythm, merged field by field (each its own source,
   * `timing.windows`…). Absent for a block: its travel is in the facts.
   */
  timing?: Timing | null;
};

function judgments(entries: [string, unknown][]): Record<string, Incoming> {
  const result: Record<string, Incoming> = {};
  for (const [field, value] of entries) {
    if (value !== null && value !== undefined) result[field] = { value, source: "module" };
  }
  return result;
}

/** Column values of a proposal for the table it lands in. */
export function incomingFields(proposal: WorkProposal): IncomingFields {
  const when = proposal.when ?? {};
  const shared = {
    title: proposal.title.trim(),
    source_type: proposal.source.type,
    // The database spells uuids in lower case.
    source_id: proposal.source.id.toLowerCase(),
  };

  if (when.recurrence) {
    return {
      facts: {
        ...shared,
        target_count: when.recurrence.count,
        period: when.recurrence.period,
        floor_count: when.recurrence.floor ?? 0,
        meta: proposal.meta ?? {},
      },
      judgments: judgments([
        ["est_minutes", proposal.effort?.session_minutes],
        ["energy", proposal.fit?.energy],
        ["context", proposal.fit?.context],
      ]),
      timing: checkTiming(proposal.timing, { kind: "recurrence", ...when.recurrence }).timing,
    };
  }

  if (when.fixed) {
    return {
      facts: {
        ...shared,
        starts_at: new Date(when.fixed.starts_at).toISOString(),
        ends_at: new Date(when.fixed.ends_at).toISOString(),
        location: when.fixed.location ?? null,
        // A block keeps its travel in its own columns; no travel given is no travel.
        travel_before_min: proposal.timing?.travel?.before ?? 0,
        travel_after_min: proposal.timing?.travel?.after ?? 0,
      },
      judgments: {},
    };
  }

  const estimates = judgments([
    ["effort_total_minutes", proposal.effort?.total_minutes],
    ["session_minutes", proposal.effort?.session_minutes],
    ["importance", proposal.importance],
    ["energy", proposal.fit?.energy],
    ["context", proposal.fit?.context],
    ["splittable", proposal.flex?.splittable],
    ["droppable", proposal.flex?.droppable],
  ]);
  if (!("effort_total_minutes" in estimates)) {
    // An empty effort gets the middle of the bounds; the AI's `size` call replaces it when
    // there is an AI (docs/10-yapay-zeka.md), and without one the middle stays.
    const midpoint = effortMidpoint(proposal.effort?.bounds);
    if (midpoint !== null) {
      estimates.effort_total_minutes = { value: midpoint, source: "default" };
    }
  }

  return {
    facts: {
      ...shared,
      due_at: when.due ? new Date(when.due).toISOString() : null,
      due_is_hard: when.hard ?? false,
      earliest_at: when.earliest ? new Date(when.earliest).toISOString() : null,
      artifact_url: proposal.artifact ?? null,
      depends_on_keys: proposal.depends_on ?? [],
      meta: proposal.meta ?? {},
      // The module's range for the effort: the `size` call keeps its estimate inside it.
      effort_min_minutes: proposal.effort?.bounds?.min ?? null,
      effort_max_minutes: proposal.effort?.bounds?.max ?? null,
    },
    judgments: estimates,
    timing: checkTiming(proposal.timing, { kind: "deadline" }).timing,
  };
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "string" && typeof b === "string") {
    // Timestamps come back from the database in another spelling of the same instant.
    const [x, y] = [Date.parse(a), Date.parse(b)];
    if (!Number.isNaN(x) && x === y && /^\d{4}-\d{2}-\d{2}T/.test(a)) return true;
  }
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/** The same value with object keys in a fixed order: jsonb columns come back re-ordered. */
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

export type Stored = { values: Record<string, unknown>; provenance: Provenance } | null;

export type MergeResult = {
  /** Columns to write (for a new record: every column the proposal sets). */
  patch: Record<string, unknown>;
  provenance: Provenance;
  changed: string[];
  kept: string[];
};

/**
 * Merges a proposal into the stored record.
 * - A field the user changed is never overwritten ("kept").
 * - A default never replaces a value that is already there.
 * - Everything else follows the proposal.
 */
export function mergeProposal(stored: Stored, incoming: IncomingFields): MergeResult {
  const provenance: Provenance = { ...(stored?.provenance ?? {}) };
  const patch: Record<string, unknown> = {};
  const changed: string[] = [];
  const kept: string[] = [];

  const write = (field: string, value: unknown, source: FieldSource) => {
    const current = stored?.values[field];
    if (stored && provenance[field] === "user") {
      if (!same(current, value)) kept.push(field);
      return;
    }
    if (stored && source === "default" && current !== null && current !== undefined) return;
    if (!stored || !same(current, value)) {
      patch[field] = value;
      changed.push(field);
    }
    provenance[field] = source;
  };

  for (const [field, value] of Object.entries(incoming.facts)) write(field, value, "module");
  for (const [field, { value, source }] of Object.entries(incoming.judgments)) {
    write(field, value, source);
  }

  // Time constraints, field by field. A new record without any keeps the column's empty default.
  if (incoming.timing !== undefined && (stored || incoming.timing !== null)) {
    const current = stored ? readTiming(stored.values.timing) : null;
    const timing = mergeTiming(current, incoming.timing, provenance);
    if (timing.changed.length > 0) {
      patch.timing = timing.value;
      changed.push(...timing.changed);
    }
    kept.push(...timing.kept);

    // A rhythm's rest days must fit what the record ends up with: the user may own the target,
    // the period or the rest days, and the proposal only checked its own values.
    if ("target_count" in incoming.facts) {
      const value = (field: string) => (field in patch ? patch[field] : stored?.values[field]);
      const issues = formIssues(timing.value ?? {}, {
        kind: "recurrence",
        count: Number(value("target_count")),
        period: value("period") as "day" | "week" | "month",
      });
      if (issues.length > 0) {
        throw new ProposalError(
          issues.map(
            (issue) =>
              `timing.${issue.path.join(".")}: ${issue.message} (with the record's values)`,
          ),
        );
      }
    }
  }

  if (changed.length > 0 || !stored || !same(stored.provenance, provenance)) {
    patch.provenance = provenance;
  }
  return { patch, provenance, changed, kept };
}

/** Provenance after the user edits these fields by hand. */
export function markUserEdited(provenance: Provenance | null, fields: string[]): Provenance {
  const next: Provenance = { ...(provenance ?? {}) };
  for (const field of fields) next[field] = "user";
  return next;
}

/** Length of the next sitting of a work item. */
export function nextSessionMinutes(item: {
  session_minutes: number | null;
  effort_total_minutes: number | null;
  effort_done_minutes: number;
}): number {
  if (item.session_minutes) return item.session_minutes;
  const remaining =
    item.effort_total_minutes === null
      ? SESSION_DEFAULT_MINUTES
      : item.effort_total_minutes - item.effort_done_minutes;
  const minutes = remaining > 0 ? remaining : SESSION_DEFAULT_MINUTES;
  return Math.min(SESSION_DEFAULT_MINUTES, Math.max(TASK_MIN_MINUTES, minutes));
}
