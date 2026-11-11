import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { type EnrichInput, enrichSpec } from "@/core/ai/calls/enrich";
import { fakeProvider } from "@/core/ai/fake";
import { type AiCallSpec, runAiCall } from "@/core/ai/gateway";
import type { AiConfig, AiProvider } from "@/core/ai/types";
import { adminDb, ok, ownerDb, strangerDb, wipe } from "./helpers";

// The single AI gateway against the real database: what it logs, what it costs, when it does
// not call at all, and that an answer outside the schema is never handed back.

const db = ownerDb();

beforeEach(wipe);
afterAll(wipe);

/** A provider that counts its calls around another one. */
function counting(inner: AiProvider = fakeProvider()) {
  const calls: string[] = [];
  const provider: AiProvider = {
    name: "fake",
    complete: (request) => {
      calls.push(request.user);
      return inner.complete(request);
    },
  };
  return { provider, calls };
}

function config(provider: AiProvider | null, over: Partial<AiConfig> = {}): AiConfig {
  return {
    provider,
    models: { fast: "fake-fast", plan: "fake-plan" },
    timeouts: { fast: 2_000, plan: 2_000 },
    ...over,
  };
}

function input(text: string): EnrichInput {
  return {
    text,
    today: "2026-11-11",
    weekday: "çarşamba",
    modules: [],
    similar: [],
    corrections: [],
  };
}

const calls = async () =>
  ok(await db.from("ai_calls").select("*").order("created_at", { ascending: true }));

describe("a call that reaches the provider", () => {
  it("returns the validated answer and logs it with tokens, cost, duration and fingerprint", async () => {
    const { provider } = counting();
    const result = await runAiCall({ db, config: config(provider) }, enrichSpec, input("Süt al"), {
      subject: { type: "inbox_entry", id: crypto.randomUUID() },
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.reused).toBe(false);
    expect(result.output.title).toBe("Süt al");

    const [row] = await calls();
    expect(row.id).toBe(result.callId);
    expect(row).toMatchObject({ kind: "enrich", model: "fake-fast", ok: true, error: null });
    expect(row.subject_type).toBe("inbox_entry");
    expect(row.input_tokens).toBeGreaterThan(0);
    expect(row.output_tokens).toBeGreaterThan(0);
    expect(Number(row.cost_usd)).toBeGreaterThan(0);
    expect(row.fingerprint).toMatch(/^[0-9a-f]{32}$/);
    expect(row.output).toEqual(result.output);
  });

  it("does not ask the same question twice; reuse can be turned off", async () => {
    const { provider, calls: asked } = counting();
    const deps = { db, config: config(provider) };

    const first = await runAiCall(deps, enrichSpec, input("Kitap oku"));
    const second = await runAiCall(deps, enrichSpec, input("Kitap oku"));
    expect(asked).toHaveLength(1);
    expect(second).toMatchObject({ status: "ok", reused: true });
    if (first.status === "ok" && second.status === "ok") {
      expect(second.callId).toBe(first.callId);
      expect(second.output).toEqual(first.output);
    }
    expect(await calls()).toHaveLength(1);

    // A different input, or a forced call, does ask.
    await runAiCall(deps, enrichSpec, input("Kitap oku, 30dk"));
    await runAiCall(deps, enrichSpec, input("Kitap oku"), { reuse: false });
    expect(asked).toHaveLength(3);
    expect(await calls()).toHaveLength(3);
  });

  it("does not reuse an answer given to an older prompt version", async () => {
    const { provider, calls: asked } = counting();
    const deps = { db, config: config(provider) };
    await runAiCall(deps, enrichSpec, input("Kitap oku"));
    await runAiCall(deps, { ...enrichSpec, version: "enrich-2" }, input("Kitap oku"));
    expect(asked).toHaveLength(2);
  });

  it("does not reuse another account's answer", async () => {
    const { provider, calls: asked } = counting();
    await runAiCall({ db, config: config(provider) }, enrichSpec, input("Kitap oku"));
    const other = await runAiCall(
      { db: strangerDb(), config: config(provider) },
      enrichSpec,
      input("Kitap oku"),
    );
    expect(other).toMatchObject({ status: "ok", reused: false });
    expect(asked).toHaveLength(2);
  });
});

describe("an answer outside the schema", () => {
  it("is logged as failed, with its cost, and never handed back", async () => {
    const result = await runAiCall(
      { db, config: config(fakeProvider()) },
      enrichSpec,
      input("Sunum [ai:invalid]"),
    );
    expect(result).toMatchObject({ status: "failed", reason: "invalid_output" });

    const [row] = await calls();
    expect(row.ok).toBe(false);
    expect(row.output).toBeNull();
    expect(row.error).toMatch(/^invalid_output: /);
    expect(Number(row.cost_usd)).toBeGreaterThan(0);
  });

  it("is never reused either: the same question is asked again", async () => {
    const { provider, calls: asked } = counting();
    const deps = { db, config: config(provider) };
    await runAiCall(deps, enrichSpec, input("Sunum [ai:invalid]"));
    await runAiCall(deps, enrichSpec, input("Sunum [ai:invalid]"));
    expect(asked).toHaveLength(2);
  });

  it("covers text that is not JSON and values out of range", async () => {
    const spec: AiCallSpec<{ n: number }> = {
      kind: "size",
      version: "test",
      system: "",
      maxTokens: 100,
      schema: z.object({ n: z.number().int().min(1).max(4) }),
    };
    const answering = (text: string): AiProvider => ({
      name: "fake",
      complete: async (request) => ({
        text,
        model: request.model,
        inputTokens: 1,
        outputTokens: 1,
      }),
    });

    for (const text of ["not json", '{"n": 7}', '{"n": "2"}', "{}"]) {
      const result = await runAiCall({ db, config: config(answering(text)) }, spec, { text });
      expect(result, text).toMatchObject({ status: "failed", reason: "invalid_output" });
    }
    const rows = await calls();
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => !row.ok && row.output === null)).toBe(true);
  });
});

describe("a call that fails", () => {
  it("gives up after the timeout and logs it", async () => {
    const started = Date.now();
    const result = await runAiCall(
      { db, config: config(fakeProvider(), { timeouts: { fast: 300, plan: 300 } }) },
      enrichSpec,
      input("Bekle [ai:timeout]"),
    );
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(result).toMatchObject({ status: "failed", reason: "timeout" });
    const [row] = await calls();
    expect(row).toMatchObject({ ok: false, output: null });
    expect(row.error).toMatch(/^timeout: /);
  });

  it("gives up even when the provider ignores the abort signal", async () => {
    const deaf: AiProvider = { name: "fake", complete: () => new Promise(() => {}) };
    const result = await runAiCall(
      { db, config: config(deaf, { timeouts: { fast: 200, plan: 200 } }) },
      enrichSpec,
      input("Sessiz"),
    );
    expect(result).toMatchObject({ status: "failed", reason: "timeout" });
  });

  it("logs a provider error and a refusal; a refusal counts the tokens it used", async () => {
    const deps = { db, config: config(fakeProvider()) };
    expect(await runAiCall(deps, enrichSpec, input("x [ai:error]"))).toMatchObject({
      status: "failed",
      reason: "provider_error",
    });
    expect(await runAiCall(deps, enrichSpec, input("x [ai:refusal]"))).toMatchObject({
      status: "failed",
      reason: "refused",
    });
    const [error, refusal] = await calls();
    expect(error.error).toMatch(/^provider_error: /);
    expect(Number(error.cost_usd)).toBe(0);
    expect(refusal.error).toMatch(/^refused: /);
    expect(refusal.input_tokens).toBeGreaterThan(0);
    expect(Number(refusal.cost_usd)).toBeGreaterThan(0);
  });

  it("does not hand back an answer it could not log", async () => {
    const provider: AiProvider = {
      name: "fake",
      complete: async (request) => ({
        text: JSON.stringify({ n: 2 }),
        model: request.model,
        inputTokens: 1,
        outputTokens: 1,
      }),
    };
    const spec: AiCallSpec<{ n: number }> = {
      kind: "size",
      version: "test",
      system: "",
      maxTokens: 100,
      schema: z.object({ n: z.number() }),
    };
    // A subject id that is not a uuid makes the insert fail.
    const result = await runAiCall(
      { db, config: config(provider) },
      spec,
      {},
      {
        subject: { type: "work_item", id: "not-a-uuid" },
      },
    );
    expect(result).toMatchObject({ status: "failed", reason: "log_failed", callId: null });
    expect(await calls()).toHaveLength(0);
  });

  it("turns an unexpected exception into a provider error", async () => {
    const broken: AiProvider = {
      name: "fake",
      complete: async () => {
        throw new TypeError("boom");
      },
    };
    expect(await runAiCall({ db, config: config(broken) }, enrichSpec, input("x"))).toMatchObject({
      status: "failed",
      reason: "provider_error",
      error: "boom",
    });
  });
});

describe("no call at all", () => {
  it("without a provider, a model or a price, and nothing is logged", async () => {
    const { provider, calls: asked } = counting();
    expect(await runAiCall({ db, config: config(null) }, enrichSpec, input("x"))).toEqual({
      status: "skipped",
      reason: "no_provider",
    });
    expect(
      await runAiCall(
        { db, config: config(provider, { models: { fast: null, plan: "fake-plan" } }) },
        enrichSpec,
        input("x"),
      ),
    ).toEqual({ status: "skipped", reason: "no_model" });
    expect(
      await runAiCall(
        { db, config: config(provider, { models: { fast: "unknown-model", plan: null } }) },
        enrichSpec,
        input("x"),
      ),
    ).toEqual({ status: "skipped", reason: "no_price" });
    expect(asked).toHaveLength(0);
    expect(await calls()).toHaveLength(0);
  });

  it("when the AI is switched off in the settings", async () => {
    ok(await db.from("settings").insert({ ai_enabled: false }).select().single());
    const { provider, calls: asked } = counting();
    expect(await runAiCall({ db, config: config(provider) }, enrichSpec, input("x"))).toEqual({
      status: "skipped",
      reason: "disabled",
    });
    expect(asked).toHaveLength(0);
  });

  it("when switched off, even for a question it had answered before", async () => {
    const { provider, calls: asked } = counting();
    const deps = { db, config: config(provider) };
    expect(await runAiCall(deps, enrichSpec, input("Kitap oku"))).toMatchObject({ status: "ok" });
    ok(await db.from("settings").insert({ ai_enabled: false }).select().single());
    expect(await runAiCall(deps, enrichSpec, input("Kitap oku"))).toEqual({
      status: "skipped",
      reason: "disabled",
    });
    expect(asked).toHaveLength(1);
  });

  it("when the checks cannot be read, instead of throwing or calling unchecked", async () => {
    // The secret key has no user: the spending function refuses to answer. The key sees every
    // account's rows; another account's settings (the end-to-end tests' account keeps one) must
    // not decide the answer, so none are left.
    ok(await adminDb().from("settings").delete().not("id", "is", null).select());
    const { provider, calls: asked } = counting();
    expect(
      await runAiCall({ db: adminDb(), config: config(provider) }, enrichSpec, input("x")),
    ).toEqual({ status: "skipped", reason: "check_failed" });
    expect(asked).toHaveLength(0);
    expect(await calls()).toHaveLength(0);
  });

  it("when the budget is 0", async () => {
    ok(await db.from("settings").insert({ ai_monthly_budget_usd: 0 }).select().single());
    const { provider, calls: asked } = counting();
    expect(await runAiCall({ db, config: config(provider) }, enrichSpec, input("x"))).toEqual({
      status: "skipped",
      reason: "budget",
    });
    expect(asked).toHaveLength(0);
    expect(await calls()).toHaveLength(0);
  });

  it("once this month's spending reaches the budget, and again next month it may", async () => {
    ok(await db.from("settings").insert({ ai_monthly_budget_usd: 0.5 }).select().single());
    const { provider, calls: asked } = counting();
    const deps = { db, config: config(provider) };

    // Spent last month: does not count against this month.
    ok(
      await db
        .from("ai_calls")
        .insert({
          kind: "enrich",
          model: "fake-fast",
          ok: true,
          cost_usd: 3,
          created_at: "2000-01-15T10:00:00Z",
        })
        .select()
        .single(),
    );
    expect(await runAiCall(deps, enrichSpec, input("bir"))).toMatchObject({ status: "ok" });

    ok(
      await db
        .from("ai_calls")
        .insert({ kind: "enrich", model: "fake-fast", ok: true, cost_usd: 0.5 })
        .select()
        .single(),
    );
    expect(await runAiCall(deps, enrichSpec, input("iki"))).toEqual({
      status: "skipped",
      reason: "budget",
    });
    expect(asked).toHaveLength(1);
  });

  it("but an earlier answer is still reused when the budget is used up", async () => {
    const { provider, calls: asked } = counting();
    const deps = { db, config: config(provider) };
    await runAiCall(deps, enrichSpec, input("Kitap oku"));
    ok(await db.from("settings").insert({ ai_monthly_budget_usd: 0 }).select().single());
    expect(await runAiCall(deps, enrichSpec, input("Kitap oku"))).toMatchObject({
      status: "ok",
      reused: true,
    });
    expect(asked).toHaveLength(1);
  });
});
