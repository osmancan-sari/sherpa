import "server-only";
import { cookies, headers } from "next/headers";
import { isAllowedEmail } from "@/lib/auth/allowed-email";

/**
 * Remembers, on this device only, that a login code was sent and to which address.
 * Without it a reload of the login page falls back to the e-mail step and the code in the
 * mailbox can no longer be typed in; on the phone that happens when the installed app is
 * reloaded after a trip to the mail app.
 */
const COOKIE = "sherpa-login";

/** As long as the code itself lives (supabase/config.toml: otp_expiry). */
const MAX_AGE_SECONDS = 600;

export async function rememberPendingLogin(email: string): Promise<void> {
  const secure = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/giris",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function forgetPendingLogin(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/giris" });
}

/** The address a code was sent to, if that is still fresh; otherwise null. */
export async function readPendingLogin(): Promise<string | null> {
  const email = (await cookies()).get(COOKIE)?.value;
  // The cookie comes from the browser, so it is checked like any other input.
  return email && isAllowedEmail(email, process.env.ALLOWED_EMAIL) ? email : null;
}
