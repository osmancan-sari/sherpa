import type { z } from "zod";
import { type Db, toJson } from "@/core/types";
import { readAiSettings, spentThisMonth, withinBudget } from "./budget";
import { fingerprint } from "./fingerprint";
import { callCost, hasPrice } from "./pricing";
import {
  type AiConfig,
  type AiKind,
  type AiResult,
  type FailReason,
  KIND_TIER,
  ProviderError,
  type ProviderResponse,
} from "./types";

/** One kind of call: its prompt and the shape its answer must have. */
export type AiCallSpec<T> = {
  kind: AiKind;
  /**
   * Changes whenever the prompt or the schema changes. Part of the fingerprint, so an answer
   * given to an older prompt is not reused.
   */
  version: string;
  system: string;
  schema: z.ZodType<T>;
  maxTokens: number;
};

export type AiDeps = {
  /** The signed-in user's client: the log is written and the budget read with their rights. */
  db: Db;
  config: AiConfig;
};

export type AiCallOptions = {
  /** The record the call is about (a work item, an inbox entry…); kept in the log. */
  subject?: { type: string; id: string };
  /** False forces a new call even when the same question was answered before. */
  reuse?: boolean;
};

const ERROR_MAX = 500;

/**
 * The single gateway. Asks the model only when there is a provider, a priced model, the AI is
 * on and the month's budget is not used up; reuses an earlier answer to the same question;
 * gives up after the tier's timeout; validates the answer against the call's schema; logs every
 * call that reached the provider in `ai_calls`. It never throws for an AI failure: the caller
 * gets "skipped" or "failed" and carries on without AI.
 */
export async function runAiCall<T>(
  deps: AiDeps,
  spec: AiCallSpec<T>,
  input: unknown,
  options: AiCallOptions = {},
): Promise<AiResult<T>> {
  const { db, config } = deps;
  const provider = config.provider;
  if (!provider) return { status: "skipped", reason: "no_provider" };

  const tier = KIND_TIER[spec.kind];
  const model = config.models[tier];
  if (!model) return { status: "skipped", reason: "no_model" };
  if (!hasPrice(model)) return { status: "skipped", reason: "no_price" };

  const settings = await readAiSettings(db);
  if (!settings.enabled) return { status: "skipped", reason: "disabled" };

  const fp = await fingerprint({ kind: spec.kind, model, version: spec.version, input });
  if (options.reuse !== false) {
    const earlier = await findEarlierAnswer(db, spec, fp);
    if (earlier) return { status: "ok", reused: true, ...earlier };
  }

  const now = new Date();
  if (!withinBudget(await spentThisMonth(db, now), settings.budgetUsd)) {
    return { status: "skipped", reason: "budget" };
  }

  const log = (row: {
    ok: boolean;
    model: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    error?: string;
    output?: T;
  }) =>
    db
      .from("ai_calls")
      .insert({
        kind: spec.kind,
        model: row.model,
        input_tokens: row.inputTokens,
        output_tokens: row.outputTokens,
        // A model without a price was refused above; the provider may name a fuller model.
        cost_usd:
          callCost(row.model, row.inputTokens, row.outputTokens) ??
          callCost(model, row.inputTokens, row.outputTokens) ??
          0,
        ok: row.ok,
        error: row.error ? row.error.slice(0, ERROR_MAX) : null,
        duration_ms: row.durationMs,
        subject_type: options.subject?.type ?? null,
        subject_id: options.subject?.id ?? null,
        fingerprint: fp,
        output: row.ok ? toJson(row.output) : null,
      })
      .select("id")
      .single();

  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);

  let response: ProviderResponse;
  try {
    response = await withTimeout(config.timeouts[tier], (signal) =>
      provider.complete({
        kind: spec.kind,
        model,
        tier,
        system: spec.system,
        user: JSON.stringify(input),
        schema: spec.schema,
        maxTokens: spec.maxTokens,
        signal,
      }),
    );
  } catch (error) {
    const reason: FailReason = error instanceof ProviderError ? error.reason : "provider_error";
    const usage = error instanceof ProviderError ? error.usage : undefined;
    const message = error instanceof Error ? error.message : String(error);
    const { data } = await log({
      ok: false,
      model: usage?.model ?? model,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      durationMs: elapsed(),
      error: `${reason}: ${message}`,
    });
    return { status: "failed", reason, callId: data?.id ?? null, error: message };
  }

  const durationMs = elapsed();
  const parsed = parseOutput(spec.schema, response.text);
  const usage = {
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    durationMs,
  };

  if (!parsed.ok) {
    const { data } = await log({ ...usage, ok: false, error: `invalid_output: ${parsed.error}` });
    return {
      status: "failed",
      reason: "invalid_output",
      callId: data?.id ?? null,
      error: parsed.error,
    };
  }

  const { data, error } = await log({ ...usage, ok: true, output: parsed.value });
  if (error || !data) {
    // An answer that is not in the log is not used: the log is what the budget counts.
    return {
      status: "failed",
      reason: "log_failed",
      callId: null,
      error: error?.message ?? "no row",
    };
  }
  return {
    status: "ok",
    output: parsed.value,
    model: response.model,
    callId: data.id,
    reused: false,
  };
}

/** The last successful answer to the same question, if it still fits the schema. */
async function findEarlierAnswer<T>(
  db: Db,
  spec: AiCallSpec<T>,
  fp: string,
): Promise<{ output: T; model: string; callId: string } | null> {
  const { data } = await db
    .from("ai_calls")
    .select("id, model, output")
    .eq("kind", spec.kind)
    .eq("fingerprint", fp)
    .eq("ok", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const parsed = spec.schema.safeParse(data.output);
  return parsed.success ? { output: parsed.data, model: data.model, callId: data.id } : null;
}

/** JSON text → a value of the schema, or the reason it is not one. */
export function parseOutput<T>(
  schema: z.ZodType<T>,
  text: string,
): { ok: true; value: T } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: `not JSON: ${text.slice(0, 120)}` };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: issues };
  }
  return { ok: true, value: result.data };
}

/**
 * Runs the call with an abort signal and gives up after `ms`, even if the provider ignores the
 * signal. A timeout becomes a ProviderError("timeout").
 */
async function withTimeout<R>(ms: number, run: (signal: AbortSignal) => Promise<R>): Promise<R> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderError("timeout", `no answer within ${ms} ms`));
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
