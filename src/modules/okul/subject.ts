import type { SceneSubject } from "@/core/contract/types";

// What the module reads off the running work its scene is for (no React: the scene's `when`
// and its component both use it).

/** The work's source type ("okul.homework", "okul.prep"…). */
export const sourceTypeOf = (subject: SceneSubject): string | null =>
  subject.kind === "task"
    ? (subject.workItem?.source_type ?? subject.task.source_type)
    : subject.rhythm.source_type;

/** The module's record behind the running work. */
export const sourceIdOf = (subject: SceneSubject): string | null =>
  subject.kind === "task"
    ? (subject.workItem?.source_id ?? subject.task.source_id)
    : subject.rhythm.source_id;
