import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AiConfig } from "@/core/ai/types";
import type { Tables } from "@/lib/supabase/database.types";
import type { ModuleDefinition, ModuleRegistry } from "@/core/contract/types";
import { keepWeek, loadPlanRows } from "@/core/data/keep";
import { createDeviceToken, hashToken, revokeDeviceToken } from "@/core/data/tokens";
import { isReturning, planInput } from "@/core/planner";
import { adminDb, makeModule, ok, ownerDb, ownerId, strangerDb, strangerId, wipe } from "./helpers";

// The ingest endpoint (Ç3d; docs/02-mimari.md "Cihaz anahtarları ve giriş ucu"), run as the
// route runs it: a Request in, a Response out. Every way a request is refused is tried here,
// and none of them writes the token anywhere. The handlers run on the server in the token
// owner's name. The end-to-end spec (tests/e2e/ingest.spec.ts) tries the same through Next.

vi.mock("server-only", () => ({}));
// The week kept after a bedtime may fail; the bedtime must stand anyway.
const flags = vi.hoisted(() => ({ failWeek: false }));
vi.mock("@/core/server/plan", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/core/server/plan")>();
  return {
    keepWeekOnServer: async (deps: Parameters<typeof real.keepWeekOnServer>[0]) => {
      if (flags.failWeek) throw new Error("the week could not be written");
      return real.keepWeekOnServer(deps);
    },
  };
});
const { handleIngest, INGEST_PER_MINUTE, INGEST_MAX_BYTES } = await import("@/core/server/ingest");

const owner = ownerDb();
const stranger = strangerDb();
const NO_AI: AiConfig = {
  provider: null,
  models: { fast: null, plan: null },
  timeouts: { fast: 2_000, plan: 2_000 },
};

let failNext = false;
const seen: { items: number; user: string }[] = [];
const sinama: ModuleDefinition = {
  slug: "sinama",
  name: "Sınama",
  kind: "lifelong",
  color: "#2563eb",
  chip: async () => ({ text: "", health: "ok" }),
  intake: [],
  emits: [],
  on: {
    "core.day_started": async (event, ctx) => {
      await ctx.saveSettings({ woke: (event.payload as { woke_at: string }).woke_at });
    },
    "core.context_reported": async (event, ctx) => {
      await ctx.saveSettings({ context: (event.payload as { context: string }).context });
    },
  },
  modeBehavior: {
    normal: { weightMultiplier: 1, floorMultiplier: 1 },
    busy: { weightMultiplier: 1, floorMultiplier: 1 },
    minimum: { weightMultiplier: 1, floorMultiplier: 1 },
    holiday: { weightMultiplier: 1, floorMultiplier: 1 },
  },
  weeklyReport: async () => ({ metrics: [], suggestions: [] }),
  ingest: [
    {
      kind: "kayit",
      schema: z.object({ title: z.string().min(1), minutes: z.number().int().optional() }).strict(),
      async handle(payload, ctx) {
        const { title } = payload as { title: string };
        // What the handler can see: the owner's work only.
        seen.push({ items: (await ctx.work.items()).length, user: ctx.module.user_id });
        await ctx.propose({
          schema: 1,
          key: `kayit:${title}`,
          source: { type: "sinama.kayit", id: "8f2c1d7e-3b4a-4c5d-9e6f-0a1b2c3d4e5f" },
          title,
          when: { due: null },
          effort: { total_minutes: 60 },
        });
      },
    },
    {
      kind: "bozuk",
      schema: z.object({}),
      async handle() {
        if (failNext) {
          failNext = false;
          throw new Error("the collector's file was half written");
        }
      },
    },
  ],
  ui: { tabs: [{ key: "genel", label: "Genel", component: () => null }] },
};
const registry: ModuleRegistry = {
  list: [sinama],
  get: (slug) => (slug === "sinama" ? sinama : undefined),
};

type Call = {
  path: string;
  token?: string | null;
  body?: unknown;
  raw?: string;
  key?: string;
  now?: Date;
  headers?: Record<string, string>;
};

async function call({ path, token, body, raw, key, now, headers = {} }: Call) {
  const [source, kind] = path.split("/");
  const request = new Request(`http://sherpa.test/api/ingest/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
      ...headers,
    },
    body: raw ?? (body === undefined ? "" : JSON.stringify(body)),
  });
  const response = await handleIngest(
    request,
    { source, kind },
    { registry, ai: NO_AI, now: now ? () => now : undefined },
  );
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function tokenWith(scopes: string[], db = owner) {
  return (await createDeviceToken(db, { name: "Kestirmeler", scopes })).token;
}

type Logged = "ingest_requests" | "days" | "events" | "work_items";

async function ownerRows<T extends Logged>(table: T): Promise<Tables<T>[]> {
  const result = await adminDb()
    .from(table as Logged)
    .select("*")
    .eq("user_id", ownerId())
    .order("created_at");
  return ok(result) as unknown as Tables<T>[];
}

beforeEach(async () => {
  await wipe();
  seen.length = 0;
  failNext = false;
  flags.failWeek = false;
});
afterAll(wipe);

describe("the ingest endpoint refuses", () => {
  it("a missing, malformed, unknown or revoked token with 401, and writes nothing", async () => {
    const token = await tokenWith(["core/wake"]);
    for (const attempt of [null, "shp_short", `${token}x`, token.replace(/.$/, "A")]) {
      const result = await call({ path: "core/wake", token: attempt === token ? null : attempt });
      expect(result, String(attempt)).toEqual({ status: 401, body: { error: "unauthorized" } });
    }
    const lower = await call({ path: "core/wake", headers: { Authorization: `Basic ${token}` } });
    expect(lower.status).toBe(401);

    const [row] = ok(await owner.from("device_tokens").select("id"));
    await revokeDeviceToken(owner, row.id, new Date());
    expect((await call({ path: "core/wake", token })).status).toBe(401);
    expect(await ownerRows("days")).toEqual([]);
    expect(await ownerRows("ingest_requests")).toEqual([]);
  });

  it("an unknown kind with 404 and a kind outside the token's scope with 403", async () => {
    const token = await tokenWith(["core/bed"]);
    expect(await call({ path: "core/yok", token })).toEqual({
      status: 404,
      body: { error: "unknown_kind" },
    });
    expect((await call({ path: "Core/wake", token })).status).toBe(404);
    expect((await call({ path: "baska/kayit", token })).status).toBe(404);
    expect(await call({ path: "core/wake", token })).toEqual({
      status: 403,
      body: { error: "forbidden" },
    });
    // Nothing of the forbidden kind was written; the refusals are on record.
    expect(await ownerRows("days")).toEqual([]);
    const log = await ownerRows("ingest_requests");
    expect(log.map((row) => [row.kind, row.http_status, row.status, row.error])).toEqual([
      ["yok", 404, "rejected", "unknown_kind"],
      ["kayit", 404, "rejected", "unknown_kind"],
      ["wake", 403, "rejected", "forbidden"],
    ]);
  });

  it("a module that is not switched on with 409", async () => {
    const token = await tokenWith(["sinama/kayit"]);
    expect(await call({ path: "sinama/kayit", token, body: { title: "A" } })).toEqual({
      status: 409,
      body: { error: "module_inactive" },
    });
    // Switched on in another account does not count.
    await makeModule(stranger);
    expect((await call({ path: "sinama/kayit", token, body: { title: "A" } })).status).toBe(409);
    const mod = await makeModule(owner);
    expect((await call({ path: "sinama/kayit", token, body: { title: "A" } })).status).toBe(200);
    ok(await owner.from("modules").update({ status: "paused" }).eq("id", mod.id).select());
    expect((await call({ path: "sinama/kayit", token, body: { title: "B" } })).status).toBe(409);
  });

  it("a broken body with 400, naming the field and never echoing the value", async () => {
    await makeModule(owner);
    const token = await tokenWith(["core/wake", "sinama/kayit"]);
    expect(await call({ path: "core/wake", token, raw: "{ bozuk" })).toEqual({
      status: 400,
      body: { error: "invalid_json" },
    });
    const wrong = await call({ path: "sinama/kayit", token, body: { title: 42 } });
    expect(wrong.status).toBe(400);
    expect(wrong.body).toMatchObject({ error: "invalid_body", issues: [{ path: "title" }] });
    const extra = await call({
      path: "sinama/kayit",
      token,
      body: { title: "Rapor", parola: "gizli-deger" },
    });
    expect(extra.status).toBe(400);
    expect(JSON.stringify(extra.body)).toContain("parola");
    expect(JSON.stringify(extra.body)).not.toContain("gizli-deger");
    const late = await call({ path: "core/wake", token, body: { at: "dün sabah" } });
    expect(late.body).toMatchObject({ error: "invalid_body", issues: [{ path: "at" }] });
    // Valid in form, wrong in time: a waking tomorrow.
    const future = await call({
      path: "core/wake",
      token,
      body: { at: new Date(Date.now() + 86_400_000).toISOString() },
    });
    expect(future).toEqual({
      status: 400,
      body: { error: "invalid_body", issues: [{ path: "at", message: "is in the future" }] },
    });
    const huge = await call({
      path: "sinama/kayit",
      token,
      body: { title: "x".repeat(INGEST_MAX_BYTES) },
    });
    expect(huge).toEqual({ status: 413, body: { error: "body_too_large" } });
    expect(await ownerRows("days")).toEqual([]);
    expect(await ownerRows("work_items")).toEqual([]);
    const errors = (await ownerRows("ingest_requests")).map((row) => row.error);
    expect(errors).toContain("invalid_body: title");
    expect(errors).toContain("invalid_body: at");
    expect(JSON.stringify(errors)).not.toContain("gizli-deger");
  });

  it("more than the rate allows with 429", async () => {
    const token = await tokenWith(["core/context"]);
    for (let n = 0; n < INGEST_PER_MINUTE; n++) {
      expect((await call({ path: "core/context", token, body: { context: "home" } })).status).toBe(
        200,
      );
    }
    const over = await call({ path: "core/context", token, body: { context: "home" } });
    expect(over).toEqual({ status: 429, body: { error: "rate_limited" } });
    // Another token of the same account has its own count.
    const other = await tokenWith(["core/context"]);
    expect(
      (await call({ path: "core/context", token: other, body: { context: "out" } })).status,
    ).toBe(200);
  });
});

describe("the ingest endpoint handles", () => {
  it("a repeated Idempotency-Key once, and gives a failed request's key back", async () => {
    await makeModule(owner);
    const token = await tokenWith(["sinama/kayit", "sinama/bozuk"]);
    const first = await call({ path: "sinama/kayit", token, body: { title: "Rapor" }, key: "k-1" });
    expect(first).toEqual({ status: 200, body: { ok: true } });
    const again = await call({ path: "sinama/kayit", token, body: { title: "Rapor" }, key: "k-1" });
    expect(again).toEqual({ status: 200, body: { ok: true, duplicate: true } });
    expect(seen).toHaveLength(1);
    expect(await ownerRows("work_items")).toHaveLength(1);

    // The same key of another token is another request.
    const other = await tokenWith(["sinama/kayit"]);
    const theirs = await call({
      path: "sinama/kayit",
      token: other,
      body: { title: "Rapor" },
      key: "k-1",
    });
    expect(theirs.status).toBe(200);
    expect(seen).toHaveLength(2);
    // So is the same key sent to another kind (phase audit): handled, not a "duplicate".
    expect(await call({ path: "sinama/bozuk", token, body: {}, key: "k-1" })).toEqual({
      status: 200,
      body: { ok: true },
    });

    // While the first is still running, the repeat waits.
    const [tokenRow] = ok(
      await owner.from("device_tokens").select("id").eq("hint", token.slice(0, 8)),
    );
    ok(
      await owner
        .from("ingest_requests")
        .insert({
          token_id: tokenRow.id,
          source: "sinama",
          kind: "kayit",
          idempotency_key: await hashToken("sinama/kayit\nk-2"),
          status: "processing",
          http_status: 102,
        })
        .select(),
    );
    expect(await call({ path: "sinama/kayit", token, body: { title: "X" }, key: "k-2" })).toEqual({
      status: 409,
      body: { error: "in_progress" },
    });

    // A handler that fails: 500, and the same key may be tried again.
    failNext = true;
    expect(await call({ path: "sinama/bozuk", token, body: {}, key: "k-3" })).toEqual({
      status: 500,
      body: { error: "failed" },
    });
    expect(await call({ path: "sinama/bozuk", token, body: {}, key: "k-3" })).toEqual({
      status: 200,
      body: { ok: true },
    });
    // The handler's message stays out of the record.
    expect(JSON.stringify(await ownerRows("ingest_requests"))).not.toContain("half written");
    const badKey = await call({
      path: "sinama/kayit",
      token,
      body: { title: "Y" },
      key: "two words",
    });
    expect(badKey).toEqual({ status: 400, body: { error: "invalid_idempotency_key" } });
  });

  it("in the token owner's name: another account's data is out of reach", async () => {
    await makeModule(owner);
    const theirModule = await makeModule(stranger);
    ok(
      await stranger
        .from("work_items")
        .insert({ module_id: theirModule.id, title: "Başkasının kalemi", key: "x:1" })
        .select(),
    );
    const token = await tokenWith(["sinama/kayit", "core/wake"]);
    await call({ path: "sinama/kayit", token, body: { title: "Rapor" } });
    // The handler saw the owner's work only (none yet), in the owner's name.
    expect(seen).toEqual([{ items: 0, user: ownerId() }]);
    await call({ path: "core/wake", token });
    const theirs = ok(await adminDb().from("days").select("*").eq("user_id", strangerId()));
    expect(theirs).toEqual([]);
    const written = ok(await adminDb().from("work_items").select("title, user_id").order("title"));
    expect(written.filter((row) => [ownerId(), strangerId()].includes(row.user_id))).toEqual([
      { title: "Başkasının kalemi", user_id: strangerId() },
      { title: "Rapor", user_id: ownerId() },
    ]);
    // A stranger's token reaches the stranger's account, not the owner's.
    const theirToken = await tokenWith(["core/wake"], stranger);
    await call({ path: "core/wake", token: theirToken });
    expect((await ownerRows("days")).length).toBe(1);
    expect(ok(await adminDb().from("days").select("id").eq("user_id", strangerId()))).toHaveLength(
      1,
    );
  });

  it("and writes the token nowhere: not the record, not the events, not the day", async () => {
    await makeModule(owner);
    const token = await tokenWith(["core/wake", "core/bed", "core/context", "sinama/kayit"]);
    await call({ path: "core/wake", token, key: token });
    await call({ path: "core/context", token, body: { context: "campus" } });
    await call({ path: "sinama/kayit", token, body: { title: token } });
    await call({ path: "core/bed", token, body: { at: token } });
    await call({ path: "core/yok", token });
    for (const table of ["ingest_requests", "days", "events"] as const) {
      expect(JSON.stringify(await ownerRows(table)), table).not.toContain(token.slice(4));
    }
  });
});

describe("the core's kinds", () => {
  it("core/wake records the waking, tells every module, and counts as use", async () => {
    // Last seen five days ago: the app would open on "Kaldığın yerden devam".
    ok(
      await owner
        .from("days")
        .insert({ date: "2026-11-07", closed_at: "2026-11-07T22:00:00+03:00" })
        .select(),
    );
    const before = await loadPlanRows(owner, new Date("2026-11-12T09:00:00+03:00"));
    const input = (rows: typeof before) =>
      planInput(rows, {
        date: "2026-11-12",
        now: new Date("2026-11-12T09:00:00+03:00"),
        context: "desk",
      });
    expect(isReturning(input(before))).toBe(true);

    await makeModule(owner);
    const token = await tokenWith(["core/wake"]);
    // The phone's alarm automation, yesterday morning: nobody opened the app.
    const morning = new Date("2026-11-11T07:05:00+03:00");
    expect(await call({ path: "core/wake", token, now: morning })).toEqual({
      status: 200,
      body: { ok: true },
    });
    const [day] = await ownerRows("days").then((rows) =>
      rows.filter((row) => row.date === "2026-11-11"),
    );
    expect(day).toMatchObject({ woke_estimated: false, started_at: null });
    expect(new Date(day.woke_at!).getTime()).toBe(morning.getTime());
    const events = await ownerRows("events");
    expect(events.map((event) => event.type)).toEqual(["core.day_started"]);
    expect(events[0].payload).toMatchObject({ date: "2026-11-11", estimated: false });
    const [mod] = ok(await owner.from("modules").select("settings"));
    expect(mod.settings).toEqual({ woke: day.woke_at });

    const after = await loadPlanRows(owner, new Date("2026-11-12T09:00:00+03:00"));
    expect(isReturning(input(after))).toBe(false);

    // With a moment of its own, after the night (05:00): that day.
    await call({
      path: "core/wake",
      token,
      body: { at: "2026-11-12T06:40:00+03:00" },
      now: new Date("2026-11-12T06:45:00+03:00"),
    });
    expect((await ownerRows("days")).map((row) => row.date)).toContain("2026-11-12");
  });

  it("core/context tells every module the context, and changes nothing else", async () => {
    await makeModule(owner);
    const token = await tokenWith(["core/context"]);
    expect((await call({ path: "core/context", token, body: { context: "nowhere" } })).status).toBe(
      400,
    );
    expect(await call({ path: "core/context", token, body: { context: "campus" } })).toEqual({
      status: 200,
      body: { ok: true },
    });
    const [event] = await ownerRows("events");
    expect(event).toMatchObject({ type: "core.context_reported", payload: { context: "campus" } });
    const [mod] = ok(await owner.from("modules").select("settings"));
    expect(mod.settings).toEqual({ context: "campus" });
    expect(await ownerRows("days")).toEqual([]);
  });

  it("core/bed records tonight's bedtime; a late one shortens tomorrow and re-commits the week", async () => {
    // The day's frame on (the column's default), up at 07:00 on Thursday.
    ok(await owner.from("settings").insert({}).select());
    ok(
      await owner
        .from("days")
        .insert({
          date: "2026-11-12",
          woke_at: "2026-11-12T07:00:00+03:00",
          bed_at: "2026-11-12T22:30:00+03:00",
        })
        .select(),
    );
    // In bed at 22:30 (from the screen): up at 06:30 tomorrow. The week is committed then.
    const evening = new Date("2026-11-12T22:35:00+03:00");
    await keepWeek(owner, evening);
    const [committed] = ok(await owner.from("week_plans").select("*"));
    const before = (committed.day_capacity as Record<string, number>)["2026-11-13"];
    expect(before).toBeGreaterThan(0);

    // Up again, and back in bed at 00:30, told by the phone's sleep automation five minutes
    // later: up at 08:30 tomorrow, two hours less.
    const token = await tokenWith(["core/bed"]);
    const night = new Date("2026-11-13T00:35:00+03:00");
    expect(
      await call({
        path: "core/bed",
        token,
        body: { at: "2026-11-13T00:30:00+03:00" },
        now: night,
      }),
    ).toEqual({ status: 200, body: { ok: true } });

    // It is Thursday's night (before 05:00), and the event says so.
    const [thursday] = (await ownerRows("days")).filter((row) => row.date === "2026-11-12");
    expect(new Date(thursday.bed_at!).toISOString()).toBe("2026-11-12T21:30:00.000Z");
    const closed = (await ownerRows("events")).filter((event) => event.type === "core.day_closed");
    expect(closed.map((event) => event.payload)).toEqual([
      { date: "2026-11-12", bed_at: thursday.bed_at },
    ]);

    // Tomorrow now starts at its later expected waking: more than 30 minutes lost, so the week
    // was re-committed on the server, without any screen open.
    const [recommitted] = ok(await owner.from("week_plans").select("*"));
    const after = (recommitted.day_capacity as Record<string, number>)["2026-11-13"];
    expect(after).toBeLessThan(before - 30);
    expect(recommitted.updated_at > committed.updated_at).toBe(true);
  });
});

describe("the ingest endpoint's edges (Ç3d step 3 audit)", () => {
  it("limits a flood of refused requests too, and stops writing it", async () => {
    const token = await tokenWith(["core/bed"]);
    for (let n = 0; n < INGEST_PER_MINUTE; n++) {
      expect((await call({ path: "core/wake", token })).status).toBe(403);
    }
    expect(await call({ path: "core/yok", token })).toEqual({
      status: 429,
      body: { error: "rate_limited" },
    });
    expect(await ownerRows("ingest_requests")).toHaveLength(INGEST_PER_MINUTE);
  });

  it("gives up the key of a request cut off while processing, after five minutes", async () => {
    await makeModule(owner);
    const token = await tokenWith(["sinama/kayit"]);
    const [tokenRow] = ok(await owner.from("device_tokens").select("id"));
    const digest = await hashToken("sinama/kayit\nk-uzun");
    const stamp = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
    const [recent] = ok(
      await adminDb()
        .from("ingest_requests")
        .insert({
          user_id: ownerId(),
          token_id: tokenRow.id,
          source: "sinama",
          kind: "kayit",
          idempotency_key: digest,
          status: "processing",
          http_status: 102,
          created_at: stamp(2),
        })
        .select(),
    );
    // Two minutes: maybe still running.
    expect(
      (await call({ path: "sinama/kayit", token, body: { title: "A" }, key: "k-uzun" })).status,
    ).toBe(409);
    ok(
      await adminDb()
        .from("ingest_requests")
        .update({ created_at: stamp(10) })
        .eq("id", recent.id)
        .select(),
    );
    // Ten minutes: cut off. The new request takes the key over and is handled.
    expect(
      await call({ path: "sinama/kayit", token, body: { title: "A" }, key: "k-uzun" }),
    ).toEqual({
      status: 200,
      body: { ok: true },
    });
    const [old] = ok(await adminDb().from("ingest_requests").select("*").eq("id", recent.id));
    expect(old).toMatchObject({ status: "failed", error: "abandoned", idempotency_key: null });
    expect(seen).toHaveLength(1);
  });

  it("takes a moment at most a day back and five minutes ahead, the context's too", async () => {
    const token = await tokenWith(["core/wake", "core/context"]);
    const old = await call({
      path: "core/wake",
      token,
      body: { at: new Date(Date.now() - 25 * 3_600_000).toISOString() },
    });
    expect(old).toEqual({
      status: 400,
      body: { error: "invalid_body", issues: [{ path: "at", message: "is more than a day ago" }] },
    });
    const ahead = await call({
      path: "core/context",
      token,
      body: { context: "home", at: new Date(Date.now() + 10 * 60_000).toISOString() },
    });
    expect(ahead.body).toMatchObject({ error: "invalid_body", issues: [{ path: "at" }] });
    expect(await ownerRows("days")).toEqual([]);
    expect(await ownerRows("events")).toEqual([]);
  });

  it("puts a waking before 05:00 on the day before, as the screen sees it then", async () => {
    ok(await owner.from("settings").insert({}).select());
    const token = await tokenWith(["core/wake"]);
    await call({
      path: "core/wake",
      token,
      body: { at: "2026-11-12T04:30:00+03:00" },
      now: new Date("2026-11-12T04:31:00+03:00"),
    });
    expect((await ownerRows("days")).map((row) => row.date)).toEqual(["2026-11-11"]);
  });

  it("refuses a body announced larger than the limit before reading it", async () => {
    const token = await tokenWith(["core/wake"]);
    const result = await call({
      path: "core/wake",
      token,
      headers: { "Content-Length": String(INGEST_MAX_BYTES + 1) },
    });
    expect(result).toEqual({ status: 413, body: { error: "body_too_large" } });
  });

  it("keeps the bedtime when the week cannot be kept after it", async () => {
    flags.failWeek = true;
    const token = await tokenWith(["core/bed"]);
    expect(await call({ path: "core/bed", token })).toEqual({ status: 200, body: { ok: true } });
    const [day] = await ownerRows("days");
    expect(day.bed_at).not.toBeNull();
  });

  it("does not let the user rewrite when a request came or what it was", async () => {
    const token = await tokenWith(["core/wake"]);
    await call({ path: "core/wake", token });
    const [row] = await ownerRows("ingest_requests");
    for (const change of [
      { created_at: "2000-01-01T00:00:00Z" },
      { kind: "bed" },
      { token_id: row.token_id },
    ]) {
      const { error } = await owner.from("ingest_requests").update(change).eq("id", row.id);
      expect(error?.code, JSON.stringify(change)).toBe("42501");
    }
  });
});
