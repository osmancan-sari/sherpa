import { z } from "zod";
import type { AiCallSpec } from "../gateway";
import { SHARED_RULES } from "./common";

// The planning calls (docs/10-yapay-zeka.md, "Çağrılar"): `plan` and `replan` for a day,
// `week` for the week's commitment, `month` for the coming weeks, `review` for the week behind.
// The AI suggests; the engine (src/core/planner) applies the suggestions within its rules.

const reasoned = z.object({ id: z.string(), reason: z.string().max(300) });

// --- plan, replan ------------------------------------------------------------------------------

export type PlanCandidate = {
  id: string;
  title: string;
  module: string;
  minutes: number;
  due: string | null;
  importance: number;
  energy: string;
  /** Why the engine already counts it as a must for the day; null when it does not. */
  mandatory: string | null;
};

export type PlanCallInput = {
  date: string;
  weekday: string;
  life_mode: string;
  /** Minutes of work the day can hold (slots × capacity factor). */
  capacity_minutes: number;
  /** The engine's own plan: its three and what it placed, in order. */
  base: { top3: string[]; placed: string[] };
  /** At most 80 candidates, the engine's best first. */
  candidates: PlanCandidate[];
  blocks: { title: string; start: string; end: string }[];
  /** Yesterday: how much of what was planned got done. */
  yesterday: { planned: number; done: number } | null;
  /** The user's note at the closing, or for "Yeniden planla". */
  note: string | null;
  /** `replan` only: what is already done today. */
  done_today?: string[];
};

export const planOutput = z.object({
  top3: z.array(reasoned).max(3),
  prefer: z.array(reasoned).max(10),
  defer: z.array(reasoned).max(10),
  estimates: z
    .array(
      z.object({
        id: z.string(),
        minutes: z.number().int().min(5).max(90),
        reason: z.string().max(300),
      }),
    )
    .max(10),
  warnings: z.array(z.string().max(200)).max(2),
});

export type PlanOutput = z.infer<typeof planOutput>;

const PLAN_RULES = `
- "top3": the day's three, best for the user's balance across modules and their deadlines; ids
  from "candidates" only. Work marked "mandatory" is placed by the engine anyway: do not spend
  the three on it unless it is the most important thing of the day.
- "prefer": work to bring forward; "defer": work that can wait (never mandatory work: the
  engine refuses it). Each with one short reason the user reads behind "neden?".
- "estimates": only where the given minutes are clearly wrong for the work, 5 to 90.
- "warnings": at most two short sentences, only for what the user must know today.
- Plan within "capacity_minutes"; the engine cuts what does not fit.`;

export const planSpec: AiCallSpec<PlanOutput> = {
  kind: "plan",
  version: "plan-1",
  maxTokens: 6000,
  schema: planOutput,
  system: `You plan one day of a planning app's user. The engine already made a valid plan
("base"); you improve it.
${PLAN_RULES}

${SHARED_RULES}`,
};

export const replanSpec: AiCallSpec<PlanOutput> = {
  kind: "replan",
  version: "replan-1",
  maxTokens: 6000,
  schema: planOutput,
  system: `The user's day fell apart and they asked to plan the rest of it again. "done_today"
is what is finished; plan what is left of the day from now, with the user's "note" in mind.
${PLAN_RULES}

${SHARED_RULES}`,
};

// --- week --------------------------------------------------------------------------------------

export type WeekCallInput = {
  week_start: string;
  life_mode: string;
  /** This week's usable minutes and the rhythms' and floors' fixed demand. */
  capacity_minutes: number;
  fixed_minutes: { module: string; minutes: number }[];
  /** At most 80 work items that could be worked on this week. */
  items: {
    id: string;
    title: string;
    module: string;
    remaining_minutes: number;
    /** What the engine's spreading gives this week. */
    share_minutes: number;
    due: string | null;
    importance: number;
    /** Due this week: committed whatever is suggested. */
    required: boolean;
  }[];
  /** The engine's own commitment. */
  base: string[];
  /** Last week: committed items and how many of them got their share done. */
  last_week: { committed: number; finished: number } | null;
};

export const weekOutput = z.object({
  committed: z.array(reasoned).max(40),
  drop: z.array(reasoned).max(20),
  module_budgets: z
    .array(z.object({ module: z.string(), minutes: z.number().int().min(0).max(10000) }))
    .max(20),
});

export type WeekOutput = z.infer<typeof weekOutput>;

export const weekSpec: AiCallSpec<WeekOutput> = {
  kind: "week",
  version: "week-1",
  maxTokens: 6000,
  schema: weekOutput,
  system: `You choose what a planning app's user works on this week. "items" are the
candidates with this week's share of their effort; "base" is what the engine would commit.

- "committed": the items to work on this week, most important first; ids from "items" only.
  Required items are committed anyway.
- "drop": items to leave for a later week, with a reason (never required ones).
- "module_budgets": minutes per module for the week; never below "fixed_minutes" of a module.
- Stay within "capacity_minutes"; the engine cuts what does not fit.

${SHARED_RULES}`,
};

// --- month -------------------------------------------------------------------------------------

export type MonthCallInput = {
  today: string;
  /** Week by week: demand against capacity, and the deadlines of each week. */
  weeks: { week_start: string; capacity: number; demand: number; deadlines: string[] }[];
  items: {
    id: string;
    title: string;
    module: string;
    remaining_minutes: number;
    due: string | null;
  }[];
};

export const monthOutput = z.object({
  proposals: z
    .array(
      z.object({
        kind: z.enum(["advance", "drop", "mode"]),
        item_id: z.string().nullable(),
        week_start: z.string().nullable(),
        mode: z.enum(["normal", "busy", "minimum", "holiday"]).nullable(),
        text: z.string().max(300),
      }),
    )
    .max(5),
});

export type MonthOutput = z.infer<typeof monthOutput>;

export const monthSpec: AiCallSpec<MonthOutput> = {
  kind: "month",
  version: "month-1",
  maxTokens: 4000,
  schema: monthOutput,
  system: `You look at a planning app's coming weeks. Where a week's demand is over its
capacity, propose at most five things: "advance" (start an item earlier; item_id, week_start),
"drop" (leave an item; item_id), or "mode" (a life mode for a week; week_start, mode). Each
proposal has one short sentence for the user. No proposals when nothing is tight.

${SHARED_RULES}`,
};

// --- review ------------------------------------------------------------------------------------

export type ReviewCallInput = {
  week_start: string;
  /** Each module's own weekly report. */
  modules: { module: string; metrics: { label: string; value: string }[]; suggestions: string[] }[];
  /** Minutes worked per module this week. */
  worked: { module: string; minutes: number }[];
  /** The coming four weeks: demand against capacity. */
  coming: { week_start: string; capacity: number; demand: number }[];
  life_mode: string;
};

export const reviewOutput = z.object({
  summary: z.string().max(600),
  suggestions: z.array(z.string().max(300)).max(3),
  mode: z
    .object({ mode: z.enum(["normal", "busy", "minimum", "holiday"]), reason: z.string().max(300) })
    .nullable(),
});

export type ReviewOutput = z.infer<typeof reviewOutput>;

export const reviewSpec: AiCallSpec<ReviewOutput> = {
  kind: "review",
  version: "review-1",
  maxTokens: 4000,
  schema: reviewOutput,
  system: `You write a planning app's weekly look back for its user: a short summary of the
week across the modules (no blame, no praise), at most three suggestions for the coming week,
and a life mode only when the coming weeks call for a change.

${SHARED_RULES}`,
};
