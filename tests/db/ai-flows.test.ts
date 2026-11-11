import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { decomposeWorkItem } from "@/core/ai/flows/decompose";
import { enrichEntry } from "@/core/ai/flows/enrich";
import { applyEnrichment, readSuggestion } from "@/core/ai/flows/enrich-apply";
import { runExtract } from "@/core/ai/flows/extract";
import { sizeWorkItem } from "@/core/ai/flows/size";
import { acceptSplit, declineSplit } from "@/core/ai/flows/split";
import { fakeProvider } from "@/core/ai/fake";
import { saveAiSettings, usageThisMonth } from "@/core/ai/budget";
import { readMark } from "@/core/ai/marks";
import { aiStatus } from "@/core/ai/status";
import type { AiConfig, AiProvider } from "@/core/ai/types";
import type { ModuleDefinition, ModuleRegistry, WorkProposal } from "@/core/contract/types";
import { addInboxEntry } from "@/core/data/inbox";
import { onProposal, propose } from "@/core/data/propose";
import { updateTask, updateWorkItem } from "@/core/data/work";
import { todayCandidates } from "@/core/today/select";
import { kayitReader } from "@/modules/deneme/extract";
import { makeModule, ok, ownerDb, wipe } from "./helpers";

// The AI flows end to end against the real database, with the recorded fake provider: what an
// answer writes, what it never writes, and what happens without an answer.

const db = ownerDb();
// Wednesday 11 November 2026, 12:00 in Istanbul.
const NOW = new Date("2026-11-11T09:00:00Z");

beforeEach(wipe);
afterAll(wipe);

function config(provider: AiProvider | null = fakeProvider()): AiConfig {
  return {
    provider,
    models: { fast: "fake-fast", plan: "fake-plan" },
    timeouts: { fast: 2_000, plan: 2_000 },
  };
}
const deps = (provider?: AiProvider | null) => ({ db, config: config(provider) });

const sinama: Partial<ModuleDefinition> = {
  slug: "sinama",
  name: "Sınama",
  intake: [],
  sizingHints: "Bir ara sınav hazırlığı genelde 4–8 saat sürer.",
  extractors: [
    {
      key: "duyuru",
      version: "1",
      instructions: "Duyurudaki sınav tarihlerini bul.",
      item: z.object({ title: z.string(), day: z.string() }),
    },
  ],
};
const registry: ModuleRegistry = {
  list: [sinama as ModuleDefinition],
  get: (slug) => (slug === "sinama" ? (sinama as ModuleDefinition) : undefined),
};

const calls = async () => ok(await db.from("ai_calls").select("*").order("created_at"));
const feedback = async () => ok(await db.from("ai_feedback").select("*").order("created_at"));
const entryOf = async (id: string) =>
  ok(await db.from("inbox_entries").select("*").eq("id", id).single());

describe("enrich", () => {
  it("turns a free line into a task of the module it names, marked as the AI's", async () => {
    const mod = await makeModule(db);
    const entry = await addInboxEntry(db, "Sınama sunum slaytları cuma");

    const outcome = await enrichEntry(deps(), registry, entry.id, NOW);
    expect(outcome).toMatchObject({ status: "applied", target: "task" });
    if (outcome.status !== "applied") return;

    const task = ok(await db.from("tasks").select("*").eq("id", outcome.id).single());
    expect(task).toMatchObject({
      module_id: mod.id,
      title: "Sınama sunum slaytları",
      est_minutes: 45,
      importance: 3,
      // Friday 13 November, the end of the day in Istanbul: typed on the line, so the user's.
      due_at: "2026-11-13T20:59:00+00:00",
    });
    const mark = readMark(task.ai)!;
    expect(mark.fields.module_id.reason).toBe("modülün adı geçiyor");
    expect(mark.fields.importance.value).toBe(3);
    expect(mark.fields.due_at).toBeUndefined();

    const routed = await entryOf(entry.id);
    expect(routed.status).toBe("routed");
    expect(routed.routed).toEqual([{ type: "task", id: task.id, module: "sinama" }]);
    const [call] = await calls();
    expect(call).toMatchObject({ kind: "enrich", ok: true, subject_id: entry.id });
    expect(mark.call_id).toBe(call.id);
  });

  it("makes a work item of a large piece of work and offers its steps as a split", async () => {
    await makeModule(db);
    const entry = await addInboxEntry(db, "Sınama dönem projesi");
    const outcome = await enrichEntry(deps(), registry, entry.id, NOW);
    expect(outcome).toMatchObject({ status: "applied", target: "work_item" });
    if (outcome.status !== "applied") return;

    const items = ok(await db.from("work_items").select("*").order("created_at"));
    const item = items.find((row) => row.id === outcome.id)!;
    expect(item).toMatchObject({ effort_total_minutes: 240, energy: "deep", status: "active" });
    expect(item.provenance).toMatchObject({ effort_total_minutes: "ai", module_id: "ai" });
    const pieces = items.filter((row) => row.parent_id === item.id);
    expect(pieces.map((row) => [row.title, row.status])).toEqual([
      ["Kapsamı çıkar", "proposed"],
      ["İlk taslak", "proposed"],
    ]);
  });

  it("keeps an unsure answer as a card; confirming it with another module records the correction", async () => {
    const mod = await makeModule(db);
    await makeModule(db, "spor", "Spor");
    const entry = await addInboxEntry(db, "Sınama okuma listesi [ai:unsure]");

    expect(await enrichEntry(deps(), registry, entry.id, NOW)).toEqual({
      status: "needs_confirm",
      entryId: entry.id,
    });
    expect(ok(await db.from("tasks").select("id"))).toEqual([]);
    const card = await entryOf(entry.id);
    expect(card.status).toBe("needs_confirm");
    const suggestion = readSuggestion(card)!;
    expect(suggestion.output.module.value).toBe("sinama");

    // The user picks "Spor" on the card.
    const spor = ok(await db.from("modules").select("*").eq("slug", "spor").single());
    const applied = await applyEnrichment(db, {
      entry: card,
      output: suggestion.output,
      parsed: suggestion.parsed,
      callId: suggestion.call_id,
      model: suggestion.model,
      moduleId: spor.id,
      moduleSlug: "spor",
      aiModuleSlug: suggestion.output.module.value,
      now: NOW,
    });
    expect(applied).toMatchObject({ status: "applied", target: "task" });
    const task = ok(await db.from("tasks").select("*").single());
    expect(task.module_id).toBe(spor.id);
    expect(task.module_id).not.toBe(mod.id);
    expect(readMark(task.ai)!.fields.module_id).toBeUndefined();
    expect(await feedback()).toMatchObject([
      {
        kind: "enrich",
        module_slug: "spor",
        ai_value: { module: "sinama" },
        user_value: { module: "spor" },
      },
    ]);
    expect((await entryOf(entry.id)).status).toBe("routed");

    // A second confirmation of the same card does nothing.
    expect(
      await applyEnrichment(db, {
        entry: card,
        output: suggestion.output,
        parsed: suggestion.parsed,
        callId: suggestion.call_id,
        model: suggestion.model,
        moduleId: spor.id,
        moduleSlug: "spor",
        now: NOW,
      }),
    ).toEqual({ status: "gone" });
    expect(ok(await db.from("tasks").select("id"))).toHaveLength(1);
  });

  it("without a provider, the line stays in the inbox and nothing is logged", async () => {
    await makeModule(db);
    const entry = await addInboxEntry(db, "Sınama sunum slaytları cuma");
    expect(await enrichEntry(deps(null), registry, entry.id, NOW)).toEqual({
      status: "skipped",
      reason: "no_provider",
    });
    expect((await entryOf(entry.id)).status).toBe("new");
    expect(await calls()).toEqual([]);
  });

  it("with a budget of 0, no call is made", async () => {
    await makeModule(db);
    ok(await db.from("settings").insert({ ai_monthly_budget_usd: 0 }).select());
    const entry = await addInboxEntry(db, "Sınama sunum slaytları");
    expect(await enrichEntry(deps(), registry, entry.id, NOW)).toEqual({
      status: "skipped",
      reason: "budget",
    });
    expect(await calls()).toEqual([]);
    expect((await aiStatus(deps(), NOW)).state).toBe("budget");
  });

  it("an answer outside the schema writes nothing", async () => {
    await makeModule(db);
    const entry = await addInboxEntry(db, "Sınama sunum [ai:invalid]");
    expect(await enrichEntry(deps(), registry, entry.id, NOW)).toMatchObject({
      status: "failed",
      reason: "invalid_output",
    });
    const card = await entryOf(entry.id);
    expect(card).toMatchObject({ status: "new", suggestion: null });
    expect(ok(await db.from("tasks").select("id"))).toEqual([]);
    expect(ok(await db.from("work_items").select("id"))).toEqual([]);
    // The failed call is still in the log, with what it cost.
    expect(await calls()).toMatchObject([{ kind: "enrich", ok: false, output: null }]);
  });

  it("leaves an entry the user routed in the meantime alone", async () => {
    await makeModule(db);
    const entry = await addInboxEntry(db, "Sınama sunum");
    ok(await db.from("inbox_entries").update({ status: "dismissed" }).eq("id", entry.id).select());
    expect(await enrichEntry(deps(), registry, entry.id, NOW)).toEqual({ status: "gone" });
    expect(await calls()).toEqual([]);
  });

  it("a value the user changes is recorded as a correction and never set by the AI again", async () => {
    await makeModule(db);
    const entry = await addInboxEntry(db, "Sınama sunum slaytları");
    const outcome = await enrichEntry(deps(), registry, entry.id, NOW);
    if (outcome.status !== "applied") throw new Error("not applied");

    // A status change touches no AI value: no correction.
    await updateTask(db, outcome.id, { status: "doing" });
    expect(await feedback()).toEqual([]);

    await updateTask(db, outcome.id, { est_minutes: 20, importance: 2 });
    const task = ok(await db.from("tasks").select("*").single());
    const mark = readMark(task.ai)!;
    // Importance was 2 already: the same value is not a correction.
    expect(mark.user_edited).toEqual(["est_minutes"]);
    expect(await feedback()).toMatchObject([
      {
        kind: "enrich",
        module_slug: "sinama",
        input_summary: "Sınama sunum slaytları",
        ai_value: { est_minutes: 45 },
        user_value: { est_minutes: 20 },
      },
    ]);
  });
});

/** A deadline proposal that leaves the effort to the AI. */
function prep(over: Partial<WorkProposal> = {}): WorkProposal {
  return {
    schema: 1,
    key: "assessment:1:prep",
    source: { type: "sinama.kayit", id: "8f2c1d7e-3b4a-4c5d-9e6f-0a1b2c3d4e5f" },
    title: "Ara sınav hazırlığı",
    when: { due: "2026-11-20T10:00:00+03:00", hard: true },
    effort: { bounds: { min: 120, max: 600 } },
    fit: { context: "desk" },
    meta: { scope: "Hafta 1–6" },
    ...over,
  };
}

describe("size", () => {
  it("fills the empty judgement fields of a proposal inside its bounds, with reasons", async () => {
    const mod = await makeModule(db);
    const { id } = await propose(db, mod, prep());
    // Before the AI: the middle of the bounds, as a default.
    expect(ok(await db.from("work_items").select("*").single())).toMatchObject({
      effort_total_minutes: 360,
      provenance: { effort_total_minutes: "default" },
    });

    expect(await sizeWorkItem(deps(), registry, { id }, NOW)).toEqual({
      status: "applied",
      fields: ["effort_total_minutes", "session_minutes", "importance", "energy"],
    });
    const item = ok(await db.from("work_items").select("*").single());
    // The fake answers off the middle, so this is the AI's value and not the default.
    expect(item).toMatchObject({
      effort_total_minutes: 410,
      session_minutes: 45,
      importance: 3,
      energy: "deep",
      context: "desk",
    });
    expect(item.provenance).toMatchObject({
      effort_total_minutes: "ai",
      session_minutes: "ai",
      context: "module",
    });
    const mark = readMark(item.ai)!;
    expect(mark.kind).toBe("size");
    expect(mark.fields.effort_total_minutes.reason).toBe("benzer işlerin süresine göre");

    // The call saw the module's hints, bounds and meta.
    const [call] = await calls();
    expect(call).toMatchObject({ kind: "size", subject_id: id });

    // Asked once: the same item needs nothing more, also after a proposal that keeps the scope.
    expect(await sizeWorkItem(deps(), registry, { id }, NOW)).toEqual({ status: "not_needed" });
    const moved = await propose(
      db,
      mod,
      prep({ when: { due: "2026-11-21T10:00:00+03:00", hard: true } }),
    );
    expect(moved.changed).toEqual(["due_at"]);
    expect(await sizeWorkItem(deps(), registry, { id }, NOW)).toEqual({ status: "not_needed" });
    expect(await calls()).toHaveLength(1);
  });

  it("a user's correction is kept through later proposals and calls", async () => {
    const mod = await makeModule(db);
    const { id } = await propose(db, mod, prep());
    await sizeWorkItem(deps(), registry, { id }, NOW);

    await updateWorkItem(db, id, { effort_total_minutes: 200 });
    expect(await feedback()).toMatchObject([
      {
        kind: "size",
        ai_value: { effort_total_minutes: 410 },
        user_value: { effort_total_minutes: 200 },
      },
    ]);

    // The module re-proposes with a new scope; the AI asks again only for its own values.
    const again = await propose(db, mod, prep({ meta: { scope: "Hafta 1–8" } }));
    expect(again.changed).toContain("meta");
    expect(await sizeWorkItem(deps(), registry, { id }, NOW)).toEqual({
      status: "applied",
      fields: ["session_minutes", "importance", "energy"],
    });
    const item = ok(await db.from("work_items").select("*").single());
    expect(item.effort_total_minutes).toBe(200);
    expect(item.provenance).toMatchObject({ effort_total_minutes: "user" });
    expect(readMark(item.ai)!.user_edited).toEqual(["effort_total_minutes"]);
  });

  it("without the AI, the default stays: the middle of the bounds", async () => {
    const mod = await makeModule(db);
    const { id } = await propose(db, mod, prep());
    expect(await sizeWorkItem(deps(null), registry, { id }, NOW)).toEqual({
      status: "skipped",
      reason: "no_provider",
    });
    expect(ok(await db.from("work_items").select("*").single())).toMatchObject({
      effort_total_minutes: 360,
      ai: null,
    });
  });

  it("asks nothing when the module filled every field", async () => {
    const mod = await makeModule(db);
    const { id } = await propose(
      db,
      mod,
      prep({
        effort: { total_minutes: 240, session_minutes: 60 },
        importance: 4,
        fit: { energy: "deep" },
      }),
    );
    expect(await sizeWorkItem(deps(), registry, { id }, NOW)).toEqual({ status: "not_needed" });
    expect(await calls()).toEqual([]);
  });
});

describe("edges", () => {
  it("an edit made while the AI was sizing wins: the estimate is not written", async () => {
    const mod = await makeModule(db);
    const { id } = await propose(db, mod, prep());
    const inner = fakeProvider();
    const editing: AiProvider = {
      name: "fake",
      complete: async (request) => {
        await updateWorkItem(db, id, { effort_total_minutes: 150 });
        return inner.complete(request);
      },
    };
    expect(await sizeWorkItem(deps(editing), registry, { id }, NOW)).toEqual({ status: "gone" });
    const item = ok(await db.from("work_items").select("*").single());
    expect(item).toMatchObject({ effort_total_minutes: 150, ai: null });
    expect(item.provenance).toMatchObject({ effort_total_minutes: "user" });
  });

  it("a write that fails half way leaves the entry as it was and no half-made work", async () => {
    const mod = await makeModule(db);
    const entry = await addInboxEntry(db, "Sınama dönem projesi");
    const card = ok(
      await db
        .from("inbox_entries")
        .update({ status: "needs_confirm" })
        .eq("id", entry.id)
        .select()
        .single(),
    );
    const output = {
      title: "Dönem projesi",
      module: { value: "sinama", confidence: 0.9, reason: "" },
      target: { value: "work_item" as const, confidence: 0.9, reason: "" },
      est_minutes: { value: 240, confidence: 0.6, reason: "" },
      energy: { value: null, confidence: 0, reason: "" },
      context: { value: null, confidence: 0, reason: "" },
      importance: { value: null, confidence: 0, reason: "" },
      due: { value: null, confidence: 0, reason: "" },
      // A blank step title breaks the split's write after the item was written.
      steps: [
        { title: "Kapsam", minutes: 45 },
        { title: "   ", minutes: 45 },
      ],
    };
    await expect(
      applyEnrichment(db, {
        entry: card,
        output,
        parsed: { title: "Sınama dönem projesi", dueDay: null, minutes: null },
        callId: crypto.randomUUID(),
        model: "fake-fast",
        moduleId: mod.id,
        moduleSlug: "sinama",
        now: NOW,
      }),
    ).rejects.toThrow();
    expect(ok(await db.from("work_items").select("id"))).toEqual([]);
    expect(await entryOf(entry.id)).toMatchObject({ status: "needs_confirm", routed_at: null });
  });

  it("tells the listeners about every stored proposal", async () => {
    const mod = await makeModule(db);
    const heard: string[] = [];
    const stop = onProposal((result) => heard.push(`${result.target}:${result.created}`));
    await propose(db, mod, prep());
    await propose(db, mod, prep({ title: "Yeni ad" }));
    stop();
    await propose(db, mod, prep({ title: "Duyulmayan" }));
    expect(heard).toEqual(["work_item:true", "work_item:false"]);
  });

  it("enrich sees finished work that looks alike and the user's last corrections (rule 8)", async () => {
    const mod = await makeModule(db);
    const done = ok(
      await db
        .from("tasks")
        .insert({ module_id: mod.id, title: "Sunum provası", status: "done", est_minutes: 30 })
        .select()
        .single(),
    );
    ok(
      await db
        .from("sessions")
        .insert({
          task_id: done.id,
          module_id: mod.id,
          started_at: "2026-11-01T09:00:00Z",
          ended_at: "2026-11-01T09:50:00Z",
        })
        .select(),
    );
    ok(
      await db
        .from("ai_feedback")
        .insert({
          module_slug: "sinama",
          kind: "enrich",
          input_summary: "Okuma",
          ai_value: { est_minutes: 30 },
          user_value: { est_minutes: 60 },
        })
        .select(),
    );
    const seen: string[] = [];
    const inner = fakeProvider();
    const watching: AiProvider = {
      name: "fake",
      complete: (request) => {
        seen.push(request.user);
        return inner.complete(request);
      },
    };
    const entry = await addInboxEntry(db, "Sınama sunum slaytları");
    await enrichEntry(deps(watching), registry, entry.id, NOW);
    const input = JSON.parse(seen[0]);
    expect(input.similar).toEqual([{ title: "Sunum provası", module: "sinama", minutes: 50 }]);
    expect(input.corrections).toEqual([
      { module: "sinama", input: "Okuma", ai: { est_minutes: 30 }, user: { est_minutes: 60 } },
    ]);
    expect(input.modules).toEqual([{ slug: "sinama", name: "Sınama", area: null, intake: [] }]);
  });

  it("an edit that fails records no correction", async () => {
    await makeModule(db);
    const entry = await addInboxEntry(db, "Sınama sunum slaytları");
    const outcome = await enrichEntry(deps(), registry, entry.id, NOW);
    if (outcome.status !== "applied") throw new Error("not applied");
    // More than one sitting: the database refuses it.
    await expect(updateTask(db, outcome.id, { est_minutes: 200 })).rejects.toThrow();
    expect(await feedback()).toEqual([]);
  });

  it("a field the module set over the AI's value is not the AI's any more", async () => {
    const mod = await makeModule(db);
    const { id } = await propose(db, mod, prep());
    await sizeWorkItem(deps(), registry, { id }, NOW);
    // The module now knows the importance itself.
    await propose(db, mod, prep({ importance: 4 }));
    await updateWorkItem(db, id, { importance: 2 });
    expect(await feedback()).toEqual([]);
  });
});

describe("decompose", () => {
  it("suggests pieces that become work only when accepted", async () => {
    const mod = await makeModule(db);
    const parent = ok(
      await db
        .from("work_items")
        .insert({ module_id: mod.id, title: "Tez", effort_total_minutes: 600 })
        .select()
        .single(),
    );

    const outcome = await decomposeWorkItem(deps(), { id: parent.id }, NOW);
    expect(outcome).toMatchObject({ status: "proposed" });
    if (outcome.status !== "proposed") return;
    expect(outcome.ids).toHaveLength(3);

    const pieces = ok(
      await db.from("work_items").select("*").eq("parent_id", parent.id).order("created_at"),
    );
    const byId = new Map(pieces.map((piece) => [piece.id, piece]));
    const [scope, draft, review] = outcome.ids.map((id) => byId.get(id)!);
    expect(pieces.every((piece) => piece.status === "proposed")).toBe(true);
    expect(draft.depends_on).toEqual([scope.id]);
    expect(review.depends_on).toEqual([draft.id]);

    // Asked again while the suggestion waits: the same pieces, no new call.
    const again = await decomposeWorkItem(deps(), { id: parent.id }, NOW);
    expect(again).toMatchObject({ status: "proposed", ids: expect.arrayContaining(outcome.ids) });
    expect(await calls()).toHaveLength(1);

    const today = async () => {
      const workItems = ok(await db.from("work_items").select("*"));
      return todayCandidates({
        tasks: [],
        workItems,
        rhythms: [],
        rhythmLogs: [],
        activeModuleIds: new Set([mod.id]),
        now: NOW,
      }).map((candidate) => candidate.title);
    };
    expect(await today()).toEqual(["Tez"]);
    await acceptSplit(db, parent.id);
    // Only the first piece: the others wait for it.
    expect(await today()).toEqual(["Kapsamı çıkar"]);
  });

  it("a declined suggestion is dropped, not deleted", async () => {
    const mod = await makeModule(db);
    const parent = ok(
      await db.from("work_items").insert({ module_id: mod.id, title: "Tez" }).select().single(),
    );
    await decomposeWorkItem(deps(), { id: parent.id }, NOW);
    await declineSplit(db, parent.id);
    const statuses = ok(await db.from("work_items").select("status").eq("parent_id", parent.id));
    expect(statuses.map((row) => row.status)).toEqual(["dropped", "dropped", "dropped"]);
  });
});

describe("extract", () => {
  it("runs a module's extractor and hands back its suggestions, writing nothing", async () => {
    await makeModule(db);
    const provider = fakeProvider({
      extract: () => ({ suggestions: [{ title: "Ara sınav", day: "2026-11-20" }], note: null }),
    });
    const outcome = await runExtract(
      deps(provider),
      registry,
      { module: "sinama", extractor: "duyuru", text: "Ara sınav 20 Kasım'da." },
      NOW,
    );
    expect(outcome).toMatchObject({
      status: "ok",
      suggestions: [{ title: "Ara sınav", day: "2026-11-20" }],
    });
    expect(await calls()).toMatchObject([{ kind: "extract", ok: true, subject_type: "module" }]);
    expect(ok(await db.from("work_items").select("id"))).toEqual([]);
  });

  it("refuses an unknown extractor and a module that is not active", async () => {
    const mod = await makeModule(db);
    const request = { module: "sinama", extractor: "yok", text: "metin" };
    expect(await runExtract(deps(), registry, request, NOW)).toEqual({ status: "unknown" });
    ok(await db.from("modules").update({ status: "paused" }).eq("id", mod.id).select());
    expect(await runExtract(deps(), registry, { ...request, extractor: "duyuru" }, NOW)).toEqual({
      status: "unknown",
    });
    expect(await calls()).toEqual([]);
  });

  it("gives no suggestions at all when one of them does not fit the extractor's item", async () => {
    await makeModule(db);
    const provider = fakeProvider({ extract: () => ({ suggestions: [{ title: 1 }], note: null }) });
    expect(
      await runExtract(
        deps(provider),
        registry,
        { module: "sinama", extractor: "duyuru", text: "metin" },
        NOW,
      ),
    ).toMatchObject({ status: "failed", reason: "invalid_output" });
  });
});

describe("settings and usage", () => {
  it("saves the switch and the limit (creating the row), and the status follows them", async () => {
    await saveAiSettings(db, { budgetUsd: 2.5 });
    expect(ok(await db.from("settings").select("*").single())).toMatchObject({
      ai_enabled: true,
      ai_monthly_budget_usd: 2.5,
    });
    expect((await aiStatus(deps(), NOW)).state).toBe("on");
    await saveAiSettings(db, { enabled: false });
    expect(ok(await db.from("settings").select("*"))).toHaveLength(1);
    expect(await aiStatus(deps(), NOW)).toMatchObject({ state: "disabled", budgetUsd: 2.5 });
    expect((await aiStatus(deps(null), NOW)).state).toBe("no_provider");
  });

  it("sums this month's calls by kind and model", async () => {
    await makeModule(db);
    const entry = await addInboxEntry(db, "Sınama sunum");
    await enrichEntry(deps(), registry, entry.id, new Date());
    const failing = await addInboxEntry(db, "Sınama [ai:invalid]");
    await enrichEntry(deps(), registry, failing.id, new Date());
    const usage = await usageThisMonth(db, new Date());
    expect(usage).toMatchObject([{ kind: "enrich", model: "fake-fast", calls: 2, failed: 1 }]);
    expect(usage[0].costUsd).toBeGreaterThan(0);
  });

  it("the fake reads a pasted list with a module's extractor, line by line", async () => {
    await makeModule(db);
    const withReader: ModuleRegistry = {
      list: [],
      get: (slug) =>
        slug === "sinama"
          ? ({ ...sinama, extractors: [kayitReader] } as ModuleDefinition)
          : undefined,
    };
    const outcome = await runExtract(
      deps(),
      withReader,
      {
        module: "sinama",
        extractor: "kayitlar",
        text: "- Rapor taslağı cuma 45dk\n- Kitap iade et",
      },
      NOW,
    );
    expect(outcome).toMatchObject({
      status: "ok",
      suggestions: [
        { title: "Rapor taslağı", due_on: "2026-11-13", minutes: 45 },
        { title: "Kitap iade et", due_on: null, minutes: null },
      ],
    });
  });
});
