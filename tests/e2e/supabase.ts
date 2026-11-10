import { combineChunks, createChunks, createServerClient } from "@supabase/ssr";
import { createClient, type Session } from "@supabase/supabase-js";

// Talks to the local Supabase stack directly, the way a stranger with the public key
// (or, for the admin client, the project owner) could. The app is not involved here.

export const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
export const PUBLISHABLE_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const SECRET_KEY = requireEnv("SUPABASE_SECRET_KEY");

/** Name of the session cookie; supabase-js derives it from the project URL. */
export const SESSION_COOKIE = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

export type Cookie = { name: string; value: string };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; fill .env.local (see .env.example).`);
  return value;
}

export function adminClient() {
  return createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Signs the given account in straight against Supabase (no form, no mailbox) and returns
 * the cookies the app would hold for that session, written by the same library the app uses.
 */
export async function sessionCookiesFor(email: string): Promise<Cookie[]> {
  const { data, error } = await adminClient().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw new Error(`Could not issue a login code for ${email}: ${error.message}`);

  const jar = new Map<string, string>();
  const client = createServerClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });

  const verified = await client.auth.verifyOtp({
    email,
    token: data.properties.email_otp,
    type: "email",
  });
  if (verified.error) throw new Error(`Could not sign ${email} in: ${verified.error.message}`);

  const cookies = [...jar].map(([name, value]) => ({ name, value }));
  if (!cookies.some((cookie) => cookie.name.startsWith(SESSION_COOKIE))) {
    throw new Error("Signing in produced no session cookie.");
  }
  return cookies;
}

/** Reads the session out of the cookies. */
export async function readSession(cookies: Cookie[]): Promise<Session> {
  const raw = await combineChunks(
    SESSION_COOKIE,
    (name) => cookies.find((cookie) => cookie.name === name)?.value,
  );
  if (!raw?.startsWith("base64-")) throw new Error("No session cookie found.");
  return JSON.parse(Buffer.from(raw.slice("base64-".length), "base64url").toString("utf8"));
}

/** The session as cookies, in the format the app reads. */
export function writeSession(session: Session): Cookie[] {
  const value = "base64-" + Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return createChunks(SESSION_COOKIE, value);
}

/** Whether Supabase itself accepts this access token as a signed-in user. */
export async function isLiveAccessToken(accessToken: string): Promise<boolean> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}` },
  });
  return response.ok;
}
