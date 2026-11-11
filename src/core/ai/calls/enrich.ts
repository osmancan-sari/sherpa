import { z } from "zod";
import type { AiCallSpec } from "../gateway";
import { CONTEXT, dayString, ENERGY, judged, SHARED_RULES } from "./common";

// `enrich`: one line typed into quick add → a piece of work with its module, size and date.

export type EnrichInput = {
  text: string;
  today: string;
  weekday: string;
  /** The active modules and what kind of entries they take (their `intake` catalogue). */
  modules: {
    slug: string;
    name: string;
    area: string | null;
    intake: { label: string; examples: string[] }[];
  }[];
  /** Up to 5 finished pieces of similar work and how long they really took. */
  similar: { title: string; module: string | null; minutes: number }[];
  /** The user's last corrections of this call's answers (at most 10 per module). */
  corrections: { module: string; input: string; ai: unknown; user: unknown }[];
};

export const enrichOutput = z.object({
  title: z.string().min(1).max(200),
  /** Slug of one of the given modules, or null for work that belongs to none. */
  module: judged(z.string()),
  /** "task": done in one sitting (at most 90 minutes). "work_item": needs several sittings. */
  target: judged(z.enum(["task", "work_item"])),
  /** For a task its length, for a work item its total effort, in minutes. */
  est_minutes: judged(z.number().int().min(5).max(6000)),
  energy: judged(z.enum(ENERGY)),
  context: judged(z.enum(CONTEXT)),
  /** 1 low … 4 very high. */
  importance: judged(z.number().int().min(1).max(4)),
  due: judged(dayString),
  /** Only for a work item that clearly falls into steps; otherwise empty. */
  steps: z
    .array(
      z.object({ title: z.string().min(1).max(200), minutes: z.number().int().min(5).max(90) }),
    )
    .max(8),
});

export type EnrichOutput = z.infer<typeof enrichOutput>;

export const enrichSpec: AiCallSpec<EnrichOutput> = {
  kind: "enrich",
  version: "enrich-1",
  maxTokens: 4000,
  schema: enrichOutput,
  system: `You turn one line the user typed into a planning app into a piece of work.

The app (Sherpa) collects all of the user's work in one pool and always shows what to do now.
Work belongs to a module (an area of life such as school or nutrition) or to none.

From the input:
- title: the work as a short Turkish title, without the date or duration words of the line.
- module: the slug of the module this belongs to, judged from the module names and their
  intake examples. null when none fits well.
- target: "task" when it is done in one sitting of at most 90 minutes, "work_item" when it
  needs more (a project, a presentation, studying for an exam).
- est_minutes: for a task its length, for a work item its total effort. Use "similar" (real
  durations of finished work) as your main evidence. A duration written in the line wins.
- energy: "deep" for focused thinking, "light" for small chores and admin, "physical" for
  bodily work. context: where it can be done; "any" when it does not matter.
- importance: 1 low, 2 normal, 3 high, 4 very high. A near deadline or a graded or external
  commitment raises it.
- due: the deadline day if the line names one (relative day names count), else null.
- steps: only for a work_item that clearly falls into a few steps of at most 90 minutes each;
  otherwise an empty list.

"corrections" are earlier answers of yours the user changed: follow their direction.

${SHARED_RULES}`,
};
