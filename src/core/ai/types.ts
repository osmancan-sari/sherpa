import type { z } from "zod";

// The AI gateway (docs/10-yapay-zeka.md). Every call to a language model goes through
// `runAiCall` in gateway.ts; nothing else in the app talks to a provider.

/** The calls of Ç2. The planning calls (plan, replan, week, month, review) arrive in Ç3. */
export type AiKind = "enrich" | "size" | "decompose" | "extract";

/** Which model a call runs on: the fast one for intake, the planning one for judgement. */
export type ModelTier = "fast" | "plan";

export const KIND_TIER: Record<AiKind, ModelTier> = {
  enrich: "fast",
  size: "fast",
  extract: "fast",
  decompose: "plan",
};

/** What a provider is asked: one system prompt, one user message, one output schema. */
export type ProviderRequest = {
  kind: AiKind;
  model: string;
  tier: ModelTier;
  system: string;
  /** The call's input, already serialised; it is sent as the user message. */
  user: string;
  /** The output format. Providers turn it into their own structured-output form. */
  schema: z.ZodType;
  maxTokens: number;
  signal: AbortSignal;
};

export type ProviderResponse = {
  /** The raw text the model produced; the gateway parses and validates it. */
  text: string;
  /** The model that answered (may carry a fuller name than the one asked for). */
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type AiProvider = {
  readonly name: "anthropic" | "fake";
  complete: (request: ProviderRequest) => Promise<ProviderResponse>;
};

/** A provider failure that still tells what it cost, when the provider said. */
export class ProviderError extends Error {
  constructor(
    readonly reason: "timeout" | "refused" | "truncated" | "provider_error",
    message: string,
    readonly usage?: { inputTokens: number; outputTokens: number; model?: string },
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** How the gateway is wired: built from the environment on the server (config.ts). */
export type AiConfig = {
  provider: AiProvider | null;
  models: Record<ModelTier, string | null>;
  /** Milliseconds a call may take before the work goes on without it. */
  timeouts: Record<ModelTier, number>;
};

/** Why no call was made. None of these writes an `ai_calls` row. */
export type SkipReason =
  /** No API key (and no fake provider): the app runs without AI. */
  | "no_provider"
  /** The model of the call's tier is not configured. */
  | "no_model"
  /** The model has no price in pricing.ts, so its cost could not be counted. */
  | "no_price"
  /** Switched off in the settings. */
  | "disabled"
  /** This month's spending has reached the budget (a budget of 0 switches the AI off). */
  | "budget";

/** Why a call that was made gave nothing usable. Each of these is an `ai_calls` row… */
export type FailReason =
  | "timeout"
  | "refused"
  | "truncated"
  | "provider_error"
  /** The model answered, but not in the shape the schema asks for. Nothing is written. */
  | "invalid_output"
  /** …except this one: the call could not be logged, so its answer is not used. */
  | "log_failed";

export type AiResult<T> =
  | {
      status: "ok";
      output: T;
      model: string;
      /** The `ai_calls` row of this answer (also when it was reused). */
      callId: string;
      /** True when the same question had been answered before and no call was made. */
      reused: boolean;
    }
  | { status: "skipped"; reason: SkipReason }
  | { status: "failed"; reason: FailReason; callId: string | null; error: string };
