// Fills the local account with sample data (scripts/demo-data.ts), so the core can be tried
// without real modules.
//
//   npm run db:seed              refuses when the account already has data
//   npm run db:seed -- --reset   removes everything the account owns first, then seeds
//
// Local Supabase only: the script refuses any other address, so it can never write to
// production data. The account is ALLOWED_EMAIL (create it with `npm run db:user`).

import { createClient } from "@supabase/supabase-js";
import type { Db } from "@/core/types";
import type { Database } from "@/lib/supabase/database.types";
import { seedDemo } from "./demo-data";

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
  "settings",
  "modules",
  "areas",
] as const;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; fill .env.local (see .env.example).`);
  return value;
}

async function main() {
  process.loadEnvFile(".env.local");
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost"].includes(host)) {
    throw new Error(`Sample data is for local Supabase only; .env.local points at "${host}".`);
  }
  const email = env("ALLOWED_EMAIL").trim().toLowerCase();
  const reset = process.argv.includes("--reset");

  const admin = createClient<Database>(url, env("SUPABASE_SECRET_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const users = await admin.auth.admin.listUsers();
  if (users.error) throw new Error(`Could not list users: ${users.error.message}`);
  const user = users.data.users.find((candidate) => candidate.email === email);
  if (!user) throw new Error(`The account ${email} does not exist. Run "npm run db:user" first.`);

  const existing = await admin
    .from("modules")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (existing.error) throw new Error(existing.error.message);
  if ((existing.count ?? 0) > 0 && !reset) {
    throw new Error(
      'The account already has data. Run "npm run db:seed -- --reset" to replace it with the sample data.',
    );
  }
  if (reset) {
    for (const table of TABLES) {
      const { error } = await admin.from(table).delete().eq("user_id", user.id);
      if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
    }
  }

  // The data is written as the user, with the user's own rights: the same path the app takes.
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw new Error(`Could not sign in as ${email}: ${link.error.message}`);
  const anon = createClient(url, env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const verified = await anon.auth.verifyOtp({
    email,
    token: link.data.properties.email_otp,
    type: "email",
  });
  if (verified.error || !verified.data.session) {
    throw new Error(`Could not sign in as ${email}: ${verified.error?.message}`);
  }
  const accessToken = verified.data.session.access_token;
  const db: Db = createClient<Database>(url, env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    accessToken: async () => accessToken,
  });

  const summary = await seedDemo(db, new Date());
  console.log(`Sample data written for ${email} on ${url}:`);
  for (const [name, total] of Object.entries(summary)) console.log(`  ${name}: ${total}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
