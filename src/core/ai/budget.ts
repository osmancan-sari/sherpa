import { check, type Db, unwrap } from "@/core/types";
import { dayKey, istanbulInstant, monthStart } from "@/lib/date";

/** The default monthly limit when the user has no settings row (docs/10-yapay-zeka.md). */
export const DEFAULT_MONTHLY_BUDGET_USD = 5;

/** The month a spending total covers starts on the 1st, 00:00 Istanbul time. */
export function monthStartInstant(now: Date): Date {
  return istanbulInstant(monthStart(dayKey(now)));
}

export type AiSettings = { enabled: boolean; budgetUsd: number };

/** The user's AI switch and budget; a missing settings row means the defaults. */
export async function readAiSettings(db: Db): Promise<AiSettings> {
  const { data, error } = await db
    .from("settings")
    .select("ai_enabled, ai_monthly_budget_usd")
    .maybeSingle();
  check({ error });
  if (!data) return { enabled: true, budgetUsd: DEFAULT_MONTHLY_BUDGET_USD };
  return { enabled: data.ai_enabled, budgetUsd: Number(data.ai_monthly_budget_usd) };
}

/** What the AI has cost since the start of this month (summed in the database). */
export async function spentThisMonth(db: Db, now: Date): Promise<number> {
  const spent = unwrap(
    await db.rpc("ai_spend_since", { p_since: monthStartInstant(now).toISOString() }),
  );
  return Number(spent);
}

/**
 * True while there is budget left. The check runs before a call; the call itself may take the
 * total a little past the limit, after which no further call is made that month.
 */
export function withinBudget(spentUsd: number, budgetUsd: number): boolean {
  return budgetUsd > 0 && spentUsd < budgetUsd;
}

/** The AI switch and the monthly limit, from the settings screen. Creates the row if needed. */
export async function saveAiSettings(
  db: Db,
  patch: { enabled?: boolean; budgetUsd?: number },
): Promise<void> {
  const row: { ai_enabled?: boolean; ai_monthly_budget_usd?: number } = {};
  if (patch.enabled !== undefined) row.ai_enabled = patch.enabled;
  if (patch.budgetUsd !== undefined) row.ai_monthly_budget_usd = patch.budgetUsd;
  check(await db.from("settings").upsert(row, { onConflict: "user_id" }));
}

export type AiUsageRow = {
  kind: string;
  model: string;
  calls: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

/** This month's calls by kind and model, summed in the database. */
export async function usageThisMonth(db: Db, now: Date): Promise<AiUsageRow[]> {
  const rows = unwrap(
    await db.rpc("ai_usage_since", { p_since: monthStartInstant(now).toISOString() }),
  );
  return rows.map((row) => ({
    kind: row.kind,
    model: row.model,
    calls: Number(row.calls),
    failed: Number(row.failed),
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    costUsd: Number(row.cost_usd),
  }));
}
