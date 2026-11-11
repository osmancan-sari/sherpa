// Fills the local account with sample data (scripts/demo-data.ts), so the core can be tried
// without real modules.
//
//   npm run db:seed              refuses when the account already has data
//   npm run db:seed -- --reset   removes everything the account owns first, then seeds
//
// Local Supabase only: the script refuses any other address, so it can never write to
// production data. The account is ALLOWED_EMAIL (create it with `npm run db:user`).

import { seedDemo } from "./demo-data";
import { adminClient, localSetup, localUserId, signInAs } from "./local-user";

/** Children before parents, so rows can be removed in this order. Module tables first. */
const TABLES = [
  "deneme_items",
  "rhythm_logs",
  "sessions",
  "tasks",
  "work_items",
  "rhythms",
  "blocks",
  "block_series",
  "prompts",
  "events",
  "inbox_entries",
  "days",
  "week_plans",
  "horizon_reviews",
  "life_mode_periods",
  "weekly_reviews",
  "planner_stats",
  "ai_feedback",
  "ai_calls",
  "settings",
  "modules",
  "areas",
] as const;

async function main() {
  const { url, email } = localSetup("Sample data");
  const reset = process.argv.includes("--reset");
  const admin = adminClient(url);
  const userId = await localUserId(url, email);

  const existing = await admin
    .from("modules")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (existing.error) throw new Error(existing.error.message);
  if ((existing.count ?? 0) > 0 && !reset) {
    throw new Error(
      'The account already has data. Run "npm run db:seed -- --reset" to replace it with the sample data.',
    );
  }
  if (reset) {
    for (const table of TABLES) {
      const { error } = await admin.from(table).delete().eq("user_id", userId);
      if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
    }
  }

  // The data is written as the user, with the user's own rights: the same path the app takes.
  const db = await signInAs(url, email);
  const summary = await seedDemo(db, new Date());
  console.log(`Sample data written for ${email} on ${url}:`);
  for (const [name, total] of Object.entries(summary)) console.log(`  ${name}: ${total}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
