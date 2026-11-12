import type { SceneSubject } from "@/core/contract/types";

// What the module reads off the running work its scene is for (no React: the scene's `when`
// and its component both use it).

/** The record's kind, as its proposal carried it in `meta`. */
export const kindOf = (subject: SceneSubject): unknown =>
  subject.kind === "task"
    ? ((subject.workItem?.meta ?? subject.task.meta) as Record<string, unknown> | null)?.kind
    : (subject.rhythm.meta as Record<string, unknown> | null)?.kind;

/** The module's record behind the running work. */
export const sourceOf = (subject: SceneSubject): string | null =>
  subject.kind === "task" ? subject.task.source_id : subject.rhythm.source_id;
