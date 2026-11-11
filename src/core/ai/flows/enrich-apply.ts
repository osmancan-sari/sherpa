import { markRouted, type RoutedTo } from "@/core/data/inbox";
import { dueAtEndOfDay, type QuickText } from "@/core/intake/parse";
import {
  check,
  type Db,
  type InboxEntry,
  type Provenance,
  TASK_DEFAULT_MINUTES,
  TASK_MAX_MINUTES,
  TASK_MIN_MINUTES,
  toJson,
  unwrap,
  type WorkItem,
} from "@/core/types";
import { type EnrichOutput, enrichOutput } from "../calls/enrich";
import type { AiField, AiMark } from "../marks";
import { writeSplit } from "./split";

// What an `enrich` answer becomes. A free line from quick add lands in the inbox at once; the
// server asks the AI and, when it is sure, turns the entry into a task (one sitting) or a work
// item (several sittings) of the module it chose. When it is not sure the entry stays in the
// inbox as a card that shows the suggestion; the user confirms it with one tap, here, in the
// browser. Values the user typed on the line (a duration, a day) stay the user's.
// No SDK and no server code in this file.

/** Below this the answer is shown as a card to confirm instead of being applied. */
export const CONFIDENT = 0.6;

/** What a card keeps of an answer it asks the user to confirm. */
export type EnrichSuggestion = {
  call_id: string;
  model: string;
  output: EnrichOutput;
  /** The line as quick add reads it: its title and the day and duration typed at its end. */
  parsed: QuickText;
};

/** True when the answer can be applied without asking: a known module, confidently. */
export function isSure(output: EnrichOutput, moduleIds: ReadonlyMap<string, string>): boolean {
  const slug = output.module.value;
  if (!slug || !moduleIds.has(slug)) return false;
  return Math.min(output.module.confidence, output.target.confidence) >= CONFIDENT;
}

type Target = "task" | "work_item";

/**
 * The record an answer becomes, with the AI mark and the field sources. Pure.
 * - A duration or a day the user typed wins over the AI's and is marked as the user's.
 * - More than one sitting (by the AI's target or by the minutes) makes a work item.
 */
export function enrichedRecord(args: {
  output: EnrichOutput;
  parsed: QuickText;
  moduleId: string;
  /** The user picked the module on the card: it is theirs, not the AI's. */
  userPickedModule: boolean;
  callId: string;
  model: string;
  rawText: string;
  now: Date;
}) {
  const { output, parsed } = args;
  const fields: Record<string, AiField> = {};
  const provenance: Provenance = {};
  const judged = (value: unknown, from: { confidence: number; reason: string }): AiField => ({
    value,
    confidence: from.confidence,
    reason: from.reason,
  });

  if (args.userPickedModule) provenance.module_id = "user";
  else fields.module_id = judged(args.moduleId, output.module);

  const values: Record<string, unknown> = {};
  for (const column of ["energy", "context", "importance"] as const) {
    const answer = output[column];
    if (answer.value === null) continue;
    values[column] = answer.value;
    fields[column] = judged(answer.value, answer);
  }

  let dueAt: string | null = null;
  if (parsed.dueDay) {
    dueAt = dueAtEndOfDay(parsed.dueDay);
    provenance.due_at = "user";
  } else if (output.due.value) {
    dueAt = dueAtEndOfDay(output.due.value);
    fields.due_at = judged(dueAt, output.due);
  }

  const aiMinutes = output.est_minutes.value;
  const minutes = parsed.minutes ?? aiMinutes ?? TASK_DEFAULT_MINUTES;
  const target: Target =
    output.target.value === "work_item" || minutes > TASK_MAX_MINUTES ? "work_item" : "task";
  const minutesColumn = target === "task" ? "est_minutes" : "effort_total_minutes";
  const minutesValue =
    target === "task"
      ? Math.min(TASK_MAX_MINUTES, Math.max(TASK_MIN_MINUTES, Math.round(minutes)))
      : Math.max(TASK_MIN_MINUTES, Math.round(minutes));
  if (parsed.minutes !== null) provenance[minutesColumn] = "user";
  else if (aiMinutes !== null) fields[minutesColumn] = judged(minutesValue, output.est_minutes);

  for (const column of Object.keys(fields)) provenance[column] = "ai";

  const mark: AiMark = {
    kind: "enrich",
    model: args.model,
    at: args.now.toISOString(),
    call_id: args.callId,
    fields,
    user_edited: [],
    input: args.rawText.slice(0, 300),
  };

  // The user's own words; the model's cleaned title only when the line had nothing else.
  const title = parsed.title.trim() || output.title;
  const common = {
    module_id: args.moduleId,
    title,
    due_at: dueAt,
    ...values,
    ai: toJson(mark),
  };
  return target === "task"
    ? { target, row: { ...common, est_minutes: minutesValue } }
    : {
        target,
        row: { ...common, effort_total_minutes: minutesValue, provenance: toJson(provenance) },
      };
}

export type EnrichOutcome =
  | { status: "applied"; target: Target; id: string }
  | { status: "needs_confirm"; entryId: string }
  /** No AI answer (no provider, switched off, budget, failure): the entry waits in the inbox. */
  | { status: "skipped" | "failed"; reason: string }
  /** The entry was routed or dismissed meanwhile; nothing was touched. */
  | { status: "gone" };

/**
 * Writes an answer: from the server when the AI was sure, from the browser when the user
 * confirms a card (then `moduleId` may be the one the user picked). The entry is claimed first,
 * so an entry the user routed by hand in the meantime is left alone.
 */
export async function applyEnrichment(
  db: Db,
  args: {
    entry: InboxEntry;
    output: EnrichOutput;
    parsed: QuickText;
    callId: string;
    model: string;
    moduleId: string;
    moduleSlug: string;
    now: Date;
    /** The module the AI suggested, when the user picked another one on the card. */
    aiModuleSlug?: string | null;
  },
): Promise<EnrichOutcome> {
  const userPickedModule = args.aiModuleSlug !== undefined && args.aiModuleSlug !== args.moduleSlug;
  const { target, row } = enrichedRecord({
    output: args.output,
    parsed: args.parsed,
    moduleId: args.moduleId,
    userPickedModule,
    callId: args.callId,
    model: args.model,
    rawText: args.entry.raw_text,
    now: args.now,
  });

  const claimed = unwrap(
    await db
      .from("inbox_entries")
      .update({ status: "routed", routed_at: args.now.toISOString() })
      .eq("id", args.entry.id)
      .in("status", ["new", "needs_confirm"])
      .select("id, status"),
  );
  if (claimed.length === 0) return { status: "gone" };

  let id: string;
  let createdItem: string | null = null;
  try {
    if (target === "task") {
      id = unwrap(await db.from("tasks").insert(row).select("id").single()).id;
    } else {
      const item = unwrap(
        await db
          .from("work_items")
          .insert(row as never)
          .select("*")
          .single(),
      ) as WorkItem;
      id = item.id;
      createdItem = item.id;
      if (args.output.steps.length > 1) {
        // Steps the AI saw in the line: offered as a split to accept, never applied alone.
        await writeSplit(
          db,
          item,
          args.output.steps.map((step, index) => ({
            ref: String(index),
            title: step.title,
            minutes: step.minutes,
            depends_on: index > 0 ? [String(index - 1)] : [],
            due: null,
          })),
          {
            kind: "enrich",
            callId: args.callId,
            model: args.model,
            reason: args.output.target.reason,
            confidence: args.output.target.confidence,
            now: args.now,
          },
        );
      }
    }
  } catch (error) {
    // Back to where it was, so the entry is not lost behind a "routed" with nothing in it, and
    // a half-written item is not left behind to be created a second time on the next try.
    // (Deleting is right here: the row was made a moment ago by this write and nobody saw it.)
    if (createdItem) check(await db.from("work_items").delete().eq("id", createdItem));
    check(
      await db
        .from("inbox_entries")
        .update({ status: args.entry.status, routed_at: null })
        .eq("id", args.entry.id),
    );
    throw error;
  }

  if (userPickedModule && args.aiModuleSlug) {
    // A module the AI chose and the user changed is a correction like any other (rule 8).
    check(
      await db.from("ai_feedback").insert({
        module_slug: args.moduleSlug,
        kind: "enrich",
        input_summary: args.entry.raw_text.slice(0, 300),
        ai_value: toJson({ module: args.aiModuleSlug }),
        user_value: toJson({ module: args.moduleSlug }),
      }),
    );
  }

  const routed: RoutedTo = [{ type: target, id, module: args.moduleSlug }];
  await markRouted(db, args.entry.id, routed);
  return { status: "applied", target, id };
}

/** Reads a card's stored suggestion back; null when it is not one (or of an older shape). */
export function readSuggestion(entry: InboxEntry): EnrichSuggestion | null {
  const value = entry.suggestion as Partial<EnrichSuggestion> | null;
  if (!value || typeof value !== "object" || !value.call_id || !value.parsed) return null;
  const output = enrichOutput.safeParse(value.output);
  if (!output.success) return null;
  return {
    call_id: value.call_id,
    model: value.model ?? "",
    output: output.data,
    parsed: value.parsed,
  };
}
