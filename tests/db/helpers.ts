import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

export type Db = SupabaseClient<Database>;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; fill .env.local (see .env.example).`);
  return value;
}

export const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const PUBLISHABLE_KEY = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const SECRET_KEY = env("SUPABASE_SECRET_KEY");

/** The project owner's client: bypasses RLS. Used only to set up and tear down. */
export function adminDb(): Db {
  return createClient<Database>(SUPABASE_URL, SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** A client that carries nothing but the public key, like a stranger on the internet. */
export function anonDb(): Db {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function userDb(accessToken: string): Db {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    accessToken: async () => accessToken,
  });
}

/** Signed in as the account that owns the test data: exactly what the app's browser client is. */
export function ownerDb(): Db {
  return userDb(inject("owner").accessToken);
}

/** Signed in as a different, valid account. */
export function strangerDb(): Db {
  return userDb(inject("stranger").accessToken);
}

export function ownerId(): string {
  return inject("owner").id;
}

export function strangerId(): string {
  return inject("stranger").id;
}

/** Every core table, children before parents, so rows can be removed in this order. */
export const CORE_TABLES = [
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

/** Module tables (not part of the core) that also hold test rows. */
export const MODULE_TABLES: readonly string[] = [];

/** Removes everything the two test accounts own. */
export async function wipe(): Promise<void> {
  const admin = adminDb();
  for (const table of [...MODULE_TABLES, ...CORE_TABLES]) {
    const { error } = await admin
      .from(table as (typeof CORE_TABLES)[number])
      .delete()
      .in("user_id", [ownerId(), strangerId()]);
    if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
  }
}

/** Unwraps a Supabase result, failing loudly on an error. */
export function ok<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null || result.data === undefined) throw new Error("no data returned");
  return result.data;
}

export async function makeModule(db: Db, slug = "sinama", name = "Sınama") {
  return ok(await db.from("modules").insert({ slug, name }).select().single());
}
