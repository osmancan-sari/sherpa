import { type DecomposeInput, decomposeSpec } from "../calls/decompose";
import { type AiDeps, runAiCall } from "../gateway";
import { dayKey } from "@/lib/date";
import { proposedChildren, writeSplit } from "./split";

// `decompose`: a goal or a large work item → smaller work items, as a suggestion. The pieces
// are written as `proposed` children; nothing becomes work until the user accepts them.

export type DecomposeOutcome =
  | { status: "proposed"; ids: string[]; reason: string }
  | { status: "skipped" | "failed"; reason: string }
  /** The item is closed or gone. */
  | { status: "gone" };

/** How sure a split is: the model gives no number for it, the user decides anyway. */
const SPLIT_CONFIDENCE = 0.6;

export async function decomposeWorkItem(
  deps: AiDeps,
  request: { id: string },
  now: Date,
): Promise<DecomposeOutcome> {
  const { db } = deps;
  const item = (await db.from("work_items").select("*").eq("id", request.id).maybeSingle()).data;
  if (!item || (item.status !== "active" && item.status !== "waiting")) return { status: "gone" };

  // A suggestion still waiting for an answer is not asked for twice.
  const waiting = await proposedChildren(db, item.id);
  if (waiting.length > 0) {
    return { status: "proposed", ids: waiting.map((child) => child.id), reason: "" };
  }

  const mod = (await db.from("modules").select("slug, name").eq("id", item.module_id).maybeSingle())
    .data;
  const input: DecomposeInput = {
    title: item.title,
    module: mod ? { slug: mod.slug, name: mod.name } : null,
    today: dayKey(now),
    due: item.due_at ? dayKey(new Date(item.due_at)) : null,
    effort_total_minutes: item.effort_total_minutes,
    context: (item.meta ?? {}) as Record<string, unknown>,
  };
  const result = await runAiCall(deps, decomposeSpec, input, {
    subject: { type: "work_item", id: item.id },
  });
  if (result.status !== "ok") return { status: result.status, reason: result.reason };

  const ids = await writeSplit(
    db,
    item,
    result.output.steps.map((step) => ({
      ref: step.ref,
      title: step.title,
      minutes: step.effort_minutes,
      depends_on: step.depends_on,
      due: step.due,
    })),
    {
      kind: "decompose",
      callId: result.callId,
      model: result.model,
      reason: result.output.reason,
      confidence: SPLIT_CONFIDENCE,
      now,
    },
  );
  return { status: "proposed", ids, reason: result.output.reason };
}
