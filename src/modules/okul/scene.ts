import type { ModuleScene } from "@/core/contract/types";
import { OkulScene } from "./components/Scenes";
import { SOURCE } from "./server/proposals";
import { sourceTypeOf } from "./subject";

// The module's scene (docs/06-modul-sozlesmesi.md, "Sahne"): the preparation, the homework and the
// step on the kit's layouts, the hand-in and the meeting on its checklist (okul-sahneler.md).

const SCENED: string[] = [SOURCE.prep, SOURCE.homework, SOURCE.step, SOURCE.submit, SOURCE.meeting];

export const okulScene: ModuleScene = {
  when: (subject) => SCENED.includes(sourceTypeOf(subject) ?? ""),
  component: OkulScene,
  look: { tone: "focus" },
};
