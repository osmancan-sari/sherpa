import { dueAtEndOfDay } from "@/core/intake/parse";
import { check, type Db, type Provenance, toJson, unwrap, type WorkItem } from "@/core/types";
import type { AiKind } from "../types";
import type { AiField, AiMark } from "../marks";

// A suggested split of a work item into smaller ones. The pieces are written as child work
// items in the `proposed` state: the planner and the Today screen leave them alone until the
// user accepts them (one tap), and a declined split is dropped. No SDK and no server code here:
// the browser accepts and declines.

export type SplitStep = {
  /** Id of the step inside the answer; `depends_on` refers to it. */
  ref: string;
  title: string;
  minutes: number;
  depends_on: string[];
  /** yyyy-MM-dd, or null. */
  due: string | null;
};

export type SplitSource = {
  kind: AiKind;
  callId: string;
  model: string;
  /** One sentence on how the work was split; the reason of every piece's values. */
  reason: string;
  confidence: number;
  now: Date;
};

/** The child rows of a split, without ids. Pure, so the shape can be tested. */
export function splitRows(parent: WorkItem, steps: SplitStep[], source: SplitSource) {
  const parentDue = parent.due_at ? Date.parse(parent.due_at) : null;
  return steps.map((step, index) => {
    let dueAt = step.due ? dueAtEndOfDay(step.due) : null;
    // A piece is never due after the whole: the model was told so, the data makes sure.
    if (dueAt && parentDue !== null && Date.parse(dueAt) > parentDue) dueAt = parent.due_at;
    const field = (value: unknown): AiField => ({
      value,
      confidence: source.confidence,
      reason: source.reason,
    });
    const fields: Record<string, AiField> = { effort_total_minutes: field(step.minutes) };
    if (dueAt) fields.due_at = field(dueAt);
    const mark: AiMark = {
      kind: source.kind,
      model: source.model,
      at: source.now.toISOString(),
      call_id: source.callId,
      fields,
      user_edited: [],
      input: parent.title.slice(0, 300),
    };
    const provenance: Provenance = Object.fromEntries(
      Object.keys(fields).map((column) => [column, "ai" as const]),
    );
    return {
      ref: step.ref,
      dependsOnRefs: step.depends_on,
      row: {
        id: crypto.randomUUID(),
        module_id: parent.module_id,
        parent_id: parent.id,
        title: step.title,
        status: "proposed" as const,
        due_at: dueAt ?? parent.due_at,
        due_is_hard: false,
        effort_total_minutes: step.minutes,
        importance: parent.importance,
        energy: parent.energy,
        context: parent.context,
        // Ç3e: the pieces stay in the item's facet (its colour and scene).
        facet: parent.facet,
        provenance: toJson(provenance),
        ai: toJson(mark),
        // One write makes every piece at the same instant; a millisecond apart, they read
        // back in their order everywhere (lists sort by creation).
        created_at: new Date(source.now.getTime() + index).toISOString(),
      },
    };
  });
}

/** Writes a split as proposed children of the item and links their dependencies. */
export async function writeSplit(
  db: Db,
  parent: WorkItem,
  steps: SplitStep[],
  source: SplitSource,
): Promise<string[]> {
  const rows = splitRows(parent, steps, source);
  // The ids are made here, so the dependencies go in with the rows in one write.
  const idByRef = new Map(rows.map(({ ref, row }) => [ref, row.id]));
  check(
    await db.from("work_items").insert(
      rows.map(({ row, dependsOnRefs }) => ({
        ...row,
        depends_on: dependsOnRefs.flatMap((ref) => idByRef.get(ref) ?? []),
      })),
    ),
  );
  return rows.map(({ row }) => row.id);
}

/** The pieces of a suggested split still waiting for an answer. */
export async function proposedChildren(db: Db, parentId: string): Promise<WorkItem[]> {
  return unwrap(
    await db
      .from("work_items")
      .select("*")
      .eq("parent_id", parentId)
      .eq("status", "proposed")
      .order("created_at"),
  );
}

/** "Böl": the suggested pieces become work. */
export async function acceptSplit(db: Db, parentId: string): Promise<void> {
  check(
    await db
      .from("work_items")
      .update({ status: "active" })
      .eq("parent_id", parentId)
      .eq("status", "proposed"),
  );
}

/** "Bölme": the suggestion is dropped; nothing is deleted. */
export async function declineSplit(db: Db, parentId: string): Promise<void> {
  check(
    await db
      .from("work_items")
      .update({ status: "dropped" })
      .eq("parent_id", parentId)
      .eq("status", "proposed"),
  );
}
