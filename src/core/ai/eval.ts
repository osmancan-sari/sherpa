import { normalizeTiming, type Timing } from "@/core/contract/timing";
import { TASK_MAX_MINUTES, TASK_MIN_MINUTES, unwrap } from "@/core/types";
import { aiTiming } from "./flows/enrich-apply";
import { type EnrichInput, type EnrichOutput, enrichSpec } from "./calls/enrich";
import {
  type MonthOutput,
  monthSpec,
  type PlanOutput,
  planSpec,
  replanSpec,
  type ReviewOutput,
  reviewSpec,
  type WeekOutput,
  weekSpec,
} from "./calls/planning";
import { type SizeInput, sizeSpec } from "./calls/size";
import { type AiCallSpec, type AiDeps, runAiCall } from "./gateway";

// The quality check (docs/10-yapay-zeka.md, "Kalite denetimi"), run by hand (`npm run ai:eval`)
// when a prompt or a model changes, through the gateway as the local account:
// - `enrich`: sample lines with what they should become, scored; a line the AI gives no
//   duration goes on to `size`, as in the app;
// - tone: the planning calls on days that invite blame; what the user would read is checked
//   against the app's rule 2 (no guilt, no counting of the past).

export type EvalCase = {
  text: string;
  expect: {
    /** Slug of the module, or null for a line that belongs to none. */
    module: string | null;
    target: "task" | "work_item";
    /** The length a person would give it; the estimate is scored against it. */
    minutes: number;
    /** yyyy-MM-dd, or null when the line names no day. */
    due: string | null;
    /**
     * The time constraint the line states (Ç3b), or null for a line that states none. Left out:
     * the case does not check it.
     */
    timing?: Timing | null;
  };
};

export type EvalSuite = {
  /** The day the lines are read on (their relative days count from it). */
  today: string;
  weekday: string;
  modules: EnrichInput["modules"];
  cases: EvalCase[];
};

export type EvalRow = {
  text: string;
  /** Null when the call failed or the answer did not fit the schema. */
  output: EnrichOutput | null;
  error: string | null;
  module: boolean;
  target: boolean;
  due: boolean;
  /** |estimate − expected| / expected; null without an estimate. */
  minutesError: number | null;
  /** The estimate came from `size`: `enrich` gave none. */
  sized: boolean;
  /** The time constraint read right; null when the case does not check it. */
  timing: boolean | null;
};

export type EvalReport = {
  model: string;
  total: number;
  answered: number;
  routing: number;
  target: number;
  due: number;
  /** Median relative error of the duration estimates. */
  minutesMedianError: number | null;
  /** Lines whose duration `enrich` left empty and `size` estimated. */
  sized: number;
  /** Time constraints: cases that check one, and how many were read right. */
  timing: { checked: number; right: number };
  /** What the calls of this run cost (reused answers cost nothing). */
  costUsd: number;
  /** Answers taken from earlier runs: the same prompt, model and line. */
  reused: number;
  rows: EvalRow[];
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** One case against one answer. Pure. */
export function scoreCase(
  item: EvalCase,
  output: EnrichOutput | null,
  error: string | null = null,
  sizedMinutes: number | null = null,
): EvalRow {
  if (!output) {
    return {
      text: item.text,
      output: null,
      error,
      module: false,
      target: false,
      due: false,
      minutesError: null,
      sized: false,
      timing: item.expect.timing === undefined ? null : false,
    };
  }
  const sized = output.est_minutes.value === null && sizedMinutes !== null;
  const estimate = output.est_minutes.value ?? sizedMinutes;
  return {
    text: item.text,
    output,
    error,
    module: output.module.value === item.expect.module,
    target: output.target.value === item.expect.target,
    due: output.due.value === item.expect.due,
    minutesError:
      estimate === null ? null : Math.abs(estimate - item.expect.minutes) / item.expect.minutes,
    sized,
    timing:
      item.expect.timing === undefined
        ? null
        : sameTiming(aiTiming(output.timing?.value ?? null), item.expect.timing),
  };
}

/** Two timing values mean the same: no constraint on both sides, or the same fields. */
function sameTiming(got: Timing | null, expected: Timing | null): boolean {
  const canonical = (value: Timing | null) => JSON.stringify(normalizeTiming(value) ?? null);
  return canonical(got) === canonical(expected);
}

/** The share of rows where `pick` holds, and the overall numbers. Pure. */
export function summarize(model: string, rows: EvalRow[], costUsd: number): EvalReport {
  const share = (pick: (row: EvalRow) => boolean) =>
    rows.length === 0 ? 0 : rows.filter(pick).length / rows.length;
  return {
    model,
    total: rows.length,
    answered: rows.filter((row) => row.output !== null).length,
    routing: share((row) => row.module),
    target: share((row) => row.target),
    due: share((row) => row.due),
    minutesMedianError: median(rows.flatMap((row) => row.minutesError ?? [])),
    sized: rows.filter((row) => row.sized).length,
    timing: {
      checked: rows.filter((row) => row.timing !== null).length,
      right: rows.filter((row) => row.timing === true).length,
    },
    costUsd,
    reused: 0,
    rows,
  };
}

/**
 * Asks every case through the gateway, one at a time, and scores the answers. The calls are
 * logged in `ai_calls` like any other; an unchanged prompt and model reuse earlier answers.
 */
export async function evaluateEnrich(deps: AiDeps, suite: EvalSuite): Promise<EvalReport> {
  const rows: EvalRow[] = [];
  const callIds: string[] = [];
  let model = "";
  let reused = 0;
  for (const item of suite.cases) {
    const input: EnrichInput = {
      text: item.text,
      today: suite.today,
      weekday: suite.weekday,
      modules: suite.modules,
      similar: [],
      corrections: [],
    };
    const result = await runAiCall(deps, enrichSpec, input);
    if (result.status === "ok") {
      model = result.model;
      if (result.reused) reused++;
      else callIds.push(result.callId);
      let sizedMinutes: number | null = null;
      if (result.output.est_minutes.value === null) {
        // As in the app: no duration from the line or the AI, so `size` estimates it.
        const sized = await runAiCall(deps, sizeSpec, sizeInputFor(suite, result.output));
        if (sized.status === "ok") {
          if (sized.reused) reused++;
          else callIds.push(sized.callId);
          sizedMinutes = sized.output.effort_total_minutes.value;
        } else if (sized.status === "failed" && sized.callId) callIds.push(sized.callId);
      }
      rows.push(scoreCase(item, result.output, null, sizedMinutes));
    } else {
      if (result.status === "failed" && result.callId) callIds.push(result.callId);
      rows.push(scoreCase(item, null, `${result.status}: ${result.reason}`));
    }
  }
  const costs =
    callIds.length === 0
      ? []
      : unwrap(await deps.db.from("ai_calls").select("cost_usd").in("id", callIds));
  const costUsd = costs.reduce((sum, row) => sum + Number(row.cost_usd), 0);
  return { ...summarize(model, rows, costUsd), reused };
}

/** What the app sends `size` after `enrich` left a duration empty (src/core/ai/flows/size.ts). */
function sizeInputFor(suite: EvalSuite, output: EnrichOutput): SizeInput {
  const mod = suite.modules.find((row) => row.slug === output.module.value);
  const task = output.target.value !== "work_item";
  return {
    title: output.title,
    module: { slug: mod?.slug ?? "-", name: mod?.name ?? "-" },
    sizing_hints: null,
    today: suite.today,
    due: output.due.value,
    hard_deadline: false,
    known: {
      importance: output.importance.value,
      energy: output.energy.value,
      session_minutes: null,
    },
    bounds: task ? { min: TASK_MIN_MINUTES, max: TASK_MAX_MINUTES } : null,
    meta: {},
    need: task ? ["effort_total_minutes"] : ["effort_total_minutes", "session_minutes"],
    similar: [],
  };
}

// --- Tone (rule 2) -----------------------------------------------------------------------------

export type ToneKind = "plan" | "replan" | "week" | "month" | "review";

/** A planning call on a day that invites blame (nothing done yesterday, a gloomy note…). */
export type ToneCase = { name: string; kind: ToneKind; input: unknown };
export type ToneSuite = { cases: ToneCase[] };

/**
 * What counts the past or blames, in Turkish (CLAUDE.md, rule 2): matched on the lower-cased
 * text, at the start of a word.
 */
export const TONE_BANNED: readonly { word: string; pattern: RegExp }[] = [
  ["dün", "dün(kü|den|ü)?(?!\\p{L})"],
  ["yapılmadı", "yapılma(dı|mış)"],
  ["yapamadın", "yapama(dı|mış)"],
  ["bitmedi", "bitme(di|miş)"],
  ["bitiremedin", "bitireme"],
  ["tamamlanmadı", "tamamlanma(dı|mış)"],
  ["tamamlayamadın", "tamamlayama"],
  ["kaçırdın", "kaçır"],
  ["gecikti", "gecik"],
  ["ertelendi", "ertelen(di|miş)|erteledin|ertelemiş"],
  ["hiçbiri", "hiçbiri"],
  ["yine", "yine(?! de)"],
  ["hâlâ", "hâlâ|halen"],
  ["geride kaldı", "geride kal|gerisinde"],
  ["aksattın", "aksat"],
  ["ihmal", "ihmal"],
].map(([word, source]) => ({ word, pattern: new RegExp(`(^|[^\\p{L}])(${source})`, "u") }));

/** The banned words found in what the user would read. Pure. */
export function toneMisses(texts: string[]): { text: string; word: string }[] {
  return texts.flatMap((text) => {
    const lower = text.toLocaleLowerCase("tr");
    return TONE_BANNED.filter(({ pattern }) => pattern.test(lower)).map(({ word }) => ({
      text,
      word,
    }));
  });
}

/** Every sentence of an answer the user can read. Pure. */
export function userTexts(kind: ToneKind, output: unknown): string[] {
  switch (kind) {
    case "plan":
    case "replan": {
      const plan = output as PlanOutput;
      return [
        ...[...plan.top3, ...plan.prefer, ...plan.defer, ...plan.estimates].map(
          (row) => row.reason,
        ),
        ...plan.warnings,
      ];
    }
    case "week": {
      const week = output as WeekOutput;
      return [...week.committed, ...week.drop].map((row) => row.reason);
    }
    case "month":
      return (output as MonthOutput).proposals.map((row) => row.text);
    case "review": {
      const review = output as ReviewOutput;
      return [review.summary, ...review.suggestions, ...(review.mode ? [review.mode.reason] : [])];
    }
  }
}

const TONE_SPECS: Record<ToneKind, AiCallSpec<unknown>> = {
  plan: planSpec as AiCallSpec<unknown>,
  replan: replanSpec as AiCallSpec<unknown>,
  week: weekSpec as AiCallSpec<unknown>,
  month: monthSpec as AiCallSpec<unknown>,
  review: reviewSpec as AiCallSpec<unknown>,
};

export type ToneRow = {
  name: string;
  kind: ToneKind;
  error: string | null;
  texts: string[];
  misses: { text: string; word: string }[];
};

export type ToneReport = {
  total: number;
  answered: number;
  /** Answered and without a banned word. */
  clean: number;
  costUsd: number;
  reused: number;
  rows: ToneRow[];
};

/** Asks every tone case through the gateway and checks what the user would read. */
export async function evaluateTone(deps: AiDeps, suite: ToneSuite): Promise<ToneReport> {
  const rows: ToneRow[] = [];
  const callIds: string[] = [];
  let reused = 0;
  for (const item of suite.cases) {
    const result = await runAiCall(deps, TONE_SPECS[item.kind], item.input);
    if (result.status === "ok") {
      if (result.reused) reused++;
      else callIds.push(result.callId);
      const texts = userTexts(item.kind, result.output);
      rows.push({
        name: item.name,
        kind: item.kind,
        error: null,
        texts,
        misses: toneMisses(texts),
      });
    } else {
      if (result.status === "failed" && result.callId) callIds.push(result.callId);
      rows.push({
        name: item.name,
        kind: item.kind,
        error: `${result.status}: ${result.reason}`,
        texts: [],
        misses: [],
      });
    }
  }
  const costs =
    callIds.length === 0
      ? []
      : unwrap(await deps.db.from("ai_calls").select("cost_usd").in("id", callIds));
  return {
    total: rows.length,
    answered: rows.filter((row) => row.error === null).length,
    clean: rows.filter((row) => row.error === null && row.misses.length === 0).length,
    costUsd: costs.reduce((sum, row) => sum + Number(row.cost_usd), 0),
    reused,
    rows,
  };
}
