import { describe, expect, it, vi } from "vitest";
import { decomposeOutput } from "./calls/decompose";
import { enrichOutput } from "./calls/enrich";
import { extractSpec } from "./calls/extract";
import { type SizeInput, sizeOutput } from "./calls/size";
import { monthStartInstant, withinBudget } from "./budget";
import { fakeProvider } from "./fake";
import { canonicalJson, fingerprint } from "./fingerprint";
import { parseOutput } from "./gateway";
import { callCost, hasPrice } from "./pricing";
import type { AiKind, ProviderRequest } from "./types";
import { z } from "zod";

vi.mock("server-only", () => ({}));
const { aiConfigFromEnv } = await import("./config");

describe("pricing", () => {
  it("prices the configured models per million tokens", () => {
    // 1500 in, 200 out on Haiku 5.5: 1500 × 0.10 + 200 × 0.50 = 250 millionths of a dollar.
    expect(callCost("claude-haiku-5-5", 1500, 200)).toBeCloseTo(0.00025, 9);
    expect(callCost("claude-sonnet-5-5", 6000, 1000)).toBeCloseTo(0.022, 9);
    expect(callCost("claude-haiku-5-5", 0, 0)).toBe(0);
  });

  it("uses the long-context price above 100k input tokens on Haiku", () => {
    expect(callCost("claude-haiku-5-5", 200_000, 1000)).toBeCloseTo(0.1025, 9);
  });

  it("has no price for an unknown model, so it is not called", () => {
    expect(hasPrice("claude-unknown")).toBe(false);
    expect(callCost("claude-unknown", 10, 10)).toBeNull();
    expect(hasPrice("toString")).toBe(false);
  });
});

describe("fingerprint", () => {
  it("does not depend on key order or undefined fields", async () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { y: 1, x: 2 }], c: undefined } })).toBe(
      '{"a":{"d":[2,{"x":2,"y":1}]},"b":1}',
    );
    const one = await fingerprint({
      kind: "enrich",
      model: "m",
      version: "1",
      input: { a: 1, b: 2 },
    });
    const two = await fingerprint({
      kind: "enrich",
      model: "m",
      version: "1",
      input: { b: 2, a: 1 },
    });
    expect(one).toBe(two);
    expect(one).toMatch(/^[0-9a-f]{32}$/);
  });

  it("changes with the kind, the model, the version and the input", async () => {
    const base = { kind: "enrich", model: "m", version: "1", input: { a: 1 } };
    const prints = await Promise.all([
      fingerprint(base),
      fingerprint({ ...base, kind: "size" }),
      fingerprint({ ...base, model: "n" }),
      fingerprint({ ...base, version: "2" }),
      fingerprint({ ...base, input: { a: 2 } }),
    ]);
    expect(new Set(prints).size).toBe(5);
  });
});

describe("budget", () => {
  it("starts the month on the 1st, 00:00 Istanbul time", () => {
    // 30 Nov 22:30 UTC is already 1 Dec 01:30 in Istanbul.
    expect(monthStartInstant(new Date("2026-11-30T22:30:00Z")).toISOString()).toBe(
      "2026-11-30T21:00:00.000Z",
    );
    expect(monthStartInstant(new Date("2026-11-30T20:30:00Z")).toISOString()).toBe(
      "2026-10-31T21:00:00.000Z",
    );
  });

  it("is open while spending is below a positive budget; 0 closes it", () => {
    expect(withinBudget(0, 5)).toBe(true);
    expect(withinBudget(4.99, 5)).toBe(true);
    expect(withinBudget(5, 5)).toBe(false);
    expect(withinBudget(0, 0)).toBe(false);
  });
});

describe("output validation", () => {
  const schema = z.object({ n: z.number().int().min(1).max(4) });

  it("accepts JSON that fits the schema", () => {
    expect(parseOutput(schema, '{"n":3}')).toEqual({ ok: true, value: { n: 3 } });
  });

  it("refuses text that is not JSON, and JSON that does not fit", () => {
    for (const text of ["", "n=3", '{"n":5}', '{"n":2.5}', '{"m":1}', "[]"]) {
      expect(parseOutput(schema, text).ok, text).toBe(false);
    }
    const failed = parseOutput(schema, '{"n":9}');
    expect(failed.ok ? "" : failed.error).toContain("n:");
  });

  it("keeps decompose's steps in order: unique refs, dependencies only on earlier steps", () => {
    const step = (ref: string, depends_on: string[] = []) => ({
      ref,
      title: ref,
      effort_minutes: 30,
      depends_on,
      due: null,
    });
    const ok = { steps: [step("a"), step("b", ["a"])], reason: "" };
    expect(decomposeOutput.safeParse(ok).success).toBe(true);
    for (const steps of [
      [step("a"), step("a")],
      [step("a", ["b"]), step("b")],
      [step("a"), step("b", ["x"])],
      [step("a", ["a"]), step("b")],
      [step("a")],
    ]) {
      expect(decomposeOutput.safeParse({ steps, reason: "" }).success).toBe(false);
    }
  });

  it("wraps a module's item schema for extract and names the module in the version", () => {
    const spec = extractSpec("okul", {
      key: "duyuru",
      version: "1",
      instructions: "Ödev tarihleri",
      item: z.object({ title: z.string(), due: z.string() }),
      max: 2,
    });
    expect(spec.version).toBe("extract-1/okul/duyuru/1");
    expect(spec.system).toContain("Ödev tarihleri");
    const item = { title: "Ödev 1", due: "2026-11-20" };
    expect(spec.schema.safeParse({ suggestions: [item], note: null }).success).toBe(true);
    expect(spec.schema.safeParse({ suggestions: [item, item, item], note: null }).success).toBe(
      false,
    );
    expect(spec.schema.safeParse({ suggestions: [{ title: 1 }], note: null }).success).toBe(false);
  });
});

describe("the fake provider", () => {
  const request = (kind: AiKind, input: unknown): ProviderRequest => ({
    kind,
    model: "fake-fast",
    tier: "fast",
    system: "system",
    user: JSON.stringify(input),
    schema: z.unknown(),
    maxTokens: 100,
    signal: new AbortController().signal,
  });
  const sizeInput = (over: Partial<SizeInput> = {}): SizeInput => ({
    title: "Rapor",
    module: { slug: "okul", name: "Okul" },
    sizing_hints: null,
    today: "2026-11-11",
    due: null,
    hard_deadline: false,
    known: { importance: null, energy: null, session_minutes: null },
    bounds: null,
    meta: {},
    need: ["effort_total_minutes", "session_minutes"],
    similar: [],
    ...over,
  });

  it("answers every call in its schema", async () => {
    const fake = fakeProvider();
    const enrich = await fake.complete(request("enrich", { text: "Süt al" }));
    expect(enrichOutput.safeParse(JSON.parse(enrich.text)).success).toBe(true);
    const size = await fake.complete(request("size", sizeInput()));
    expect(sizeOutput.safeParse(JSON.parse(size.text)).success).toBe(true);
    const decompose = await fake.complete(request("decompose", { title: "Tez" }));
    expect(decomposeOutput.safeParse(JSON.parse(decompose.text)).success).toBe(true);
    expect(enrich.inputTokens).toBeGreaterThan(0);
  });

  it("sizes only what is asked, inside the bounds and off their middle", async () => {
    const fake = fakeProvider();
    const answer = sizeOutput.parse(
      JSON.parse(
        (await fake.complete(request("size", sizeInput({ bounds: { min: 60, max: 240 } })))).text,
      ),
    );
    const effort = answer.effort_total_minutes.value!;
    expect(effort).toBeGreaterThanOrEqual(60);
    expect(effort).toBeLessThanOrEqual(240);
    expect(effort).not.toBe(150);
    expect(answer.importance.value).toBeNull();
    expect(answer.energy.value).toBeNull();
  });

  it("misbehaves on the markers", async () => {
    const fake = fakeProvider();
    const invalid = await fake.complete(request("enrich", { text: "x [ai:invalid]" }));
    expect(enrichOutput.safeParse(JSON.parse(invalid.text)).success).toBe(false);
    await expect(fake.complete(request("enrich", { text: "[ai:error]" }))).rejects.toMatchObject({
      reason: "provider_error",
    });
    await expect(fake.complete(request("enrich", { text: "[ai:refusal]" }))).rejects.toMatchObject({
      reason: "refused",
    });
    const controller = new AbortController();
    const waiting = fake.complete({
      ...request("enrich", { text: "[ai:timeout]" }),
      signal: controller.signal,
    });
    controller.abort();
    await expect(waiting).rejects.toMatchObject({ reason: "timeout" });
  });
});

describe("configuration from the environment", () => {
  const LOCAL = "http://127.0.0.1:54321";

  it("has no provider without a key: the app runs without AI", () => {
    const config = aiConfigFromEnv({ NEXT_PUBLIC_SUPABASE_URL: LOCAL });
    expect(config.provider).toBeNull();
    expect(config.timeouts).toEqual({ fast: 8_000, plan: 30_000 });
    expect(aiConfigFromEnv({ ANTHROPIC_API_KEY: "  " }).provider).toBeNull();
  });

  it("uses the real provider with a key, models from the environment", () => {
    const config = aiConfigFromEnv({
      ANTHROPIC_API_KEY: "sk-test",
      AI_MODEL_FAST: "claude-haiku-5-5",
      AI_MODEL_PLAN: "claude-sonnet-5-5",
      AI_TIMEOUT_FAST_MS: "5000",
    });
    expect(config.provider?.name).toBe("anthropic");
    expect(config.models).toEqual({ fast: "claude-haiku-5-5", plan: "claude-sonnet-5-5" });
    expect(config.timeouts).toEqual({ fast: 5_000, plan: 30_000 });
    expect(aiConfigFromEnv({ ANTHROPIC_API_KEY: "sk-test" }).models).toEqual({
      fast: null,
      plan: null,
    });
  });

  it("uses the fake provider only against a local database", () => {
    const local = aiConfigFromEnv({ SHERPA_AI_FAKE: "1", NEXT_PUBLIC_SUPABASE_URL: LOCAL });
    expect(local.provider?.name).toBe("fake");
    expect(local.models).toEqual({ fast: "fake-fast", plan: "fake-plan" });

    const cloud = aiConfigFromEnv({
      SHERPA_AI_FAKE: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      ANTHROPIC_API_KEY: "sk-test",
    });
    expect(cloud.provider?.name).toBe("anthropic");
    expect(
      aiConfigFromEnv({ SHERPA_AI_FAKE: "1", NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" })
        .provider,
    ).toBeNull();
  });
});
