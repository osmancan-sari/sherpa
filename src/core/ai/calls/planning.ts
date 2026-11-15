import { z } from "zod";
import type { AiCallSpec } from "../gateway";
import { SHARED_RULES } from "./common";

// The planning calls (docs/10-yapay-zeka.md, "Çağrılar"): `plan` and `replan` for a day,
// `week` for the week's commitment, `month` for the coming weeks, `review` for the week behind.
// The AI suggests; the engine (src/core/planner) applies the suggestions within its rules.
// Ç4a: no life modes and no day's three; the day runs to the bedtime (no finish line).

const reasoned = z.object({ id: z.string(), reason: z.string().max(300) });

/**
 * The app's rule 2 (CLAUDE.md, "Ürün kuralları"): nothing makes the user feel behind. Every
 * planning call carries it; `npm run ai:eval` checks the answers against it ("Ton").
 */
export const PLANNING_TONE = `
- Nothing you write may make the user feel behind or guilty; this rule of the app has no
  exception. Never count or mention work that was not done, not finished, missed, skipped, late,
  put off or left over ("dün planlanan 2 işten hiçbiri bitmedi", "yine ertelendi"), never
  compare what was done with what was planned, never blame or judge the user's habits, and no
  "yesterday" in what you write. Past numbers in the input are only for sizing what comes.
- Speak of today and what comes, as plain facts about the work ("cuma teslim, bugün 45 dk
  yeter"). A tight day is said as what fits, not as what will not.`.trim();

// --- plan, replan ------------------------------------------------------------------------------

export type PlanCandidate = {
  id: string;
  /** "task", "item" (a work item's sitting), "rhythm" (a habit) or "follow_up". */
  type: string;
  title: string;
  module: string;
  minutes: number;
  due: string | null;
  importance: number;
  energy: string;
  /** Why the engine already counts it as a must for the day; null when it does not. */
  mandatory: string | null;
  /** Its time constraints, short ("16:00–18:00 · yol 20+20 dk"); only when it has any. */
  time?: string;
};

export type PlanCallInput = {
  date: string;
  weekday: string;
  /** Minutes of work the day can hold (slots × capacity factor). */
  capacity_minutes: number;
  /** The engine's own plan: what it placed, in order. */
  base: { placed: string[] };
  /** At most 80 candidates, the engine's best first. */
  candidates: PlanCandidate[];
  blocks: { title: string; start: string; end: string }[];
  /** Yesterday: how much work got done, pieces and minutes (for sizing; never mentioned). */
  yesterday: { done: number; minutes: number } | null;
  /** The user's note at the closing, or for "Yeniden planla". */
  note: string | null;
  /** `replan` only: what is already done today. */
  done_today?: string[];
  /**
   * With the day's frame (Ç3c): the working window, from after waking and the morning routine
   * to where the bed-bound routine begins (Ç4a), and the expected bedtime ("HH:mm"). Nothing else
   * of sleep goes out.
   */
  day?: { start: string; end: string; bed: string };
};

// Ç4a: an answer that still carries "top3" is read past (zod drops unknown keys).
export const planOutput = z.object({
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
- The plan is the whole rest of the day in order; there is no list of the day's three. Mandatory
  work ("mandatory" set) is placed by the engine anyway. Balance the user's modules and their
  deadlines with "prefer" and "defer"; ids from "candidates" only.
- "time" on a candidate is its time constraint: its windows are hard (the engine never places
  it outside them and drops advice that would), preferred and avoided hours are soft, travel
  comes on top of its minutes.
- "prefer": work to bring forward (it fits the time left in the day, "capacity_minutes");
  "defer": work that can wait (never mandatory work: the engine refuses it). Each with one short
  reason the user reads behind "neden?".
- "estimates": only where the given minutes are clearly wrong for the work, 5 to 90.
- "warnings": at most two short sentences, only for what the user must know today.
- Plan within "capacity_minutes"; the engine cuts what does not fit.
- "day", when given, is the working window ("start" to "end": it runs until the evening
  routine before bed) and the expected bedtime ("bed"); work belongs inside the window. Do not
  plan, judge or mention sleep.`;

export const planSpec: AiCallSpec<PlanOutput> = {
  kind: "plan",
  version: "plan-5",
  maxTokens: 6000,
  schema: planOutput,
  system: `You plan one day of a planning app's user. The engine already made a valid plan
("base"); you improve it.
${PLAN_RULES}

${PLANNING_TONE}
${SHARED_RULES}`,
};

export const replanSpec: AiCallSpec<PlanOutput> = {
  kind: "replan",
  version: "replan-5",
  maxTokens: 6000,
  schema: planOutput,
  system: `The user's day fell apart and they asked to plan the rest of it again. "done_today"
is what is finished; plan what is left of the day from now, with the user's "note" in mind.
${PLAN_RULES}

${PLANNING_TONE}
${SHARED_RULES}`,
};

// --- week --------------------------------------------------------------------------------------

export type WeekCallInput = {
  week_start: string;
  /** This week's usable minutes; per module, what its rhythms and floor need (not less). */
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
    /** Its time constraints, short; only when it has any. */
    time?: string;
  }[];
  /** The engine's own commitment. */
  base: string[];
  /** Last week: how many items were committed. */
  last_week: { committed: number } | null;
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
  version: "week-4",
  maxTokens: 6000,
  schema: weekOutput,
  system: `You choose what a planning app's user works on this week. "items" are the
candidates with this week's share of their effort; "base" is what the engine would commit.

- "committed": the items to work on this week, most important first; ids from "items" only.
  Required items are committed anyway.
- "drop": items to leave for a later week, with a reason (never required ones).
- "module_budgets": minutes per module for the week; never below "fixed_minutes" of a module.
- "time" on an item is its time constraint (hard windows, travel per sitting): an item whose
  windows are few needs its week planned around them.
- Stay within "capacity_minutes"; the engine cuts what does not fit.

${PLANNING_TONE}
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
        kind: z.enum(["advance", "drop"]),
        item_id: z.string().nullable(),
        week_start: z.string().nullable(),
        text: z.string().max(300),
      }),
    )
    .max(5),
});

export type MonthOutput = z.infer<typeof monthOutput>;

export const monthSpec: AiCallSpec<MonthOutput> = {
  kind: "month",
  version: "month-3",
  maxTokens: 4000,
  schema: monthOutput,
  system: `You look at a planning app's coming weeks. Where a week's demand is over its
capacity, propose at most five things: "advance" (start an item earlier; item_id, week_start)
or "drop" (leave an item; item_id). Each proposal has one short sentence for the user. No
proposals when nothing is tight.

${PLANNING_TONE}
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
};

export const reviewOutput = z.object({
  summary: z.string().max(600),
  suggestions: z.array(z.string().max(300)).max(3),
});

export type ReviewOutput = z.infer<typeof reviewOutput>;

export const reviewSpec: AiCallSpec<ReviewOutput> = {
  kind: "review",
  version: "review-3",
  maxTokens: 4000,
  schema: reviewOutput,
  system: `You write a planning app's weekly look back for its user: a short summary of the
week across the modules (no blame, no praise) and at most three suggestions for the coming
week. Minutes worked are told as plain amounts, never against a plan, a floor or another week.

${PLANNING_TONE}
${SHARED_RULES}`,
};
