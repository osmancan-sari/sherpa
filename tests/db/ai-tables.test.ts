import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { adminDb, anonDb, makeModule, ok, ownerDb, ownerId, strangerDb, wipe } from "./helpers";

// The AI gateway's tables (docs/10-yapay-zeka.md): the call log, the corrections, the spending
// functions and the effort bounds a work item keeps. Row level security on both tables is
// covered with every other table in rls.test.ts.

const db = ownerDb();
const CHECK = "23514";
const DENIED = "42501";

beforeEach(wipe);
afterAll(wipe);

const call = (over: Record<string, unknown> = {}) => ({
  kind: "enrich",
  model: "claude-haiku-5-5",
  ok: true,
  input_tokens: 1500,
  output_tokens: 200,
  cost_usd: 0.00025,
  ...over,
});

describe("the call log", () => {
  it("is append-only, even for its owner", async () => {
    const row = ok(await db.from("ai_calls").insert(call()).select().single());

    const change = await db.from("ai_calls").update({ cost_usd: 0 }).eq("id", row.id).select();
    expect(change.error?.code).toBe(DENIED);
    const removal = await db.from("ai_calls").delete().eq("id", row.id);
    expect(removal.error?.code).toBe(DENIED);

    const after = ok(await db.from("ai_calls").select("cost_usd").eq("id", row.id).single());
    expect(Number(after.cost_usd)).toBe(0.00025);
  });

  it("refuses negative numbers and an output on a failed call", async () => {
    expect((await db.from("ai_calls").insert(call({ cost_usd: -1 }))).error?.code).toBe(CHECK);
    expect((await db.from("ai_calls").insert(call({ input_tokens: -5 }))).error?.code).toBe(CHECK);
    expect(
      (await db.from("ai_calls").insert(call({ ok: false, output: { est_minutes: 45 } }))).error
        ?.code,
    ).toBe(CHECK);
    expect((await db.from("ai_calls").insert(call({ kind: " " }))).error?.code).toBe(CHECK);
  });

  it("keeps corrections append-only as well", async () => {
    const row = ok(
      await db
        .from("ai_feedback")
        .insert({
          module_slug: "okul",
          kind: "enrich",
          input_summary: "sunum slaytları",
          ai_value: { est_minutes: 45 },
          user_value: { est_minutes: 30 },
        })
        .select()
        .single(),
    );
    const change = await db.from("ai_feedback").update({ kind: "size" }).eq("id", row.id).select();
    expect(change.error?.code).toBe(DENIED);
    expect((await db.from("ai_feedback").delete().eq("id", row.id)).error?.code).toBe(DENIED);
  });
});

describe("spending", () => {
  it("adds up the caller's own calls since the given moment, failed ones included", async () => {
    const admin = adminDb();
    // An old call, before the period; written by the owner of the project to set its date.
    ok(
      await admin
        .from("ai_calls")
        .insert({
          ...call({ cost_usd: 3 }),
          user_id: ownerId(),
          created_at: "2026-10-20T10:00:00Z",
        })
        .select()
        .single(),
    );
    ok(
      await db
        .from("ai_calls")
        .insert(call({ cost_usd: 0.5 }))
        .select()
        .single(),
    );
    ok(
      await db
        .from("ai_calls")
        .insert(call({ kind: "size", ok: false, error: "invalid_output", cost_usd: 0.25 }))
        .select()
        .single(),
    );
    // Somebody else's spending is nobody's business.
    ok(
      await strangerDb()
        .from("ai_calls")
        .insert(call({ cost_usd: 40 }))
        .select()
        .single(),
    );

    const since = "2026-11-01T00:00:00+03:00";
    expect(Number(ok(await db.rpc("ai_spend_since", { p_since: since })))).toBe(0.75);
    expect(Number(ok(await db.rpc("ai_spend_since", { p_since: "2026-10-01T00:00:00Z" })))).toBe(
      3.75,
    );
    expect(Number(ok(await strangerDb().rpc("ai_spend_since", { p_since: since })))).toBe(40);

    const usage = ok(await db.rpc("ai_usage_since", { p_since: since }));
    expect(
      usage.map((row) => [row.kind, row.calls, row.failed, Number(row.cost_usd), row.input_tokens]),
    ).toEqual([
      ["enrich", 1, 0, 0.5, 1500],
      ["size", 1, 1, 0.25, 1500],
    ]);
  });

  it("is zero, not null, when nothing was spent", async () => {
    expect(Number(ok(await db.rpc("ai_spend_since", { p_since: "2026-11-01T00:00:00Z" })))).toBe(0);
    expect(ok(await db.rpc("ai_usage_since", { p_since: "2026-11-01T00:00:00Z" }))).toEqual([]);
  });

  it("counts more calls than one page of the API returns", async () => {
    const rows = Array.from({ length: 1100 }, () => ({ ...call({ cost_usd: 0.001 }) }));
    const { error } = await db.from("ai_calls").insert(rows);
    expect(error).toBeNull();
    const spent = Number(ok(await db.rpc("ai_spend_since", { p_since: "2026-01-01T00:00:00Z" })));
    expect(spent).toBeCloseTo(1.1, 6);
  });

  it("is refused to the public key", async () => {
    const since = "2026-11-01T00:00:00Z";
    expect((await anonDb().rpc("ai_spend_since", { p_since: since })).error).not.toBeNull();
    expect((await anonDb().rpc("ai_usage_since", { p_since: since })).error).not.toBeNull();
  });

  it("refuses to answer without a signed-in user or without a start, instead of saying 0", async () => {
    const since = "2026-11-01T00:00:00Z";
    // The secret key bypasses RLS but has no user: the budget check must not pass silently.
    const admin = adminDb();
    expect((await admin.rpc("ai_spend_since", { p_since: since })).error?.message).toContain(
      "signed-in user",
    );
    expect((await admin.rpc("ai_usage_since", { p_since: since })).error?.message).toContain(
      "signed-in user",
    );
    const noStart = { p_since: null as unknown as string };
    expect((await db.rpc("ai_spend_since", noStart)).error?.message).toContain("needs a start");
    expect((await db.rpc("ai_usage_since", noStart)).error?.message).toContain("needs a start");
  });
});

describe("settings and effort bounds", () => {
  it("refuses a budget below zero and accepts zero", async () => {
    expect((await db.from("settings").insert({ ai_monthly_budget_usd: -1 })).error?.code).toBe(
      CHECK,
    );
    const row = ok(
      await db.from("settings").insert({ ai_monthly_budget_usd: 0 }).select().single(),
    );
    expect(Number(row.ai_monthly_budget_usd)).toBe(0);
    expect(row.ai_enabled).toBe(true);
  });

  it("keeps a work item's effort bounds as a pair, lower bound first", async () => {
    const mod = await makeModule(db);
    const item = (over: Record<string, unknown>) =>
      db.from("work_items").insert({ module_id: mod.id, title: "Kalem", ...over });

    expect((await item({ effort_min_minutes: 30 })).error?.code).toBe(CHECK);
    expect((await item({ effort_max_minutes: 240 })).error?.code).toBe(CHECK);
    expect((await item({ effort_min_minutes: 240, effort_max_minutes: 30 })).error?.code).toBe(
      CHECK,
    );
    expect((await item({ effort_min_minutes: 0, effort_max_minutes: 30 })).error?.code).toBe(CHECK);
    expect((await item({ effort_min_minutes: 30, effort_max_minutes: 240 })).error).toBeNull();
    expect((await item({})).error).toBeNull();
  });
});
