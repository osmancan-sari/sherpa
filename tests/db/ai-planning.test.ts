import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { saveAiSettings } from "@/core/ai/budget";
import { fakeProvider } from "@/core/ai/fake";
import { monthFlow, planDayFlow, reviewFlow, weekFlow } from "@/core/ai/flows/planning";
import type { AiConfig, AiProvider } from "@/core/ai/types";
import type { ModuleDefinition, ModuleRegistry } from "@/core/contract/types";
import { loadPlanRows } from "@/core/data/keep";
import { planDay } from "@/core/data/planning";
import { completeTask, createTask, createWorkItem } from "@/core/data/work";
import { buildPlan, planInput, storedPlan } from "@/core/planner";
import { istanbulInstant, shiftDay } from "@/lib/date";
import { makeModule, ok, ownerDb, wipe } from "./helpers";

// The planning calls (Ç3) end to end against the database, with the recorded fake provider: the
// AI suggests, the engine applies within its rules, and without an answer the engine's plan
// stands (docs/10-yapay-zeka.md, "Plan çağrısının akışı").

const db = ownerDb();
beforeEach(wipe);
afterAll(wipe);

// A Wednesday morning.
const TODAY = "2026-11-18";
const NOW = istanbulInstant(TODAY, "09:00");

function config(provider: AiProvider | null = fakeProvider()): AiConfig {
  return {
    provider,
    models: { fast: "fake-fast", plan: "fake-plan" },
    timeouts: { fast: 2_000, plan: 2_000 },
  };
}
const deps = (provider?: AiProvider | null) => ({ db, config: config(provider) });

const day = async (date: string) =>
  (await db.from("days").select("*").eq("date", date).maybeSingle()).data;

describe("plan", () => {
  it("gives the day the AI's three with their reasons; the engine places them", async () => {
    const mod = await makeModule(db);
    const tasks = [];
    for (const title of ["Rapor", "Okuma", "Fatura", "Mesaj"]) {
      tasks.push(await createTask(db, { module_id: mod.id, title, est_minutes: 30 }));
    }
    const result = await planDayFlow(deps(), { date: TODAY, kind: "plan" }, NOW);
    expect(result.status).toBe("applied");
    const row = await day(TODAY);
    expect(row).toMatchObject({ plan_source: "ai" });
    expect(row!.top3.length).toBe(3);
    const advice = storedPlan(row).advice!;
    expect(advice.top3).toEqual(row!.top3);
    expect(Object.values(row!.plan_reasons as Record<string, string>)).toContain(
      "Yapay zeka: günün en önemli işi bu.",
    );
    const [call] = ok(await db.from("ai_calls").select("kind, ok, model"));
    expect(call).toEqual({ kind: "plan", ok: true, model: "fake-plan" });
    // The screen's plan carries the reasons behind "neden?".
    const rows = await loadPlanRows(db, NOW);
    const plan = buildPlan(planInput(rows, { date: TODAY, now: NOW, context: "desk" }));
    const first = plan.slots.find((slot) => slot.assignment)!.assignment!;
    expect(first.reasons.join(" ")).toContain("Yapay zeka");
  });

  it("cannot put off mandatory work: the engine keeps it and warns", async () => {
    const mod = await makeModule(db);
    const due = await createTask(db, {
      module_id: mod.id,
      title: "Bugün teslim [ai:defer]",
      due_at: istanbulInstant(TODAY, "17:00").toISOString(),
    });
    const plain = await createTask(db, { module_id: mod.id, title: "Sıradan [ai:defer]" });
    await planDayFlow(deps(), { date: TODAY, kind: "plan" }, NOW);
    const rows = await loadPlanRows(db, NOW);
    const plan = buildPlan(planInput(rows, { date: TODAY, now: NOW, context: "desk" }));
    const placed = plan.slots.flatMap((slot) =>
      slot.assignment ? [slot.assignment.candidate.id] : [],
    );
    expect(placed).toContain(due.id);
    expect(placed).not.toContain(plain.id);
    expect(plan.warnings).toContainEqual(
      expect.objectContaining({ kind: "advice_rejected", subjectId: due.id }),
    );
  });

  it("writes nothing in preview; nothing without a provider; the engine's plan stays", async () => {
    const mod = await makeModule(db);
    await createTask(db, { module_id: mod.id, title: "Rapor" });
    const preview = await planDayFlow(deps(), { date: TODAY, kind: "plan", preview: true }, NOW);
    expect(preview.status).toBe("applied");
    expect(await day(TODAY)).toBeNull();

    const rows = await loadPlanRows(db, NOW);
    const input = planInput(rows, { date: TODAY, now: NOW, context: "desk" });
    await planDay(db, { plan: buildPlan(input), day: input });
    const skipped = await planDayFlow(deps(null), { date: TODAY, kind: "plan" }, NOW);
    expect(skipped).toEqual({ status: "skipped", reason: "no_provider" });
    expect(await day(TODAY)).toMatchObject({ plan_source: "auto" });

    // A spent budget: no new call (an earlier answer to the same question would still be
    // reused, docs/10; here the question is new). The day's plan was asked once already, so
    // "Yeniden planla" asks.
    await saveAiSettings(db, { enabled: true, budgetUsd: 0 });
    await createTask(db, { module_id: mod.id, title: "Yeni iş" });
    const budget = await planDayFlow(deps(), { date: TODAY, kind: "replan" }, NOW);
    expect(budget).toEqual({ status: "skipped", reason: "budget" });
    expect(await day(TODAY)).toMatchObject({ plan_source: "auto" });
  });

  it("replan keeps what is finished of the day's three", async () => {
    const mod = await makeModule(db);
    const done = await createTask(db, { module_id: mod.id, title: "Bitti" });
    await createTask(db, { module_id: mod.id, title: "Kalan" });
    await planDayFlow(deps(), { date: TODAY, kind: "plan" }, NOW);
    expect((await day(TODAY))!.top3).toContain(done.id);
    await completeTask(db, done.id);
    const later = istanbulInstant(TODAY, "14:00");
    const result = await planDayFlow(
      deps(),
      { date: TODAY, kind: "replan", note: "Öğleden sonra boşum" },
      later,
    );
    expect(result.status).toBe("applied");
    expect((await day(TODAY))!.top3[0]).toBe(done.id);
    const kinds = ok(await db.from("ai_calls").select("kind").order("created_at")).map(
      (row) => row.kind,
    );
    expect(kinds).toEqual(["plan", "replan"]);
  });
});

describe("plan, once a day", () => {
  it("is asked once a day, and never over the evening's plan", async () => {
    const mod = await makeModule(db);
    await createTask(db, { module_id: mod.id, title: "Rapor" });
    const rows = await loadPlanRows(db, NOW);
    const input = planInput(rows, { date: TODAY, now: NOW, context: "desk" });
    await planDay(db, { plan: buildPlan(input), day: input });
    // A provider that fails: the attempt still counts for the day.
    const down = fakeProvider({
      plan: () => {
        throw new Error("down");
      },
    });
    expect((await planDayFlow(deps(down), { date: TODAY, kind: "plan" }, NOW)).status).toBe(
      "failed",
    );
    expect(await planDayFlow(deps(), { date: TODAY, kind: "plan" }, NOW)).toEqual({
      status: "skipped",
      reason: "already_planned",
    });
    expect(storedPlan(await day(TODAY)).aiAsked).toBe(true);

    const tomorrow = shiftDay(TODAY, 1);
    await db.from("days").insert({ date: tomorrow, plan_source: "closing", top3: [] });
    expect(await planDayFlow(deps(), { date: tomorrow, kind: "plan" }, NOW)).toEqual({
      status: "skipped",
      reason: "already_planned",
    });
  });

  it("corrects only the lengths the AI itself guessed", async () => {
    const mod = await makeModule(db);
    const guessed = await createTask(db, {
      module_id: mod.id,
      title: "Tahmin edilen",
      est_minutes: 30,
    });
    await db
      .from("tasks")
      .update({
        ai: {
          kind: "enrich",
          model: "fake-fast",
          at: NOW.toISOString(),
          call_id: "",
          input: "Tahmin edilen",
          user_edited: [],
          fields: { est_minutes: { value: 30, confidence: 0.6, reason: "benzer işler" } },
        },
      })
      .eq("id", guessed.id);
    const typed = await createTask(db, {
      module_id: mod.id,
      title: "Elle yazılan",
      est_minutes: 30,
    });
    const item = await createWorkItem(db, {
      module_id: mod.id,
      title: "Kalem",
      effort_total_minutes: 120,
    });
    const sitting = await createTask(db, {
      module_id: mod.id,
      title: "Kalem",
      work_item_id: item.id,
      est_minutes: 30,
    });
    const longer = fakeProvider({
      replan: (input) => ({
        top3: [],
        prefer: [],
        defer: [],
        estimates: (input as { candidates: { id: string }[] }).candidates.map((row) => ({
          id: row.id,
          minutes: 60,
          reason: "Daha uzun sürer.",
        })),
        warnings: [],
      }),
    });
    expect((await planDayFlow(deps(longer), { date: TODAY, kind: "replan" }, NOW)).status).toBe(
      "applied",
    );
    const minutes = Object.fromEntries(
      ok(await db.from("tasks").select("id, est_minutes")).map((row) => [row.id, row.est_minutes]),
    );
    expect(minutes[guessed.id]).toBe(60);
    expect(minutes[typed.id]).toBe(30);
    expect(minutes[sitting.id]).toBe(30);
  });
});

describe("week", () => {
  it("commits the week with the AI's reasons; without an answer the engine commits", async () => {
    const mod = await makeModule(db);
    const item = await createWorkItem(db, {
      module_id: mod.id,
      title: "Proje",
      effort_total_minutes: 120,
      due_at: istanbulInstant(shiftDay(TODAY, 2), "23:59").toISOString(),
    });
    const result = await weekFlow(deps(), NOW, false);
    expect(result.plan).toMatchObject({
      committed: [item.id],
      plan_source: "ai",
      reasons: { [item.id]: "Yapay zeka: bu haftaya düşüyor." },
    });
    const engine = await weekFlow(deps(null), istanbulInstant(TODAY, "10:00"), true);
    expect(engine.plan).toMatchObject({ committed: [item.id], plan_source: "auto" });
  });
});

describe("month and review", () => {
  it("keeps the AI's proposals for a tight week, and its look back at the week", async () => {
    const mod = await makeModule(db);
    // Far more work due this week than it can hold.
    await createWorkItem(db, {
      module_id: mod.id,
      title: "Dev iş",
      effort_total_minutes: 6000,
      due_at: istanbulInstant(shiftDay(TODAY, 3), "23:59").toISOString(),
    });
    const month = await monthFlow(deps(), NOW);
    expect(month).toEqual({ status: "applied", proposals: 1 });
    const [horizon] = ok(await db.from("horizon_reviews").select("scope, period_start, proposals"));
    expect(horizon).toMatchObject({ scope: "month", period_start: "2026-11-01" });
    expect((horizon.proposals as { kind: string }[])[0]).toMatchObject({
      kind: "mode",
      mode: "busy",
    });

    const definition = {
      slug: mod.slug,
      weeklyReport: async () => ({ metrics: [{ label: "Kayıt", value: "3" }], suggestions: [] }),
    } as unknown as ModuleDefinition;
    const registry = {
      get: (slug: string) => (slug === mod.slug ? definition : undefined),
    } as ModuleRegistry;
    const review = await reviewFlow(deps(), registry, istanbulInstant("2026-11-21", "09:00"));
    expect(review).toEqual({ status: "applied" });
    const [row] = ok(await db.from("weekly_reviews").select("week_start, summary"));
    expect(row).toMatchObject({ week_start: "2026-11-16" });
    expect((row.summary as { summary: string }).summary).toContain("1 modülde");
  });
});
