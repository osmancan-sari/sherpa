import type { ModuleScene } from "@/core/contract/types";
import { RutinScene } from "./components/RutinScene";
import { isRoutineKey } from "./server/flow";

// The scene (docs/06-modul-sozlesmesi.md, "Sahne"; docs/moduller/rutin.md, 8.2): any of the three
// routines' rhythms. Both facets name it; it draws the morning or the evening by the facet. The
// sky is the module's own (it paints the whole scene), so the core's frame keeps a calm tone.

export const rutinScene: ModuleScene = {
  when: (subject) =>
    subject.kind === "rhythm" &&
    isRoutineKey((subject.rhythm.meta as Record<string, unknown> | null)?.routine),
  component: RutinScene,
  look: { tone: "calm" },
};
