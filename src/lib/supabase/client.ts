import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/** Supabase client for Client Components. Shares the cookie session with the server. */
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient<Database>(url, key);
}
