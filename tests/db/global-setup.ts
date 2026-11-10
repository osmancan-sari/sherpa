import { createClient } from "@supabase/supabase-js";
import type { TestProject } from "vitest/node";

// Two throwaway accounts for the database tests: "owner" does the work, "stranger" tries to
// get at it. They are signed in once here (logins are rate limited) and removed afterwards;
// deleting an account takes its rows with it.

export const TEST_USERS = {
  owner: "db-owner@sherpa.test",
  stranger: "db-stranger@sherpa.test",
} as const;

export type TestSession = { id: string; email: string; accessToken: string };

declare module "vitest" {
  export interface ProvidedContext {
    owner: TestSession;
    stranger: TestSession;
  }
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; fill .env.local (see .env.example).`);
  return value;
}

export default async function setup(project: TestProject) {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const admin = createClient(url, env("SUPABASE_SECRET_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const health = await fetch(`${url}/auth/v1/health`).catch(() => null);
  if (!health?.ok) {
    throw new Error(`Supabase is not reachable at ${url}. Run "npm run db:start" first.`);
  }

  async function remove(email: string) {
    const { data, error } = await admin.auth.admin.listUsers();
    if (error) throw new Error(`Could not list users: ${error.message}`);
    for (const user of data.users.filter((user) => user.email === email)) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }

  async function signIn(email: string): Promise<TestSession> {
    await remove(email);
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) throw new Error(`Could not create ${email}: ${created.error.message}`);

    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw new Error(`Could not issue a code for ${email}: ${link.error.message}`);

    const client = createClient(url, env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const verified = await client.auth.verifyOtp({
      email,
      token: link.data.properties.email_otp,
      type: "email",
    });
    if (verified.error || !verified.data.session) {
      throw new Error(`Could not sign ${email} in: ${verified.error?.message}`);
    }
    return {
      id: created.data.user.id,
      email,
      accessToken: verified.data.session.access_token,
    };
  }

  project.provide("owner", await signIn(TEST_USERS.owner));
  project.provide("stranger", await signIn(TEST_USERS.stranger));

  return async () => {
    await remove(TEST_USERS.owner);
    await remove(TEST_USERS.stranger);
  };
}
