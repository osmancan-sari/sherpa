import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDeviceToken,
  hashToken,
  listDeviceTokens,
  revokeDeviceToken,
} from "@/core/data/tokens";
import { adminDb, anonDb, ok, ownerDb, ownerId, strangerDb, wipe } from "./helpers";

// Device tokens (Ç3d; docs/03-veri-modeli.md "device_tokens"): made in the browser, kept as a
// digest, revoked for good. Whose a token is can be asked only with the secret key.

const owner = ownerDb();
const stranger = strangerDb();

beforeEach(wipe);
afterAll(wipe);

describe("device tokens", () => {
  it("keeps the digest, never the token", async () => {
    const { row, token } = await createDeviceToken(owner, {
      name: " iPhone Kestirmeler ",
      scopes: ["core/wake", "core/wake", "core/bed"],
    });
    expect(row.name).toBe("iPhone Kestirmeler");
    expect(row.token_hash).toBe(await hashToken(token));
    expect(row.hint).toBe(token.slice(0, 8));
    expect(row.scopes).toEqual(["core/wake", "core/bed"]);
    expect(row.user_id).toBe(ownerId());
    expect(row.last_used_at).toBeNull();
    expect(row.revoked_at).toBeNull();
    // Nowhere in the row: the whole token.
    expect(JSON.stringify(row)).not.toContain(token.slice(8));
  });

  it("is seen by its owner only, and by nobody without a session", async () => {
    await createDeviceToken(owner, { name: "Kestirmeler", scopes: ["core/wake"] });
    expect(await listDeviceTokens(owner)).toHaveLength(1);
    expect(await listDeviceTokens(stranger)).toEqual([]);
    const anonymous = await anonDb().from("device_tokens").select("id");
    expect(anonymous.error).not.toBeNull();
  });

  it("refuses malformed scopes, names and digests", async () => {
    const good = {
      name: "Kestirmeler",
      token_hash: "a".repeat(64),
      hint: "shp_AbCd",
      scopes: ["core/wake"],
    };
    const bad = [
      { ...good, scopes: [] },
      { ...good, scopes: ["core.wake"] },
      { ...good, scopes: ["core/wake", "Okul/ninova"] },
      { ...good, scopes: ["core/wake,okul/x"] },
      { ...good, name: "   " },
      { ...good, name: "x".repeat(61) },
      { ...good, token_hash: "the-token-itself" },
      { ...good, hint: "abcdefgh" },
    ];
    for (const row of bad) {
      const { error } = await owner.from("device_tokens").insert(row);
      expect(error, JSON.stringify(row)).not.toBeNull();
    }
  });

  it("does not let the user set its use or change its digest, hint or scopes", async () => {
    const { row } = await createDeviceToken(owner, { name: "Kestirmeler", scopes: ["core/wake"] });
    const changes = [
      { token_hash: "b".repeat(64) },
      { hint: "shp_XXXX" },
      { scopes: ["core/wake", "core/bed"] },
      { last_used_at: new Date().toISOString() },
    ];
    for (const change of changes) {
      const { error } = await owner.from("device_tokens").update(change).eq("id", row.id);
      expect(error, JSON.stringify(change)).not.toBeNull();
    }
    const insert = await owner.from("device_tokens").insert({
      name: "Önceden kullanılmış",
      token_hash: "c".repeat(64),
      hint: "shp_AbCd",
      scopes: ["core/wake"],
      last_used_at: new Date().toISOString(),
    });
    expect(insert.error).not.toBeNull();
    // The name may change.
    ok(await owner.from("device_tokens").update({ name: "Telefon" }).eq("id", row.id).select());
  });

  it("stays revoked, and is never removed", async () => {
    const { row } = await createDeviceToken(owner, { name: "Kestirmeler", scopes: ["core/wake"] });
    await revokeDeviceToken(owner, row.id, new Date());
    const [revoked] = await listDeviceTokens(owner);
    expect(revoked.revoked_at).not.toBeNull();

    const undo = await owner.from("device_tokens").update({ revoked_at: null }).eq("id", row.id);
    expect(undo.error?.message).toMatch(/stays revoked/);
    // Revoking again keeps the first moment.
    await revokeDeviceToken(owner, row.id, new Date(Date.now() + 60_000));
    expect((await listDeviceTokens(owner))[0].revoked_at).toBe(revoked.revoked_at);

    const removal = await owner.from("device_tokens").delete().eq("id", row.id).select();
    expect(removal.error?.code).toBe("42501");
    expect(await listDeviceTokens(owner)).toHaveLength(1);
  });

  it("cannot be revoked or renamed by another account", async () => {
    const { row } = await createDeviceToken(owner, { name: "Kestirmeler", scopes: ["core/wake"] });
    // The columns the user may change, so the request reaches the row policy itself.
    for (const change of [{ revoked_at: new Date().toISOString() }, { name: "Başkasının" }]) {
      const attempt = ok(
        await stranger.from("device_tokens").update(change).eq("id", row.id).select(),
      );
      expect(attempt, JSON.stringify(change)).toEqual([]);
    }
    const [after] = await listDeviceTokens(owner);
    expect(after).toMatchObject({ name: "Kestirmeler", revoked_at: null });
  });

  it("names its owner only to the secret key, and only while it is active", async () => {
    const { row, token } = await createDeviceToken(owner, {
      name: "Kestirmeler",
      scopes: ["core/wake", "core/bed"],
    });
    const hash = await hashToken(token);

    for (const db of [owner, stranger, anonDb()]) {
      const { error } = await db.rpc("device_token_owner", { p_hash: hash });
      expect(error?.message).toMatch(/permission denied/);
    }

    const found = ok(await adminDb().rpc("device_token_owner", { p_hash: hash }));
    expect(found).toEqual([
      { token_id: row.id, user_id: ownerId(), scopes: ["core/wake", "core/bed"] },
    ]);
    const [used] = await listDeviceTokens(owner);
    expect(used.last_used_at).not.toBeNull();

    const unknown = ok(await adminDb().rpc("device_token_owner", { p_hash: "d".repeat(64) }));
    expect(unknown).toEqual([]);

    await revokeDeviceToken(owner, row.id, new Date());
    expect(ok(await adminDb().rpc("device_token_owner", { p_hash: hash }))).toEqual([]);
  });
});
