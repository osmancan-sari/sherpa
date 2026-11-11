import type { ModuleRegistry } from "@/core/contract/types";
import { type Db, type Provenance, toJson, unwrap, type WorkItem } from "@/core/types";
import { dayKey } from "@/lib/date";
import { type SizeField, type SizeInput, type SizeOutput, sizeSpec } from "../calls/size";
import { type AiDeps, runAiCall } from "../gateway";
import { type AiField, mergeMark, readMark } from "../marks";
import { finishedItemsOfModule } from "./context";

// `size`: a module proposed a work item and left judgement fields empty (or the core filled
// them with a default). The AI estimates them once; the module's own values, the user's
// values and the AI's earlier estimates stay. Only a change of scope (title, `meta`, bounds)
// asks again for what the AI set before (docs/04-planlayici.md, "Efor istikrarı").

export const SIZE_FIELDS: readonly SizeField[] = [
  "effort_total_minutes",
  "session_minutes",
  "importance",
  "energy",
];

/** The fields the AI is asked for. Pure. */
export function sizeNeeds(
  item: Pick<WorkItem, "status" | "provenance">,
  rescope: boolean,
): SizeField[] {
  if (item.status !== "active" && item.status !== "proposed") return [];
  const provenance = (item.provenance ?? {}) as Provenance;
  return SIZE_FIELDS.filter((field) => {
    const source = provenance[field];
    if (source === "user" || source === "module") return false;
    if (source === "ai") return rescope;
    return true;
  });
}

/** What the work is, as far as its size goes: a change here asks the AI again. */
export function scopeOf(
  item: Pick<WorkItem, "title" | "meta" | "effort_min_minutes" | "effort_max_minutes">,
): string {
  return JSON.stringify([
    item.title,
    canonical(item.meta ?? {}),
    item.effort_min_minutes,
    item.effort_max_minutes,
  ]);
}

/** The same value with object keys in a fixed order: jsonb comes back re-ordered. */
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
 * True when the AI sized the item before and its scope has changed since (docs/04, "Efor
 * istikrarı"). Decided here, from the data, not by whoever asks.
 */
export function scopeChanged(item: WorkItem): boolean {
  const scope = readMark(item.ai)?.scope;
  return scope !== undefined && scope !== scopeOf(item);
}

/** The estimate inside the module's bounds, rounded to five minutes. */
export function clampEffort(
  minutes: number,
  item: Pick<WorkItem, "effort_min_minutes" | "effort_max_minutes">,
) {
  let value = Math.max(5, Math.round(minutes / 5) * 5);
  if (item.effort_min_minutes !== null) value = Math.max(item.effort_min_minutes, value);
  if (item.effort_max_minutes !== null) value = Math.min(item.effort_max_minutes, value);
  return value;
}

/** The columns an answer writes: only the asked fields the AI could tell. Pure. */
export function sizeColumns(
  item: Pick<WorkItem, "effort_min_minutes" | "effort_max_minutes">,
  need: SizeField[],
  output: SizeOutput,
): { values: Record<string, unknown>; fields: Record<string, AiField> } {
  const values: Record<string, unknown> = {};
  const fields: Record<string, AiField> = {};
  for (const field of need) {
    const answer = output[field];
    if (answer.value === null) continue;
    const value =
      field === "effort_total_minutes" ? clampEffort(answer.value as number, item) : answer.value;
    values[field] = value;
    fields[field] = { value, confidence: answer.confidence, reason: answer.reason };
  }
  return { values, fields };
}

export type SizeOutcome =
  | { status: "applied"; fields: string[] }
  /** Nothing to estimate: the module, the user or an earlier answer filled every field. */
  | { status: "not_needed" }
  | { status: "skipped" | "failed"; reason: string }
  /** The item went away or changed while the AI was thinking; the next proposal asks again. */
  | { status: "gone" };

export async function buildSizeInput(
  db: Db,
  registry: ModuleRegistry,
  item: WorkItem,
  need: SizeField[],
  now: Date,
): Promise<SizeInput | null> {
  const mod = (await db.from("modules").select("*").eq("id", item.module_id).maybeSingle()).data;
  if (!mod) return null;
  const provenance = (item.provenance ?? {}) as Provenance;
  const known = (field: string) => provenance[field] === "module" || provenance[field] === "user";
  return {
    title: item.title,
    module: { slug: mod.slug, name: mod.name },
    sizing_hints: registry.get(mod.slug)?.sizingHints ?? null,
    today: dayKey(now),
    due: item.due_at ? dayKey(new Date(item.due_at)) : null,
    hard_deadline: item.due_is_hard,
    known: {
      importance: known("importance") ? item.importance : null,
      energy: known("energy") ? item.energy : null,
      session_minutes: known("session_minutes") ? item.session_minutes : null,
    },
    bounds:
      item.effort_min_minutes !== null && item.effort_max_minutes !== null
        ? { min: item.effort_min_minutes, max: item.effort_max_minutes }
        : null,
    meta: (item.meta ?? {}) as Record<string, unknown>,
    need,
    similar: await finishedItemsOfModule(db, item.module_id, item.title),
  };
}

/** Estimates the empty judgement fields of a work item and writes them, marked as the AI's. */
export async function sizeWorkItem(
  deps: AiDeps,
  registry: ModuleRegistry,
  request: { id: string },
  now: Date,
): Promise<SizeOutcome> {
  const { db } = deps;
  const item = (await db.from("work_items").select("*").eq("id", request.id).maybeSingle()).data;
  if (!item) return { status: "gone" };
  const need = sizeNeeds(item, scopeChanged(item));
  if (need.length === 0) return { status: "not_needed" };

  const input = await buildSizeInput(db, registry, item, need, now);
  if (!input) return { status: "gone" };
  const result = await runAiCall(deps, sizeSpec, input, {
    subject: { type: "work_item", id: item.id },
  });
  if (result.status !== "ok") return { status: result.status, reason: result.reason };

  const { values, fields } = sizeColumns(item, need, result.output);
  if (Object.keys(fields).length === 0) return { status: "applied", fields: [] };

  const provenance: Provenance = { ...((item.provenance ?? {}) as Provenance) };
  for (const field of Object.keys(fields)) provenance[field] = "ai";
  const mark = mergeMark(readMark(item.ai), {
    kind: "size",
    model: result.model,
    at: now.toISOString(),
    call_id: result.callId,
    fields,
    input: `${item.title} ${JSON.stringify(item.meta ?? {})}`.slice(0, 300),
    scope: scopeOf(item),
  });

  // Only onto the row the estimate was made for: an edit in the meantime wins.
  const written = unwrap(
    await db
      .from("work_items")
      .update({ ...values, provenance: toJson(provenance), ai: toJson(mark) } as never)
      .eq("id", item.id)
      .eq("updated_at", item.updated_at)
      .select("id"),
  );
  if (written.length === 0) return { status: "gone" };
  return { status: "applied", fields: Object.keys(fields) };
}
