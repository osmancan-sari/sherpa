import { unwrap } from "@/core/types";
import { type EnrichInput, type EnrichOutput, enrichSpec } from "./calls/enrich";
import { type AiDeps, runAiCall } from "./gateway";

// The quality check of `enrich` (docs/10-yapay-zeka.md, "Kalite denetimi"): sample lines with
// what they should become, asked through the gateway as the local account, and scored. Run by
// hand (`npm run ai:eval`) when a prompt or a model changes.

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
    };
  }
  const estimate = output.est_minutes.value;
  return {
    text: item.text,
    output,
    error,
    module: output.module.value === item.expect.module,
    target: output.target.value === item.expect.target,
    due: output.due.value === item.expect.due,
    minutesError:
      estimate === null ? null : Math.abs(estimate - item.expect.minutes) / item.expect.minutes,
  };
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
      rows.push(scoreCase(item, result.output));
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
