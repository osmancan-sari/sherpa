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

const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/, "HH:mm");
const range = z.object({
  /** 1 = Monday … 7 = Sunday; null for every day. */
  days: z.array(z.number().int().min(1).max(7)).nullable(),
  from: clock,
  to: clock,
});

/** Time constraints the line states (docs/10-yapay-zeka.md, rule 12); null when it states none. */
export const enrichTiming = z.object({
  windows: z.array(range).nullable(),
  prefer: z.array(range).nullable(),
  avoid: z.array(range).nullable(),
  travel: z
    .object({ before: z.number().int().min(0).max(180), after: z.number().int().min(0).max(180) })
    .nullable(),
});

/** What the model is asked for (strict structured output: every field required). */
export const enrichAnswer = z.object({
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
  /** Only what the line says outright about when the work can be done; null otherwise. */
  timing: judged(enrichTiming),
  /** Only for a work item that clearly falls into steps; otherwise empty. */
  steps: z
    .array(
      z.object({ title: z.string().min(1).max(200), minutes: z.number().int().min(5).max(90) }),
    )
    .max(8),
});

/** An answer as the app reads it: cards stored before Ç3b carry no `timing`. */
export const enrichOutput = enrichAnswer.extend({ timing: judged(enrichTiming).optional() });

export type EnrichOutput = z.infer<typeof enrichOutput>;

export const enrichSpec: AiCallSpec<EnrichOutput> = {
  kind: "enrich",
  version: "enrich-2",
  maxTokens: 4000,
  schema: enrichAnswer,
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
- timing: only what the line says outright about WHEN the work can be done; null when it says
  nothing of the kind. Never infer hours from the kind of work.
  - windows (it can be done only then): "akşam 8'den sonra" → [{from "20:00", to "24:00"}],
    "hafta içi 9–17 arası açık" → [{days [1,2,3,4,5], from "09:00", to "17:00"}].
  - avoid (better not then): "kalabalık saatte olmasın, 18–20 arası" → [{from "18:00", to "20:00"}].
  - prefer (best then): only when the line says it is wanted ("sabah yapmak istiyorum").
  - travel: a stated travel time, each way unless the line says otherwise ("20 dk yol" →
    {before 20, after 20}).
  - days: 1 = Monday … 7 = Sunday, null for every day. Times are "HH:mm"; "to" may be "24:00";
    a range past midnight is two ranges. Give each list only when it has ranges, else null.
  - A deadline is "due", not a window: "cumaya kadar", "yarın 17:00'de teslim" give no timing.
    A word of the day in the title ("akşam yemeği", "sabah koşusu") is not a constraint either.

"corrections" are earlier answers of yours the user changed: follow their direction.

${SHARED_RULES}`,
};
