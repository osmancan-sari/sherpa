import type { ModuleScene } from "@/core/contract/types";
import { DenemeScene, DenemeWelcome, NightScene, SunScene } from "./components/Scenes";
import { updateItem } from "./queries";
import { kindOf, sourceOf } from "./subject";

// The module's scene (docs/06-modul-sozlesmesi.md, "Sahne"): when it comes, here (it runs on the
// server too, where a client component is only a reference); what it draws, in
// components/Scenes.tsx. A focused sitting ("odak") and a workout have one; a goal and a habit do not.

export const denemeScene: ModuleScene = {
  when: (subject) => ["odak", "antrenman", "pomodoro", "akis"].includes(kindOf(subject) as string),
  component: DenemeScene,
  look: { tone: "focus" },
  // Ç3g: the scene takes the Today keys: Space is the workout's next step, the focus's "Bitti",
  // the flow's "Bitir" (through its note); the pomodoro leaves Space alone (its buttons).
  keys: "scene",
  // Sabah açılışı: a focused sitting or a workout bound to the waking, first in the morning's
  // chain, opens the app on this welcome (the facets' sunny and night scenes have none).
  welcome: DenemeWelcome,
  // Okul çekirdek A: on the way out of a flow ("akis"), one line of where it stood; the next
  // sitting shows it ("Kaldığın yer"). A line with "[hata]" fails on purpose (the way out goes on).
  beforeExit: {
    when: (subject) => kindOf(subject) === "akis",
    title: "Nerede kaldın?",
    hint: "Tek cümle; sonraki oturumun başında görürsün",
    async save(text, { subject, ctx }) {
      if (text.includes("[hata]")) throw new Error("deneme: the note fails on purpose");
      const id = sourceOf(subject);
      if (!id) return;
      await updateItem(ctx, id, { exit_note: text, exit_noted_at: new Date().toISOString() });
    },
  },
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
