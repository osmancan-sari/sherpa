import "server-only";
import { anthropicProvider } from "./anthropic";
import { fakeProvider } from "./fake";
import type { AiConfig } from "./types";

/** docs/10-yapay-zeka.md, rule 6: an intake call that takes longer than this is dropped. */
const DEFAULT_TIMEOUT_MS = { fast: 8_000, plan: 30_000 };

type Env = Record<string, string | undefined>;

function milliseconds(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isLocal(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

/**
 * The gateway's wiring, from the server's environment:
 * - `SHERPA_AI_FAKE=1` with a local Supabase: the recorded fake provider (tests, development
 *   without a key). Refused against any other database, so it can never answer in production.
 * - `ANTHROPIC_API_KEY`: the real provider, with `AI_MODEL_FAST` and `AI_MODEL_PLAN`.
 * - neither: no provider; every feature works without AI.
 */
export function aiConfigFromEnv(env: Env = process.env): AiConfig {
  const timeouts = {
    fast: milliseconds(env.AI_TIMEOUT_FAST_MS, DEFAULT_TIMEOUT_MS.fast),
    plan: milliseconds(env.AI_TIMEOUT_PLAN_MS, DEFAULT_TIMEOUT_MS.plan),
  };

  if (env.SHERPA_AI_FAKE === "1" && isLocal(env.NEXT_PUBLIC_SUPABASE_URL)) {
    return { provider: fakeProvider(), models: { fast: "fake-fast", plan: "fake-plan" }, timeouts };
  }

  const key = env.ANTHROPIC_API_KEY?.trim();
  if (!key) return { provider: null, models: { fast: null, plan: null }, timeouts };

  return {
    provider: anthropicProvider(key),
    models: {
      fast: env.AI_MODEL_FAST?.trim() || null,
      plan: env.AI_MODEL_PLAN?.trim() || null,
    },
    timeouts,
  };
}
