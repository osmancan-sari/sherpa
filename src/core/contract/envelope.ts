import { z } from "zod";
import {
  type FieldSource,
  type Provenance,
  SESSION_DEFAULT_MINUTES,
  TASK_MAX_MINUTES,
  TASK_MIN_MINUTES,
} from "@/core/types";
import type { ProposalTarget, WorkProposal } from "./types";

// The work envelope, as pure functions: validate a proposal, turn it into column values, and
// merge those into what is already stored without touching anything the user changed.
// No database here; src/core/data/propose.ts does the reading and writing.

const instant = z.iso.datetime({ offset: true });

const proposalSchema = z
  .object({
    schema: z.literal(1),
    key: z.string().trim().min(1).max(200),
    source: z.object({ type: z.string().trim().min(1), id: z.guid() }),
    title: z.string().trim().min(1).max(300),
    when: z
      .object({
        due: instant.nullish(),
        hard: z.boolean().nullish(),
        earliest: instant.nullish(),
        recurrence: z
          .object({
            count: z.number().int().min(1),
            period: z.enum(["day", "week", "month"]),
            floor: z.number().int().min(0).optional(),
          })
          .nullish(),
        fixed: z
          .object({
            starts_at: instant,
            ends_at: instant,
            location: z.string().nullish(),
          })
          .nullish(),
      })
      .optional(),
    effort: z
      .object({
        total_minutes: z.number().int().min(1).nullish(),
        session_minutes: z.number().int().min(TASK_MIN_MINUTES).max(TASK_MAX_MINUTES).nullish(),
        bounds: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }).nullish(),
      })
      .optional(),
    fit: z
      .object({
        energy: z.enum(["deep", "light", "physical"]).nullish(),
        context: z.enum(["any", "desk", "home", "campus", "office", "out", "commute"]).nullish(),
      })
      .optional(),
    importance: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullish(),
    depends_on: z.array(z.string().trim().min(1)).optional(),
    flex: z
      .object({ splittable: z.boolean().nullish(), droppable: z.boolean().nullish() })
      .optional(),
    artifact: z.string().nullish(),
    meta: z.record(z.string(), z.unknown()).optional(),
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
    source_id: proposal.source.id,
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
    };
  }

  if (when.fixed) {
    return {
      facts: {
        ...shared,
        starts_at: new Date(when.fixed.starts_at).toISOString(),
        ends_at: new Date(when.fixed.ends_at).toISOString(),
        location: when.fixed.location ?? null,
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
    // No AI in this phase: an empty effort gets the middle of the bounds (Ç2 replaces it).
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
    },
    judgments: estimates,
  };
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "string" && typeof b === "string") {
    // Timestamps come back from the database in another spelling of the same instant.
    const [x, y] = [Date.parse(a), Date.parse(b)];
    if (!Number.isNaN(x) && x === y && /^\d{4}-\d{2}-\d{2}T/.test(a)) return true;
  }
  return JSON.stringify(a) === JSON.stringify(b);
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
