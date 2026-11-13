import type { ModuleScene } from "@/core/contract/types";
import { DenemeScene, NightScene, SunScene } from "./components/Scenes";
import { kindOf } from "./subject";

// The module's scene (docs/06-modul-sozlesmesi.md, "Sahne"): when it comes, here (it runs on the
// server too, where a client component is only a reference); what it draws, in
// components/Scenes.tsx. A focused sitting ("odak") and a workout have one; a goal and a habit do not.

export const denemeScene: ModuleScene = {
  when: (subject) => kindOf(subject) === "odak" || kindOf(subject) === "antrenman",
  component: DenemeScene,
  look: { tone: "focus" },
};

// Ç3e: the scenes the fixed facets name (module.ts, `facets`): any running work of the morning
// gets the sunny one, any of the evening the night one. The core chooses by the work's facet.
export const sunScene: ModuleScene = {
  when: () => true,
  component: SunScene,
  look: { tone: "energy" },
};

export const nightScene: ModuleScene = {
  when: () => true,
  component: NightScene,
  look: { tone: "calm" },
};
