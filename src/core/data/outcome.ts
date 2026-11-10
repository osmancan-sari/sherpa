import type { ModuleRegistry, Outcome } from "@/core/contract/types";
import { CORE_EVENTS, emitEvent } from "@/core/events/bus";
import { check, type Db, type Prompt, type Provenance, unwrap, type WorkItem } from "@/core/types";
import { markUserEdited } from "@/core/contract/envelope";
import { createModuleContext } from "./context";
import { answerPrompt } from "./inbox";
import { stopSessionsOnItem } from "./sessions";

// The moments the core reports back to a module: a proposed work item was closed (`onOutcome`),
// a question was answered (`core.prompt_answered`).

/** What a work item cost: finished sessions on its sittings. */
export async function measureOutcome(
  db: Db,
  item: WorkItem,
  result: "done" | "dropped",
): Promise<Outcome> {
  const tasks = unwrap(await db.from("tasks").select("id").eq("work_item_id", item.id));
  let spentMinutes = 0;
  let sessionCount = 0;
  if (tasks.length > 0) {
    const sessions = unwrap(
      await db
        .from("sessions")
        .select("started_at, ended_at, measured")
        .in(
          "task_id",
          tasks.map((task) => task.id),
        )
        .not("ended_at", "is", null),
    );
    for (const session of sessions) {
      if (!session.measured) continue;
      sessionCount += 1;
      spentMinutes += Math.round(
        (Date.parse(session.ended_at!) - Date.parse(session.started_at)) / 60_000,
      );
    }
  }
  return {
    key: item.key ?? "",
    source: { type: item.source_type, id: item.source_id },
    result,
    estimatedMinutes: item.effort_total_minutes,
    spentMinutes,
    sessionCount,
    postponedCount: 0,
  };
}

/**
 * The user closes a work item, as finished or as dropped. Its open sittings close with it.
 * If a module proposed the item, the module is told what it cost.
 */
export async function closeWorkItem(
  db: Db,
  registry: ModuleRegistry,
  itemId: string,
  result: "done" | "dropped",
): Promise<WorkItem> {
  const current = unwrap(await db.from("work_items").select("*").eq("id", itemId).single());
  if (current.status === "done" || current.status === "dropped") return current;

  await stopSessionsOnItem(db, itemId);
  check(
    await db
      .from("tasks")
      .update(
        result === "done"
          ? { status: "done", done_at: new Date().toISOString() }
          : { status: "dropped" },
      )
      .eq("work_item_id", itemId)
      .in("status", ["todo", "doing", "waiting"]),
  );
  const closed = unwrap(
    await db
      .from("work_items")
      .update({
        status: result,
        // The user closed it: a later proposal with the same key does not reopen it.
        provenance: markUserEdited(current.provenance as Provenance, ["status"]),
      })
      .eq("id", itemId)
      .select()
      .single(),
  );

  if (closed.key) {
    const mod = unwrap(await db.from("modules").select("*").eq("id", closed.module_id).single());
    const def = registry.get(mod.slug);
    if (def?.onOutcome) {
      const outcome = await measureOutcome(db, closed, result);
      try {
        await def.onOutcome(outcome, createModuleContext({ db, registry, module: mod }));
      } catch (error) {
        // The item is closed either way; a module that cannot take the news does not undo it.
        console.error(`onOutcome of module "${mod.slug}" failed`, error);
      }
    }
  }
  return closed;
}

/** Records the answer to a module's question and tells the module. */
export async function answerModulePrompt(
  db: Db,
  registry: ModuleRegistry,
  prompt: Prompt,
  value: string,
): Promise<void> {
  const answered = await answerPrompt(db, prompt.id, value);
  // Answered already (on the other screen): the module has been told once, that is enough.
  if (!answered) return;
  const mod = unwrap(await db.from("modules").select("slug").eq("id", prompt.module_id).single());
  await emitEvent({
    db,
    registry,
    type: CORE_EVENTS.promptAnswered,
    moduleSlug: null,
    payload: {
      module: mod.slug,
      kind: prompt.kind,
      subject_type: prompt.subject_type,
      subject_id: prompt.subject_id,
      value,
    },
  });
}
