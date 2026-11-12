import { check, type Db, unwrap } from "@/core/types";
import type { Tables } from "@/lib/supabase/database.types";

// Device tokens (docs/02-mimari.md, "Cihaz anahtarları ve giriş ucu"). A token is made here, in
// the browser, shown once and never stored: the database keeps its SHA-256 digest only. The
// server hashes what it is sent the same way (hashToken) and asks the database whose it is.

export type DeviceToken = Tables<"device_tokens">;

/** "shp_" and 32 random bytes in base64url (43 characters). */
export const TOKEN_SHAPE = /^shp_[A-Za-z0-9_-]{43}$/;

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** A new token. Web Crypto: the same in the browser and on the server. */
export function newToken(): string {
  return `shp_${base64url(crypto.getRandomValues(new Uint8Array(32)))}`;
}

/** The digest the database keeps: SHA-256, lower-case hex. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The first eight characters, to tell tokens apart in the list. */
export function tokenHint(token: string): string {
  return token.slice(0, 8);
}

export async function listDeviceTokens(db: Db): Promise<DeviceToken[]> {
  return unwrap(
    await db.from("device_tokens").select("*").order("created_at", { ascending: false }),
  );
}

/**
 * Makes a token with these scopes. The token itself is returned once, to be shown and copied;
 * only its digest is written.
 */
export async function createDeviceToken(
  db: Db,
  input: { name: string; scopes: string[] },
): Promise<{ row: DeviceToken; token: string }> {
  const token = newToken();
  const row = unwrap(
    await db
      .from("device_tokens")
      .insert({
        name: input.name.trim(),
        token_hash: await hashToken(token),
        hint: tokenHint(token),
        scopes: [...new Set(input.scopes)],
      })
      .select()
      .single(),
  );
  return { row, token };
}

/** Revokes a token for good: the endpoint refuses it from the next request on. */
export async function revokeDeviceToken(db: Db, id: string, now: Date): Promise<void> {
  check(
    await db
      .from("device_tokens")
      .update({ revoked_at: now.toISOString() })
      .eq("id", id)
      .is("revoked_at", null),
  );
}
