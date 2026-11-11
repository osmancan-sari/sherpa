import { createClient } from "@supabase/supabase-js";
import type { Db } from "@/core/types";
import type { Database } from "@/lib/supabase/database.types";

// The local account (ALLOWED_EMAIL) for scripts that act as the user: sample data, the AI
// quality check. Local Supabase only: anything else is refused, so a script can never touch
// production data.

export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; fill .env.local (see .env.example).`);
  return value;
}

/** Reads .env.local and refuses a database that is not the local one. */
export function localSetup(purpose: string): { url: string; email: string } {
  process.loadEnvFile(".env.local");
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost"].includes(host)) {
    throw new Error(`${purpose} is for local Supabase only; .env.local points at "${host}".`);
  }
  return { url, email: env("ALLOWED_EMAIL").trim().toLowerCase() };
}

export function adminClient(url: string) {
  return createClient<Database>(url, env("SUPABASE_SECRET_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** The account's id; it must exist (`npm run db:user`). */
export async function localUserId(url: string, email: string): Promise<string> {
  const users = await adminClient(url).auth.admin.listUsers();
  if (users.error) throw new Error(`Could not list users: ${users.error.message}`);
  const user = users.data.users.find((candidate) => candidate.email === email);
  if (!user) throw new Error(`The account ${email} does not exist. Run "npm run db:user" first.`);
  return user.id;
}

/** A client signed in as the account: it writes with the user's own rights, as the app does. */
export async function signInAs(url: string, email: string): Promise<Db> {
  const link = await adminClient(url).auth.admin.generateLink({ type: "magiclink", email });
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
  return createClient<Database>(url, env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    accessToken: async () => accessToken,
  });
}
