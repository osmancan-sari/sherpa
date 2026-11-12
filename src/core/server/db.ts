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
// - `deviceTokenOwner(hash)` and `jobUsers()`: the two questions asked with the key alone,
//   and neither reads anyone's data: whose token this is, and which accounts the jobs run for.
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
 * Only the Data API is switched to the user (PostgREST's pre-request function); Auth, Storage,
 * Realtime and Edge Functions would still see the secret key's full rights. The client handed
 * out therefore opens the Data API alone: `from` and `rpc`. Everything else (`auth`, `storage`,
 * `channel`, `functions`, `schema`…) is not there (Ç3d step 2 audit).
 */
const DATA_API = new Set(["from", "rpc"]);

function dataApiOnly(client: Db): Db {
  return new Proxy(client, {
    get(target, property) {
      if (typeof property !== "string" || !DATA_API.has(property)) return undefined;
      const value = Reflect.get(target, property, target) as (...args: unknown[]) => unknown;
      return value.bind(target);
    },
    set: () => false,
  });
}

/**
 * A database client in the user's name: their rows only, exactly as their browser sees them,
 * and nothing but the Data API. Throws when the database did not take the request as the user.
 * The id is taken as given (a token's owner, an account the jobs run for): an id with no
 * account behind it sees no rows and can write none.
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
  return dataApiOnly(db);
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

/** The accounts the scheduled jobs run for. */
export async function jobUsers(): Promise<string[]> {
  const { data, error } = await serviceClient().rpc("job_users");
  if (error) throw new Error(`job accounts lookup failed: ${error.message}`);
  return (data ?? []) as string[];
}
