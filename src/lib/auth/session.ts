import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "./allowed-email";

export type CurrentUser = {
  id: string;
  email: string;
};

/**
 * The signed-in user, or null. The proxy already gates every request; route handlers and
 * server actions still call this close to the data instead of trusting the proxy alone.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;

  const { sub, email } = data.claims;
  if (!sub || typeof email !== "string") return null;
  if (!isAllowedEmail(email, process.env.ALLOWED_EMAIL)) return null;

  return { id: sub, email };
}
