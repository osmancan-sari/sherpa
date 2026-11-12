import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeEach, describe, expect, inject, it, vi } from "vitest";
import { z } from "zod";
import { fakeProvider } from "@/core/ai/fake";
import type { AiConfig } from "@/core/ai/types";
import type { ModuleDefinition, ModuleRegistry, WorkProposal } from "@/core/contract/types";
import { createTask } from "@/core/data/work";
import { startSession } from "@/core/data/sessions";
import { createDeviceToken, hashToken } from "@/core/data/tokens";
import { tellDayStarted } from "@/core/data/session-events";
import type { Database } from "@/lib/supabase/database.types";
import {
  adminDb,
  makeModule,
  ok,
  ownerDb,
  ownerId,
  strangerDb,
  strangerId,
  SUPABASE_URL,
  wipe,
} from "./helpers";

// Ç3d (docs/02-mimari.md, "Sunucuda kullanıcı adına erişim"): the server works in one user's
// name through src/core/server/db.ts. These tests hold the boundary: the user's rows only, the
// defaults and the auth.uid() functions as in the browser, a malformed header refused, the
// header meaningless to anyone but the secret key; and the module context on the server.

vi.mock("server-only", () => ({}));
const { actAs, ActAsError, deviceTokenOwner } = await import("@/core/server/db");
const { activeModule, serverContext, serverTold } = await import("@/core/server/context");

const owner = ownerDb();
const stranger = strangerDb();
const SECRET = process.env.SUPABASE_SECRET_KEY!;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

beforeEach(wipe);
afterAll(wipe);

/** A task of a fresh module of that account (every task belongs to a module). */
async function taskOf(db: typeof owner, title: string) {
  const mod = await makeModule(db, "is", "İş");
  return createTask(db, { title, module_id: mod.id });
}

async function rpcRaw(key: string, headers: Record<string, string>, accessToken?: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sherpa_acting_user`, {
    method: "POST",
    headers: {
      apikey: key,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      "Content-Type": "application/json",
      ...headers,
    },
    body: "{}",
  });
  return { status: response.status, body: (await response.json()) as unknown };
}

describe("the server in a user's name", () => {
  it("sees the user's rows only, and writes them in the user's name", async () => {
    await taskOf(owner, "Sahibin işi");
    await taskOf(stranger, "Başkasının işi");

    const db = await actAs(ownerId());
    const tasks = ok(await db.from("tasks").select("title, user_id"));
    expect(tasks).toEqual([{ title: "Sahibin işi", user_id: ownerId() }]);

    // Written with the default user_id: the owner's.
    const [{ module_id }] = ok(await db.from("tasks").select("module_id"));
    const added = ok(
      await db.from("tasks").insert({ title: "Sunucudan", module_id }).select().single(),
    );
    expect(added.user_id).toBe(ownerId());

    // Another account's id cannot be written, nor its rows changed.
    const foreign = await db
      .from("tasks")
      .insert({ title: "Sahte", module_id, user_id: strangerId() });
    expect(foreign.error).not.toBeNull();
    const changed = ok(
      await db
        .from("tasks")
        .update({ title: "Ele geçirildi" })
        .eq("title", "Başkasının işi")
        .select(),
    );
    expect(changed).toEqual([]);
    const theirs = ok(await adminDb().from("tasks").select("title").eq("user_id", strangerId()));
    expect(theirs).toEqual([{ title: "Başkasının işi" }]);
  });

  it("runs the functions that read auth.uid() as the user", async () => {
    const task = await taskOf(owner, "Başlanacak iş");
    const db = await actAs(ownerId());
    const session = await startSession(db, { taskId: task.id });
    expect(session.user_id).toBe(ownerId());
    // The stranger's task is not there for the owner's server client.
    const theirs = await taskOf(stranger, "Başkasının");
    await expect(startSession(db, { taskId: theirs.id })).rejects.toThrow();
  });

  it("refuses what is not a user id, before and in the database", async () => {
    await expect(actAs("not-a-user")).rejects.toBeInstanceOf(ActAsError);
    const malformed = await rpcRaw(SECRET, { "x-sherpa-user": "nope" });
    expect(malformed.status).toBe(400);
    expect(malformed.body).toMatchObject({ message: "x-sherpa-user must be a user id" });
    const injected = await rpcRaw(SECRET, {
      "x-sherpa-user": `${ownerId()}", "role": "service_role`,
    });
    expect(injected.status).toBe(400);
  });

  it("means nothing to the publishable key or to a user's own session", async () => {
    // The public key with the header stays anonymous: it may not even ask who it is.
    const anonymous = await rpcRaw(PUBLISHABLE, { "x-sherpa-user": ownerId() });
    expect(anonymous.status).toBe(401);
    // The stranger's session with the owner's id in the header stays the stranger.
    const themselves = await rpcRaw(
      PUBLISHABLE,
      { "x-sherpa-user": ownerId() },
      inject("stranger").accessToken,
    );
    expect(themselves.body).toBe(strangerId());
    const disguised = createClient<Database>(SUPABASE_URL, PUBLISHABLE, {
      accessToken: async () => inject("stranger").accessToken,
      global: { headers: { "x-sherpa-user": ownerId() } },
    });
    await taskOf(owner, "Sahibin işi");
    expect(ok(await disguised.from("tasks").select("id"))).toEqual([]);
  });

  it("opens the Data API only: no Auth, Storage, Realtime or Functions with the key", async () => {
    const db = await actAs(ownerId());
    for (const part of ["auth", "storage", "channel", "functions", "schema", "realtime"]) {
      expect((db as unknown as Record<string, unknown>)[part], part).toBeUndefined();
    }
    expect(() => db.auth.admin.listUsers()).toThrow(TypeError);
    // What the data layer uses still works.
    expect(ok(await db.from("tasks").select("id"))).toEqual([]);
    expect(ok(await db.rpc("sherpa_acting_user"))).toBe(ownerId());
  });

  it("names a token's owner from its digest, and nobody for anything else", async () => {
    const { token } = await createDeviceToken(owner, {
      name: "Kestirmeler",
      scopes: ["core/wake"],
    });
    expect(await deviceTokenOwner(await hashToken(token))).toMatchObject({
      userId: ownerId(),
      scopes: ["core/wake"],
    });
    expect(await deviceTokenOwner(await hashToken(`${token}x`))).toBeNull();
    expect(await deviceTokenOwner(token)).toBeNull();
  });
});

describe("the module context on the server", () => {
  const heard: string[] = [];
  const sinama: ModuleDefinition = {
    slug: "sinama",
    name: "Sınama",
    kind: "lifelong",
    color: "#2563eb",
    chip: async () => ({ text: "", health: "ok" }),
    intake: [],
    emits: ["sinama.kayit_eklendi"],
    on: {
      // Its own event, heard on the server with a server context.
      "sinama.kayit_eklendi": async (event, ctx) => {
        heard.push(ctx.module.user_id);
        await ctx.saveSettings({ heard: (event.payload as { n: number }).n });
      },
      // The core's day event, told on the server: the listener proposes work.
      "core.day_started": async (_event, ctx) => {
        await ctx.propose({ ...proposal, key: "gun:1", title: "Günün işi" });
      },
    },
    modeBehavior: {
      normal: { weightMultiplier: 1, floorMultiplier: 1 },
      busy: { weightMultiplier: 1, floorMultiplier: 1 },
      minimum: { weightMultiplier: 1, floorMultiplier: 1 },
      holiday: { weightMultiplier: 1, floorMultiplier: 1 },
    },
    weeklyReport: async () => ({ metrics: [], suggestions: [] }),
    ingest: [{ kind: "kayit", schema: z.object({}), handle: async () => {} }],
    ui: { tabs: [{ key: "genel", label: "Genel", component: () => null }] },
  };
  const registry: ModuleRegistry = {
    list: [sinama],
    get: (slug) => (slug === "sinama" ? sinama : undefined),
  };
  const noAi: AiConfig = {
    provider: null,
    models: { fast: null, plan: null },
    timeouts: { fast: 2_000, plan: 2_000 },
  };
  const proposal: WorkProposal = {
    schema: 1,
    key: "kayit:1",
    source: { type: "sinama.kayit", id: "8f2c1d7e-3b4a-4c5d-9e6f-0a1b2c3d4e5f" },
    title: "Sunucudan gelen iş",
    when: { due: "2026-11-20T10:00:00+03:00" },
    effort: { bounds: { min: 60, max: 240 } },
    meta: { scope: "Hafta 1" },
  };

  it("is there only for a registered module that is switched on", async () => {
    const db = await actAs(ownerId());
    const deps = { db, registry, now: () => new Date(), ai: noAi };
    expect(await activeModule(deps, "sinama")).toBeNull();
    await makeModule(stranger);
    expect(await activeModule(deps, "sinama")).toBeNull();
    const row = await makeModule(owner);
    expect((await activeModule(deps, "sinama"))?.row.id).toBe(row.id);
    expect(await activeModule(deps, "yok")).toBeNull();
    ok(await owner.from("modules").update({ status: "paused" }).eq("id", row.id).select());
    expect(await activeModule(deps, "sinama")).toBeNull();
  });

  it("proposes, emits and hears in the user's name; the other account is untouched", async () => {
    heard.length = 0;
    const mine = await makeModule(owner);
    const theirs = await makeModule(stranger);
    const db = await actAs(ownerId());
    const ctx = serverContext({ db, registry, now: () => new Date(), ai: noAi }, mine);

    const result = await ctx.propose(proposal);
    expect(result.created).toBe(true);
    const item = ok(await adminDb().from("work_items").select("*").eq("id", result.id).single());
    expect(item.user_id).toBe(ownerId());

    await ctx.emit("sinama.kayit_eklendi", { n: 7 });
    expect(heard).toEqual([ownerId()]);
    const rows = ok(await adminDb().from("modules").select("id, settings").order("created_at"));
    expect(rows.find((row) => row.id === mine.id)?.settings).toEqual({ heard: 7 });
    expect(rows.find((row) => row.id === theirs.id)?.settings).toEqual({});
    const events = ok(
      await adminDb()
        .from("events")
        .select("user_id, type")
        .in("user_id", [ownerId(), strangerId()]),
    );
    expect(events).toEqual([{ user_id: ownerId(), type: "sinama.kayit_eklendi" }]);
  });

  it("sizes a proposal at once when the AI answers", async () => {
    const mine = await makeModule(owner);
    const db = await actAs(ownerId());
    const ai: AiConfig = {
      provider: fakeProvider(),
      models: { fast: "fake-fast", plan: "fake-plan" },
      timeouts: { fast: 2_000, plan: 2_000 },
    };
    const ctx = serverContext({ db, registry, now: () => new Date(), ai }, mine);
    const { id } = await ctx.propose(proposal);
    // When propose resolves, the AI's estimate is already written (not the bounds' middle).
    const item = ok(await adminDb().from("work_items").select("*").eq("id", id).single());
    expect((item.provenance as Record<string, string>).effort_total_minutes).toBe("ai");
    const calls = ok(
      await adminDb()
        .from("ai_calls")
        .select("kind, user_id")
        .in("user_id", [ownerId(), strangerId()]),
    );
    expect(calls).toEqual([{ kind: "size", user_id: ownerId() }]);
  });

  it("sizes what a listener proposes too, for a module's event and for the core's", async () => {
    const mine = await makeModule(owner);
    const db = await actAs(ownerId());
    const ai: AiConfig = {
      provider: fakeProvider(),
      models: { fast: "fake-fast", plan: "fake-plan" },
      timeouts: { fast: 2_000, plan: 2_000 },
    };
    const deps = { db, registry, now: () => new Date(), ai };
    // The core's event on the server (the ingest endpoint's path): heard, and its work sized.
    await tellDayStarted(serverTold(deps), {
      date: "2026-11-12",
      wokeAt: "2026-11-12T07:00:00+03:00",
      estimated: false,
    });
    const item = ok(
      await adminDb().from("work_items").select("*").eq("module_id", mine.id).single(),
    );
    expect(item).toMatchObject({ title: "Günün işi", user_id: ownerId() });
    expect((item.provenance as Record<string, string>).effort_total_minutes).toBe("ai");
    const events = ok(
      await adminDb()
        .from("events")
        .select("type, user_id")
        .in("user_id", [ownerId(), strangerId()]),
    );
    expect(events).toEqual([{ type: "core.day_started", user_id: ownerId() }]);
    expect(
      ok(await adminDb().from("ai_calls").select("kind").in("user_id", [ownerId(), strangerId()])),
    ).toEqual([{ kind: "size" }]);
  });
});
