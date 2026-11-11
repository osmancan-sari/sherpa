import { z } from "zod";
import type { AiCallSpec } from "../gateway";
import { dayString, SHARED_RULES } from "./common";

// `decompose`: a goal or a large work item → smaller work items, in order, with dependencies.
// The answer is a suggestion; the user accepts it before anything is written.

export type DecomposeInput = {
  title: string;
  module: { slug: string; name: string } | null;
  today: string;
  due: string | null;
  effort_total_minutes: number | null;
  /** Anything the module or the user knows about the work (`meta`, notes). */
  context: Record<string, unknown>;
};

const step = z.object({
  /** A short id of the step inside this answer ("a", "b", …); used by depends_on. */
  ref: z.string().min(1).max(20),
  title: z.string().min(1).max(200),
  effort_minutes: z.number().int().min(5).max(6000),
  /** Refs of the steps that must be finished first. */
  depends_on: z.array(z.string().min(1).max(20)).max(12),
  /** A step's own deadline, when the overall deadline implies one. */
  due: dayString.nullable(),
});

export const decomposeOutput = z
  .object({
    steps: z.array(step).min(2).max(12),
    reason: z.string().max(400),
  })
  .superRefine((value, ctx) => {
    const refs = value.steps.map((s) => s.ref);
    const known = new Set(refs);
    if (known.size !== refs.length) {
      ctx.addIssue({ code: "custom", path: ["steps"], message: "refs must be unique" });
    }
    value.steps.forEach((s, index) => {
      for (const dep of s.depends_on) {
        // A step may only wait for one listed before it: this also rules out cycles.
        if (!known.has(dep) || refs.indexOf(dep) >= index) {
          ctx.addIssue({
            code: "custom",
            path: ["steps", index, "depends_on"],
            message: `unknown or later step "${dep}"`,
          });
        }
      }
    });
  });

export type DecomposeOutput = z.infer<typeof decomposeOutput>;

export const decomposeSpec: AiCallSpec<DecomposeOutput> = {
  kind: "decompose",
  version: "decompose-1",
  maxTokens: 8000,
  schema: decomposeOutput,
  system: `Break a goal or a large piece of work into 2 to 12 smaller pieces of work, in the
order they should be done.

- Each step is a concrete piece of work with a Turkish title that says what is produced
  ("Literatür taraması: 5 kaynak", not "Araştırma").
- effort_minutes is the step's total effort; a step may need several sittings.
- depends_on lists the refs of earlier steps that must be finished first; only list real
  dependencies. A step may only depend on steps listed before it.
- If "effort_total_minutes" is given, the steps add up to roughly that.
- due: a step's own deadline when the overall deadline implies one (for example a draft before
  the final hand-in), else null. No step is due after the overall deadline.
- reason: one or two sentences on how you split it.

${SHARED_RULES}`,
};
