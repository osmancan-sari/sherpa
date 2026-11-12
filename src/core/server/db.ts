import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Db } from "@/core/types";
import type { Database } from "@/lib/supabase/database.types";

// The only place the app uses the Supabase secret key (docs/02-mimari.md, "Sunucuda kullanıcı
// adına erişim"). Everything here is server-only:
//
// - `actAs(user)`: a client that goes to the database as that user. The secret key travels
//   with the header `x-sherpa-user`; the database's pre-request function turns the request
//   into the user's own (role `authenticated`, auth.uid() = user), so row level security and
//   every auth.uid() function hold. The switch is checked before the client is handed out.
// - `deviceTokenOwner(hash)`: the one question asked with the key alone (whose token this
//   is); it reads nobody's data. (Step 4 adds the second: which accounts the jobs run for.)
//
// No other file reads SUPABASE_SECRET_KEY (tests/unit/server-boundary.test.ts).

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function serviceClient(headers: Record<string, string> = {}): Db {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set on the server.");
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers },
  });
}

/** The server cannot work in this user's name (the database refused the switch). */
export class ActAsError extends Error {}

/**
 * A database client in the user's name: their rows only, exactly as their browser sees them.
 * Throws when the database did not take the request as the user.
 */
export async function actAs(userId: string): Promise<Db> {
  if (!USER_ID.test(userId)) throw new ActAsError("not a user id");
  const db = serviceClient({ "x-sherpa-user": userId });
  const { data, error } = await db.rpc("sherpa_acting_user");
  if (error || data !== userId) {
    throw new ActAsError(
      "the database did not take the request as the user (is public.sherpa_pre_request set?)",
    );
  }
  return db;
}

export type TokenOwner = { tokenId: string; userId: string; scopes: string[] };

/** Whose active token has this digest; writes its last use. Null when none. */
export async function deviceTokenOwner(hash: string): Promise<TokenOwner | null> {
  if (!/^[0-9a-f]{64}$/.test(hash)) return null;
  const { data, error } = await serviceClient().rpc("device_token_owner", { p_hash: hash });
  if (error) throw new Error(`device token lookup failed: ${error.message}`);
  const row = data?.[0];
  return row ? { tokenId: row.token_id, userId: row.user_id, scopes: row.scopes } : null;
}
