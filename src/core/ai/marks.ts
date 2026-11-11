import { check, type Db, toJson } from "@/core/types";
import type { Json } from "@/lib/supabase/database.types";
import type { AiKind } from "./types";

// The `ai` column of tasks and work items (docs/10-yapay-zeka.md, "tasks.ai"): which values the
// AI set, how sure it was and why, and which of them the user has changed since. A value the
// user changed is never set by the AI again. No SDK and no server code here: the browser uses
// it to show the marks and to record corrections.

export type AiField = {
  value: unknown;
  confidence: number;
  reason: string;
  /** The call that set this field, when it is not the mark's own (size after enrich). */
  kind?: AiKind;
};

export type AiMark = {
  kind: AiKind;
  model: string;
  /** When the values were set. */
  at: string;
  /** The `ai_calls` row the values came from. */
  call_id: string;
  /** Column name → what the AI set there. */
  fields: Record<string, AiField>;
  /** Columns the user changed after the AI set them. */
  user_edited: string[];
  /** The short input the call saw; shown again as an example when the user corrects it. */
  input: string;
};

export function readMark(value: Json | null | undefined): AiMark | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const mark = value as Partial<AiMark>;
  if (!mark.fields || typeof mark.fields !== "object") return null;
  return {
    kind: mark.kind ?? "enrich",
    model: mark.model ?? "",
    at: mark.at ?? "",
    call_id: mark.call_id ?? "",
    fields: mark.fields,
    user_edited: Array.isArray(mark.user_edited) ? mark.user_edited : [],
    input: mark.input ?? "",
  };
}

/** A field the AI set and the user has not changed: it carries the AI mark on screen. */
export function aiField(mark: AiMark | null, column: string): AiField | null {
  if (!mark || mark.user_edited.includes(column)) return null;
  return mark.fields[column] ?? null;
}

/**
 * Merges new AI values into an existing mark. Fields the user already changed stay out, and
 * earlier fields of another call are kept.
 */
export function mergeMark(existing: AiMark | null, next: Omit<AiMark, "user_edited">): AiMark {
  const userEdited = existing?.user_edited ?? [];
  const fields = { ...(existing?.fields ?? {}) };
  for (const [column, field] of Object.entries(next.fields)) {
    if (!userEdited.includes(column)) fields[column] = { ...field, kind: next.kind };
  }
  // Earlier fields keep the call that set them; the mark's own kind is the first call's.
  for (const [column, field] of Object.entries(existing?.fields ?? {})) {
    if (!(column in next.fields)) fields[column] = { kind: existing!.kind, ...field };
  }
  return {
    ...next,
    kind: existing?.kind ?? next.kind,
    input: existing?.input || next.input,
    fields,
    user_edited: userEdited,
  };
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "string" && typeof b === "string") {
    const [x, y] = [Date.parse(a), Date.parse(b)];
    if (!Number.isNaN(x) && x === y && /^\d{4}-\d{2}-\d{2}/.test(a)) return true;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

export type Correction = { column: string; kind: AiKind; ai: unknown; user: unknown };

/** The fields of an edit that change a value the AI set (and the user had not changed yet). */
export function corrections(mark: AiMark | null, edit: Record<string, unknown>): Correction[] {
  if (!mark) return [];
  return Object.entries(edit).flatMap(([column, value]) => {
    const field = aiField(mark, column);
    if (!field || same(field.value, value)) return [];
    return [{ column, kind: field.kind ?? mark.kind, ai: field.value, user: value }];
  });
}

/**
 * Records the user's corrections of AI values (`ai_feedback`) and returns the mark with those
 * columns marked as the user's. The examples travel with later calls (rule 8).
 */
export async function recordCorrections(
  db: Db,
  args: { mark: AiMark | null; edit: Record<string, unknown>; moduleSlug: string | null },
): Promise<AiMark | null> {
  const found = corrections(args.mark, args.edit);
  if (!args.mark || found.length === 0) return args.mark;
  check(
    await db.from("ai_feedback").insert(
      found.map((correction) => ({
        // A piece of work without a module is still an example for routing.
        module_slug: args.moduleSlug ?? "-",
        kind: correction.kind,
        input_summary: args.mark!.input.slice(0, 300),
        ai_value: toJson({ [correction.column]: correction.ai }),
        user_value: toJson({ [correction.column]: correction.user }),
      })),
    ),
  );
  return {
    ...args.mark,
    user_edited: [...new Set([...args.mark.user_edited, ...found.map((c) => c.column)])],
  };
}
