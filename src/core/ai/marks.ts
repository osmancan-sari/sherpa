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
  /** `size`: the scope (title, meta, bounds) the estimate was made for; a new scope asks again. */
  scope?: string;
  /**
   * Columns the core filled with a default because the AI could not tell (`enrich` without a
   * duration): `size` is asked to estimate them, once.
   */
  defaults?: string[];
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
    ...(typeof mark.scope === "string" ? { scope: mark.scope } : {}),
    ...(Array.isArray(mark.defaults) && mark.defaults.length > 0
      ? { defaults: mark.defaults }
      : {}),
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
  // A default the new call estimated is no longer one.
  const defaults = [...new Set([...(existing?.defaults ?? []), ...(next.defaults ?? [])])].filter(
    (column) => !(column in next.fields),
  );
  const merged: AiMark = {
    ...next,
    kind: existing?.kind ?? next.kind,
    input: existing?.input || next.input,
    ...((next.scope ?? existing?.scope) !== undefined
      ? { scope: next.scope ?? existing?.scope }
      : {}),
    fields,
    user_edited: userEdited,
  };
  delete merged.defaults;
  if (defaults.length > 0) merged.defaults = defaults;
  return merged;
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

/** One `ai_feedback` row: a value the AI set and what the user made of it. */
export type FeedbackRow = {
  module_slug: string;
  kind: AiKind;
  input_summary: string;
  ai_value: NonNullable<Json>;
  user_value: NonNullable<Json>;
};

/**
 * What an edit means for the AI's values: the rows of `ai_feedback` it adds and the mark with
 * those columns as the user's. Null when it corrects nothing. Pure; the caller writes the rows
 * only after the edit itself was saved (the log cannot be undone).
 */
export function planCorrections(args: {
  mark: AiMark | null;
  edit: Record<string, unknown>;
  moduleSlug: string | null;
}): { mark: AiMark; rows: FeedbackRow[] } | null {
  const found = corrections(args.mark, args.edit);
  if (!args.mark || found.length === 0) return null;
  const mark = args.mark;
  return {
    mark: {
      ...mark,
      user_edited: [...new Set([...mark.user_edited, ...found.map((c) => c.column)])],
    },
    rows: found.map((correction) => ({
      // A piece of work without a module is still an example for routing.
      module_slug: args.moduleSlug ?? "-",
      kind: correction.kind,
      input_summary: mark.input.slice(0, 300),
      ai_value: toJson({ [correction.column]: correction.ai }),
      user_value: toJson({ [correction.column]: correction.user }),
    })),
  };
}

/** Writes corrections (rule 8): the examples travel with later calls. */
export async function saveCorrections(db: Db, rows: FeedbackRow[]): Promise<void> {
  if (rows.length === 0) return;
  check(await db.from("ai_feedback").insert(rows));
}

/**
 * The mark as it stands next to the field sources: a field the module or the user has set since
 * is no longer the AI's, whatever the mark still holds. Rows without sources (tasks) keep it.
 */
export function currentMark(mark: AiMark | null, provenance: unknown): AiMark | null {
  if (!mark || !provenance || typeof provenance !== "object") return mark;
  const sources = provenance as Record<string, string>;
  const fields = Object.fromEntries(
    Object.entries(mark.fields).filter(
      ([column]) => sources[column] === undefined || sources[column] === "ai",
    ),
  );
  return { ...mark, fields };
}
