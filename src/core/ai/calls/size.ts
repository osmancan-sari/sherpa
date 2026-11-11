import { z } from "zod";
import type { AiCallSpec } from "../gateway";
import { ENERGY, judged, SHARED_RULES } from "./common";

// `size`: a module proposed work and left its judgement fields empty; estimate them.

export type SizeField = "effort_total_minutes" | "session_minutes" | "importance" | "energy";

export type SizeInput = {
  title: string;
  module: { slug: string; name: string };
  /** The module's own hints for estimating its work (`sizingHints`). */
  sizing_hints: string | null;
  today: string;
  due: string | null;
  hard_deadline: boolean;
  /** What the module did fill in. */
  known: { importance: number | null; energy: string | null; session_minutes: number | null };
  /** The module's range for the total effort; the estimate stays inside it. */
  bounds: { min: number; max: number } | null;
  /** Module-specific context of the proposal (`meta`). */
  meta: Record<string, unknown>;
  /** The fields to estimate; the others are answered with null. */
  need: SizeField[];
  /** Finished work of the same module: estimated and really spent minutes. */
  similar: { title: string; estimated: number | null; spent: number }[];
};

export const sizeOutput = z.object({
  effort_total_minutes: judged(z.number().int().min(5).max(20000)),
  session_minutes: judged(z.number().int().min(15).max(90)),
  importance: judged(z.number().int().min(1).max(4)),
  energy: judged(z.enum(ENERGY)),
});

export type SizeOutput = z.infer<typeof sizeOutput>;

export const sizeSpec: AiCallSpec<SizeOutput> = {
  kind: "size",
  version: "size-1",
  maxTokens: 3000,
  schema: sizeOutput,
  system: `A module of a planning app proposed a piece of work and left some judgement fields
empty. Estimate only the fields listed in "need"; answer null (confidence 0, empty reason) for
the others.

- effort_total_minutes: the whole effort to finish the work. Base it on "similar" (what such work
  really took; "spent" is the truth, "estimated" was the guess) and on the module's
  "sizing_hints". If "bounds" is given, the value must lie within bounds.min and bounds.max.
- session_minutes: how long one sitting on this work should be, 15 to 90 minutes. Deep work
  suits longer sittings, small chores shorter ones.
- importance: 1 low, 2 normal, 3 high, 4 very high. A hard or near deadline raises it.
- energy: "deep" for focused thinking, "light" for small chores and admin, "physical" for
  bodily work.

${SHARED_RULES}`,
};
