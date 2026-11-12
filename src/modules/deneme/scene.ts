import type { ModuleScene, SceneSubject } from "@/core/contract/types";
import { DenemeScene } from "./components/Scenes";

// The module's scene (docs/06-modul-sozlesmesi.md, "Sahne"): when it comes, here (it runs on the
// server too, where a client component is only a reference); what it draws, in
// components/Scenes.tsx. A goal's sitting and a workout have one; a habit does not.

/** The record's kind, as its proposal carried it in `meta`. */
export const kindOf = (subject: SceneSubject): unknown =>
  subject.kind === "task"
    ? ((subject.workItem?.meta ?? subject.task.meta) as Record<string, unknown> | null)?.kind
    : (subject.rhythm.meta as Record<string, unknown> | null)?.kind;

/** The module's record behind the running work. */
export const sourceOf = (subject: SceneSubject): string | null =>
  subject.kind === "task" ? subject.task.source_id : subject.rhythm.source_id;

export const denemeScene: ModuleScene = {
  when: (subject) => kindOf(subject) === "hedef" || kindOf(subject) === "antrenman",
  component: DenemeScene,
  look: { tone: "focus" },
};
