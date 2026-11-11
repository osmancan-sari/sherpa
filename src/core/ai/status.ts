import { readAiSettings, spentThisMonth, withinBudget } from "./budget";
import type { AiDeps } from "./gateway";
import { hasPrice } from "./pricing";
import type { SkipReason } from "./types";

// Where the AI stands right now, in the gateway's own order of checks: the settings show it and
// the screens use it for the one-line notice when the month's budget is used up (rule 9).

export type AiStatus = {
  /** "on", or the reason a call would be skipped now. */
  state: "on" | SkipReason;
  provider: "anthropic" | "fake" | null;
  models: { fast: string | null; plan: string | null };
  enabled: boolean | null;
  budgetUsd: number | null;
  spentUsd: number | null;
};

export async function aiStatus(deps: AiDeps, now: Date): Promise<AiStatus> {
  const { config, db } = deps;
  const base = {
    provider: config.provider?.name ?? null,
    models: config.models,
  };
  let enabled: boolean | null = null;
  let budgetUsd: number | null = null;
  let spentUsd: number | null = null;
  try {
    const settings = await readAiSettings(db);
    enabled = settings.enabled;
    budgetUsd = settings.budgetUsd;
    spentUsd = await spentThisMonth(db, now);
  } catch {
    return { ...base, state: "check_failed", enabled, budgetUsd, spentUsd };
  }
  const known = { enabled, budgetUsd, spentUsd };

  if (!config.provider) return { ...base, ...known, state: "no_provider" };
  // The state of the fast model: the intake calls (enrich, size, extract) run on it. A missing
  // or unpriced planning model only stops `decompose`, which says so itself when asked.
  const fast = config.models.fast;
  if (!fast) return { ...base, ...known, state: "no_model" };
  if (!hasPrice(fast)) return { ...base, ...known, state: "no_price" };
  if (!enabled) return { ...base, ...known, state: "disabled" };
  if (!withinBudget(spentUsd, budgetUsd)) return { ...base, ...known, state: "budget" };
  return { ...base, ...known, state: "on" };
}
