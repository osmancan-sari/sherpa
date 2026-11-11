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
