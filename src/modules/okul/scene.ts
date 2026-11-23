import type { ModuleScene } from "@/core/contract/types";
import { OkulScene } from "./components/Scenes";
import { SOURCE } from "./server/proposals";
import { updateAssessment } from "./queries";
import { sourceIdOf, sourceTypeOf } from "./subject";

// The module's scene (docs/06-modul-sozlesmesi.md, "Sahne"): the preparation, the homework and the
// step on the kit's layouts, the hand-in and the meeting on its checklist (okul-sahneler.md).

const SCENED: string[] = [SOURCE.prep, SOURCE.homework, SOURCE.step, SOURCE.submit, SOURCE.meeting];

export const okulScene: ModuleScene = {
  when: (subject) => SCENED.includes(sourceTypeOf(subject) ?? ""),
  component: OkulScene,
  look: { tone: "focus" },
  // Homework and steps: one line of where it stood, shown from the next sitting on ("Kaldığın
  // yer"; rule 12, frames K3T6, SahneKaldiginYerOdev). A preparation has none (step 3 knows it).
  beforeExit: {
    when: (subject) => [SOURCE.homework, SOURCE.step].includes(sourceTypeOf(subject) as never),
    title: "Nerede kaldın?",
    hint: "Tek cümle; sonraki oturumun başında görürsün",
    async save(text, { subject, ctx }) {
      const id = sourceIdOf(subject);
      if (!id) return;
      await updateAssessment(ctx, id, {
        resume_note: text.trim().slice(0, 300),
        resume_noted_at: new Date().toISOString(),
      });
    },
  },
};
