import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ProposalError } from "@/core/contract/envelope";
import { createRegistry } from "@/core/contract/registry";
import type { ModuleDefinition, Outcome, WorkProposal } from "@/core/contract/types";
import { createModuleContext } from "@/core/data/context";
import { activateModule, archiveModule } from "@/core/data/module-rows";
import { answerModulePrompt, closeWorkItem } from "@/core/data/outcome";
import { propose, withdraw } from "@/core/data/propose";
import { cancelBlock, restoreBlock } from "@/core/data/blocks";
import { emitEvent } from "@/core/events/bus";
import { endSession, getOpenSession, startSession } from "@/core/data/sessions";
import { logRhythm, updateRhythm, updateWorkItem } from "@/core/data/work";
import type { AppEvent } from "@/core/types";
import { adminDb, makeModule, ok, ownerDb, strangerDb, wipe } from "./helpers";

// The work envelope against the real database, signed in like the app: propose and withdraw,
// repeatability by key, field provenance, outcomes, events and questions.

const db = ownerDb();

beforeEach(wipe);
afterAll(wipe);

const SOURCE = { type: "sinama.kayit", id: "8f2c1d7e-3b4a-4c5d-9e6f-0a1b2c3d4e5f" };

/** A deadline proposal by default; a recurrence or fixed-time one carries only what it is given. */
function prep(overrides: Partial<WorkProposal> = {}): WorkProposal {
  const deadline = !overrides.when?.recurrence && !overrides.when?.fixed;
  return {
    schema: 1,
    key: "assessment:1:prep",
    source: SOURCE,
    title: "BBF301E Midterm hazırlığı",
    ...(deadline
      ? {
          when: { due: "2026-11-12T10:00:00+03:00", hard: true },
          effort: { bounds: { min: 120, max: 600 } },
          fit: { energy: "deep" as const, context: "desk" as const },
          importance: 4 as const,
          // Several keys on purpose: the database returns jsonb keys in its own order.
          meta: { course_code: "BBF301E", weight: 30, scope: "Hafta 1–6" },
        }
      : {}),
    ...overrides,
  };
}

const RECURRENCE = { recurrence: { count: 2, period: "week" as const } };
const FIXED = {
  fixed: { starts_at: "2099-11-12T10:00:00+03:00", ends_at: "2099-11-12T12:00:00+03:00" },
};

const items = async () => ok(await db.from("work_items").select("*").order("created_at"));

describe("propose", () => {
  it("creates a work item from a deadline proposal; an empty effort becomes the middle of the bounds", async () => {
    const mod = await makeModule(db);
    const result = await propose(db, mod, prep());
    expect(result).toMatchObject({ target: "work_item", created: true, kept: [] });

    const [item] = await items();
    expect(item).toMatchObject({
      id: result.id,
      module_id: mod.id,
      key: "assessment:1:prep",
      title: "BBF301E Midterm hazırlığı",
      status: "active",
      due_is_hard: true,
      effort_total_minutes: 360,
      session_minutes: null,
      importance: 4,
      energy: "deep",
      context: "desk",
      source_type: "sinama.kayit",
      source_id: SOURCE.id,
      meta: { course_code: "BBF301E", weight: 30, scope: "Hafta 1–6" },
    });
    expect(Date.parse(item.due_at!)).toBe(Date.parse("2026-11-12T10:00:00+03:00"));
    expect(item.provenance).toMatchObject({
      title: "module",
      due_at: "module",
      importance: "module",
      effort_total_minutes: "default",
    });
  });

  it("the same key proposed twice leaves one record", async () => {
    const mod = await makeModule(db);
    const first = await propose(db, mod, prep());
    const second = await propose(db, mod, prep());
    expect(second).toMatchObject({ id: first.id, created: false, changed: [], kept: [] });
    expect(await items()).toHaveLength(1);
    // Nothing changed, so nothing was written: the row was not touched a second time.
    const [untouched] = await items();
    expect(untouched.updated_at).toBe(untouched.created_at);
    // A source id in upper case is the same source.
    const upper = await propose(
      db,
      mod,
      prep({ source: { ...SOURCE, id: SOURCE.id.toUpperCase() } }),
    );
    expect(upper.changed).toEqual([]);

    // Even when both arrive at the same moment (two devices, a double tap).
    await wipe();
    const fresh = await makeModule(db);
    const results = await Promise.all([propose(db, fresh, prep()), propose(db, fresh, prep())]);
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    expect(await items()).toHaveLength(1);
  });

  it("updates the record when the source changes", async () => {
    const mod = await makeModule(db);
    await propose(db, mod, prep());
    const moved = await propose(
      db,
      mod,
      prep({ title: "BBF301E Midterm", when: { due: "2026-11-11T10:00:00+03:00", hard: true } }),
    );
    expect(moved.changed.sort()).toEqual(["due_at", "title"]);
    const [item] = await items();
    expect(item.title).toBe("BBF301E Midterm");
    expect(Date.parse(item.due_at!)).toBe(Date.parse("2026-11-11T10:00:00+03:00"));
  });

  it("does not overwrite a field the user changed", async () => {
    const mod = await makeModule(db);
    const { id } = await propose(db, mod, prep());

    // The user moves the deadline, lowers the importance and sets the effort by hand.
    await updateWorkItem(db, id, {
      due_at: "2026-11-14T10:00:00+03:00",
      importance: 2,
      effort_total_minutes: 200,
    });

    const again = await propose(
      db,
      mod,
      prep({
        title: "BBF301E Midterm",
        when: { due: "2026-11-11T10:00:00+03:00", hard: true },
        importance: 4,
        // Same bounds as before (Ç2 stores them): only the title is new to the record.
        effort: { total_minutes: 480, bounds: { min: 120, max: 600 } },
      }),
    );
    expect(again.created).toBe(false);
    expect(again.changed).toEqual(["title"]);
    expect(again.kept.sort()).toEqual(["due_at", "effort_total_minutes", "importance"]);

    const [item] = await items();
    expect(item.title).toBe("BBF301E Midterm");
    expect(item.importance).toBe(2);
    expect(item.effort_total_minutes).toBe(200);
    expect(Date.parse(item.due_at!)).toBe(Date.parse("2026-11-14T10:00:00+03:00"));
    expect(item.provenance).toMatchObject({
      due_at: "user",
      importance: "user",
      effort_total_minutes: "user",
      title: "module",
    });
    expect(await items()).toHaveLength(1);
  });

  it("keeps an estimate that replaced the default when the proposal comes again", async () => {
    const mod = await makeModule(db);
    const { id } = await propose(db, mod, prep());
    // What the AI will do in Ç2: write its own estimate and mark it.
    ok(
      await adminDb()
        .from("work_items")
        .update({
          effort_total_minutes: 240,
          provenance: { ...((await items())[0].provenance as object), effort_total_minutes: "ai" },
        })
        .eq("id", id)
        .select("id")
        .single(),
    );
    await propose(db, mod, prep());
    const [item] = await items();
    expect(item.effort_total_minutes).toBe(240);
    expect(item.provenance).toMatchObject({ effort_total_minutes: "ai" });
  });

  it("writes a recurrence as a rhythm and a fixed time as a block, each once per key", async () => {
    const mod = await makeModule(db);
    const rhythm = prep({
      key: "rutin",
      title: "Sabah rutini",
      when: { recurrence: { count: 7, period: "week", floor: 3 } },
      effort: { session_minutes: 20 },
      fit: { energy: "physical", context: "home" },
    });
    const block = prep({
      key: "sinav:1",
      title: "BBF301E Midterm",
      when: {
        fixed: {
          starts_at: "2026-11-12T10:00:00+03:00",
          ends_at: "2026-11-12T12:00:00+03:00",
          location: "A101",
        },
      },
    });

    for (let round = 0; round < 2; round++) {
      expect((await propose(db, mod, rhythm)).target).toBe("rhythm");
      expect((await propose(db, mod, block)).target).toBe("block");
    }

    const rhythms = ok(await db.from("rhythms").select("*"));
    expect(rhythms).toHaveLength(1);
    expect(rhythms[0]).toMatchObject({
      key: "rutin",
      title: "Sabah rutini",
      target_count: 7,
      period: "week",
      floor_count: 3,
      est_minutes: 20,
      energy: "physical",
      context: "home",
      active: true,
    });
    const blocks = ok(await db.from("blocks").select("*"));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      key: "sinav:1",
      module_id: mod.id,
      title: "BBF301E Midterm",
      location: "A101",
      status: "planned",
      series_id: null,
    });
    expect(await items()).toHaveLength(0);
  });

  it("does not move a block the user moved by hand", async () => {
    const mod = await makeModule(db);
    const fixed = {
      starts_at: "2026-11-12T10:00:00+03:00",
      ends_at: "2026-11-12T12:00:00+03:00",
    };
    const proposal = prep({ key: "sinav:1", when: { fixed } });
    const { id } = await propose(db, mod, proposal);
    ok(
      await db
        .from("blocks")
        .update({
          starts_at: "2026-11-12T14:00:00+03:00",
          ends_at: "2026-11-12T16:00:00+03:00",
          provenance: { starts_at: "user", ends_at: "user" },
        })
        .eq("id", id)
        .select("id")
        .single(),
    );
    const again = await propose(db, mod, { ...proposal, title: "Yeni ad" });
    expect(again.kept.sort()).toEqual(["ends_at", "starts_at"]);
    const moved = ok(await db.from("blocks").select("*").eq("id", id).single());
    expect(Date.parse(moved.starts_at)).toBe(Date.parse("2026-11-12T14:00:00+03:00"));
    expect(moved.title).toBe("Yeni ad");
  });

  it("refuses an invalid envelope and writes nothing", async () => {
    const mod = await makeModule(db);
    await expect(propose(db, mod, { ...prep(), title: "" })).rejects.toBeInstanceOf(ProposalError);
    await expect(
      propose(db, mod, { ...prep(), effort: { session_minutes: 120 } }),
    ).rejects.toBeInstanceOf(ProposalError);
    expect(await items()).toHaveLength(0);
  });

  it("refuses to turn a key into another kind of record", async () => {
    const mod = await makeModule(db);
    await propose(db, mod, prep());
    await expect(
      propose(db, mod, prep({ when: { recurrence: { count: 1, period: "week" } } })),
    ).rejects.toThrow(/already belongs/);
    expect(ok(await db.from("rhythms").select("id"))).toHaveLength(0);
  });

  it("keeps keys apart per module and per account", async () => {
    const first = await makeModule(db);
    const second = await makeModule(db, "diger", "Diğer");
    await propose(db, first, prep());
    await propose(db, second, prep());
    expect(await items()).toHaveLength(2);

    const theirs = await makeModule(strangerDb());
    await propose(strangerDb(), theirs, prep());
    expect(await items()).toHaveLength(2);
    // A module row of another account cannot be proposed into.
    await expect(propose(strangerDb(), first, prep({ key: "x" }))).rejects.toThrow();
  });

  it("resolves dependencies by key, whichever side is proposed first", async () => {
    const mod = await makeModule(db);
    const practice = await propose(
      db,
      mod,
      prep({ key: "b", title: "Soru çöz", depends_on: ["a", "c"] }),
    );
    let item = ok(await db.from("work_items").select("*").eq("id", practice.id).single());
    expect(item.depends_on_keys).toEqual(["a", "c"]);
    expect(item.depends_on).toEqual([]);

    const study = await propose(db, mod, prep({ key: "a", title: "Konu çalış" }));
    item = ok(await db.from("work_items").select("*").eq("id", practice.id).single());
    expect(item.depends_on).toEqual([study.id]);

    // The other way round: the dependency exists before the dependent is proposed.
    const review = await propose(db, mod, prep({ key: "d", title: "Tekrar", depends_on: ["a"] }));
    item = ok(await db.from("work_items").select("*").eq("id", review.id).single());
    expect(item.depends_on).toEqual([study.id]);
  });
});

describe("withdraw", () => {
  it("drops the work item and its open sittings; nothing is deleted", async () => {
    const mod = await makeModule(db);
    const { id } = await propose(db, mod, prep());
    const session = await startSession(db, { workItemId: id });
    await endSession(db, session.id, "stopped");

    await withdraw(db, mod, "assessment:1:prep");
    const [item] = await items();
    expect(item.status).toBe("dropped");
    const tasks = ok(await db.from("tasks").select("status"));
    expect(tasks.map((task) => task.status)).toEqual(["dropped"]);
    expect(ok(await db.from("sessions").select("id"))).toHaveLength(1);

    // Withdrawing something unknown, or twice, is not an error.
    await withdraw(db, mod, "assessment:1:prep");
    await withdraw(db, mod, "no-such-key");
  });

  it("a withdrawn proposal comes back when proposed again, with the same record", async () => {
    const mod = await makeModule(db);
    const first = await propose(db, mod, prep());
    await withdraw(db, mod, "assessment:1:prep");
    const again = await propose(db, mod, prep());
    expect(again).toMatchObject({ id: first.id, created: false, changed: ["status"] });
    expect((await items()).map((item) => item.status)).toEqual(["active"]);
  });

  it("quiets a rhythm and cancels a block", async () => {
    const mod = await makeModule(db);
    await propose(db, mod, prep({ key: "r", when: RECURRENCE }));
    await propose(db, mod, prep({ key: "b", when: FIXED }));
    await withdraw(db, mod, "r");
    await withdraw(db, mod, "b");
    expect(ok(await db.from("rhythms").select("active").single()).active).toBe(false);
    expect(ok(await db.from("blocks").select("status").single()).status).toBe("cancelled");
  });

  it("brings back a withdrawn rhythm and block too, and only what the module itself withdrew", async () => {
    const mod = await makeModule(db);
    const registry = createRegistry([]);
    const rhythm = prep({ key: "r", when: RECURRENCE });
    const block = prep({ key: "b", when: FIXED });
    const first = { r: await propose(db, mod, rhythm), b: await propose(db, mod, block) };

    await withdraw(db, mod, "r");
    await withdraw(db, mod, "b");
    expect(await propose(db, mod, rhythm)).toMatchObject({ id: first.r.id, changed: ["active"] });
    expect(await propose(db, mod, block)).toMatchObject({ id: first.b.id, changed: ["status"] });
    expect(ok(await db.from("rhythms").select("active").single()).active).toBe(true);
    expect(ok(await db.from("blocks").select("status").single()).status).toBe("planned");

    // What the user closed stays closed, whatever the module proposes afterwards.
    await updateRhythm(db, first.r.id, { active: false });
    await cancelBlock(db, first.b.id);
    const item = await propose(db, mod, prep());
    await closeWorkItem(db, registry, item.id, "dropped");

    expect((await propose(db, mod, rhythm)).changed).toEqual([]);
    expect((await propose(db, mod, block)).changed).toEqual([]);
    expect((await propose(db, mod, prep())).changed).toEqual([]);
    expect(ok(await db.from("rhythms").select("active").single()).active).toBe(false);
    expect(ok(await db.from("blocks").select("status").single()).status).toBe("cancelled");
    expect((await items())[0].status).toBe("dropped");
  });

  it("still comes back after the user has touched the status in between", async () => {
    const mod = await makeModule(db);
    const { id } = await propose(db, mod, prep());
    // The user parks the item and takes it up again: the status field is now the user's.
    await updateWorkItem(db, id, { status: "waiting" });
    await updateWorkItem(db, id, { status: "active" });

    await withdraw(db, mod, "assessment:1:prep");
    expect((await items())[0].status).toBe("dropped");
    const again = await propose(db, mod, prep());
    expect(again).toMatchObject({ id, changed: ["status"] });
    expect((await items())[0].status).toBe("active");

    // The same for a block the user cancelled and restored before the module withdrew it.
    const block = await propose(db, mod, prep({ key: "b", when: FIXED }));
    await cancelBlock(db, block.id);
    await restoreBlock(db, block.id);
    await withdraw(db, mod, "b");
    expect((await propose(db, mod, prep({ key: "b", when: FIXED }))).changed).toEqual(["status"]);
  });

  it("stops a session that is running on the withdrawn item", async () => {
    const mod = await makeModule(db);
    const { id } = await propose(db, mod, prep());
    const session = await startSession(db, { workItemId: id });
    await withdraw(db, mod, "assessment:1:prep");
    expect(await getOpenSession(db)).toBeNull();
    expect(
      ok(await db.from("sessions").select("ended_at").eq("id", session.id).single()).ended_at,
    ).not.toBeNull();
    expect(ok(await db.from("tasks").select("status")).map((task) => task.status)).toEqual([
      "dropped",
    ]);
  });

  it("leaves finished work finished", async () => {
    const mod = await makeModule(db);
    const { id } = await propose(db, mod, prep());
    await closeWorkItem(db, createRegistry([]), id, "done");
    await withdraw(db, mod, "assessment:1:prep");
    expect((await items()).map((item) => item.status)).toEqual(["done"]);
  });
});

// A module definition that records what the core tells it.
function recordingModule() {
  const outcomes: Outcome[] = [];
  const heard: AppEvent[] = [];
  const activated: string[] = [];
  const archived: string[] = [];
  const view = () => null;
  const definition: ModuleDefinition = {
    slug: "sinama",
    name: "Sınama",
    kind: "lifelong",
    color: "#2563eb",
    area: { slug: "saglik", name: "Sağlık" },
    chip: async () => ({ text: "", health: "ok" }),
    intake: [],
    emits: ["sinama.bir_sey_oldu", "sinama.patlar"],
    on: {
      "sinama.bir_sey_oldu": async (event) => {
        heard.push(event);
      },
      "core.prompt_answered": async (event) => {
        heard.push(event);
      },
      "sinama.patlar": async () => {
        throw new Error("listener failed");
      },
    },
    modeBehavior: {
      normal: { weightMultiplier: 1, floorMultiplier: 1 },
      busy: { weightMultiplier: 0.5, floorMultiplier: 0.5 },
      minimum: { weightMultiplier: 0.2, floorMultiplier: 0 },
      holiday: { weightMultiplier: 0, floorMultiplier: 0 },
    },
    weeklyReport: async () => ({ metrics: [], suggestions: [] }),
    onActivate: async (ctx) => {
      activated.push(ctx.module.slug);
    },
    onArchive: async (ctx) => {
      archived.push(ctx.module.status);
    },
    onOutcome: async (outcome) => {
      outcomes.push(outcome);
    },
    ui: { tabs: [{ key: "genel", label: "Genel", component: view }] },
  };
  return { definition, outcomes, heard, activated, archived };
}

describe("what the core tells a module", () => {
  it("activates a module from its definition, once", async () => {
    const recorder = recordingModule();
    const registry = createRegistry([recorder.definition]);
    const row = await activateModule(db, registry, recorder.definition);
    expect(row).toMatchObject({
      slug: "sinama",
      name: "Sınama",
      kind: "lifelong",
      status: "active",
      color: "#2563eb",
    });
    expect(row.mode_behavior).toMatchObject({ busy: { weightMultiplier: 0.5 } });
    expect(ok(await db.from("areas").select("slug")).map((area) => area.slug)).toEqual(["saglik"]);
    expect(row.area_id).not.toBeNull();

    await activateModule(db, registry, recorder.definition);
    expect(ok(await db.from("modules").select("id"))).toHaveLength(1);
    expect(recorder.activated).toEqual(["sinama"]);
  });

  it("tells the module what a finished item cost", async () => {
    const recorder = recordingModule();
    const registry = createRegistry([recorder.definition]);
    const mod = await activateModule(db, registry, recorder.definition);
    const { id } = await propose(db, mod, prep());

    for (const minutes of [40, 25]) {
      const session = await startSession(db, { workItemId: id });
      ok(
        await adminDb()
          .from("sessions")
          .update({ started_at: new Date(Date.now() - minutes * 60_000).toISOString() })
          .eq("id", session.id)
          .select("id")
          .single(),
      );
      await endSession(db, session.id, "stopped");
    }

    const closed = await closeWorkItem(db, registry, id, "done");
    expect(closed.status).toBe("done");
    expect(recorder.outcomes).toEqual([
      {
        key: "assessment:1:prep",
        source: SOURCE,
        result: "done",
        estimatedMinutes: 360,
        spentMinutes: 65,
        sessionCount: 2,
        postponedCount: 0,
      },
    ]);
    expect(
      ok(await db.from("tasks").select("status").eq("work_item_id", id)).map((task) => task.status),
    ).toEqual(["done"]);

    // A clock that is still running on the item when it is closed is stopped and counted.
    const late = await propose(db, mod, prep({ key: "gec", title: "Geç" }));
    const running = await startSession(db, { workItemId: late.id });
    ok(
      await adminDb()
        .from("sessions")
        .update({ started_at: new Date(Date.now() - 30 * 60_000).toISOString() })
        .eq("id", running.id)
        .select("id")
        .single(),
    );
    await closeWorkItem(db, registry, late.id, "dropped");
    expect(await getOpenSession(db)).toBeNull();
    expect(recorder.outcomes[1]).toMatchObject({
      key: "gec",
      result: "dropped",
      spentMinutes: 30,
      sessionCount: 1,
    });
    recorder.outcomes.pop();

    // Closing again reports nothing new, and a later proposal does not reopen it.
    await closeWorkItem(db, registry, id, "dropped");
    expect(recorder.outcomes).toHaveLength(1);
    await propose(db, mod, prep());
    expect((await items())[0].status).toBe("done");
  });

  it("closes the item even when the module cannot take the news", async () => {
    const recorder = recordingModule();
    const failing: ModuleDefinition = {
      ...recorder.definition,
      onOutcome: async () => {
        throw new Error("module is broken");
      },
    };
    const registry = createRegistry([failing]);
    const mod = await activateModule(db, registry, failing);
    const { id } = await propose(db, mod, prep());
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errors.push(args);
    try {
      expect((await closeWorkItem(db, registry, id, "done")).status).toBe("done");
    } finally {
      console.error = original;
    }
    expect(errors).toHaveLength(1);
  });

  it("does not report on items the user made by hand", async () => {
    const recorder = recordingModule();
    const registry = createRegistry([recorder.definition]);
    const mod = await activateModule(db, registry, recorder.definition);
    const item = ok(
      await db.from("work_items").insert({ module_id: mod.id, title: "Elle" }).select().single(),
    );
    await closeWorkItem(db, registry, item.id, "dropped");
    expect(recorder.outcomes).toEqual([]);
  });

  it("delivers a module's event to the modules that listen, and records it", async () => {
    const recorder = recordingModule();
    const registry = createRegistry([recorder.definition]);
    const mod = await activateModule(db, registry, recorder.definition);
    const ctx = createModuleContext({ db, registry, module: mod });

    await ctx.emit("sinama.bir_sey_oldu", { id: 7 });
    expect(recorder.heard.map((event) => [event.type, event.module_slug, event.payload])).toEqual([
      ["sinama.bir_sey_oldu", "sinama", { id: 7 }],
    ]);
    expect(ok(await db.from("events").select("type")).map((event) => event.type)).toEqual([
      "sinama.bir_sey_oldu",
    ]);

    // Only declared events may be published.
    await expect(ctx.emit("sinama.bildirilmemis")).rejects.toThrow(/does not declare/);
    await expect(ctx.emit("baska.olay")).rejects.toThrow(/does not declare/);
  });

  it("a listener that fails stops neither the other listeners nor the publisher", async () => {
    const recorder = recordingModule();
    const heardBySecond: string[] = [];
    const second: ModuleDefinition = {
      ...recordingModule().definition,
      slug: "ikinci",
      name: "İkinci",
      emits: [],
      area: undefined,
      on: {
        "sinama.patlar": async (event) => {
          heardBySecond.push(event.type);
        },
      },
    };
    // The failing listener is registered first, so it runs first.
    const registry = createRegistry([recorder.definition, second]);
    const mod = await activateModule(db, registry, recorder.definition);
    await activateModule(db, registry, second);

    const result = await emitEvent({ db, registry, type: "sinama.patlar", moduleSlug: "sinama" });
    expect(result.failures.map((failure) => failure.module)).toEqual(["sinama"]);
    expect(String(result.failures[0].error)).toContain("listener failed");
    expect(heardBySecond).toEqual(["sinama.patlar"]);

    // Through the module's own context the publisher is not disturbed either.
    await createModuleContext({ db, registry, module: mod }).emit("sinama.patlar");
    expect(heardBySecond).toHaveLength(2);
    expect(ok(await db.from("events").select("id"))).toHaveLength(2);
  });

  it("does not deliver events to a module that is paused or archived", async () => {
    const recorder = recordingModule();
    const registry = createRegistry([recorder.definition]);
    const mod = await activateModule(db, registry, recorder.definition);
    const ctx = createModuleContext({ db, registry, module: mod });

    ok(await db.from("modules").update({ status: "paused" }).eq("id", mod.id).select().single());
    await ctx.emit("sinama.bir_sey_oldu");
    expect(recorder.heard).toEqual([]);

    const archived = await archiveModule(db, registry, mod);
    expect(archived.status).toBe("archived");
    expect(recorder.archived).toEqual(["archived"]);
    await ctx.emit("sinama.bir_sey_oldu");
    expect(recorder.heard).toEqual([]);
    // The events themselves are still recorded.
    expect(ok(await db.from("events").select("id"))).toHaveLength(2);
  });

  it("archiving drops proposed work with the module's mark; proposing again brings it back", async () => {
    const recorder = recordingModule();
    const registry = createRegistry([recorder.definition]);
    const mod = await activateModule(db, registry, recorder.definition);

    const item = await propose(db, mod, prep());
    const rhythm = await propose(
      db,
      mod,
      prep({ key: "rhythm:1", when: { recurrence: { count: 2, period: "week" } } }),
    );
    const block = await propose(
      db,
      mod,
      prep({
        key: "exam:1",
        when: {
          fixed: { starts_at: "2099-03-01T10:00:00+03:00", ends_at: "2099-03-01T12:00:00+03:00" },
        },
      }),
    );
    // Work the user added by hand, and an item the user closed before the module was archived.
    const byHand = ok(
      await db
        .from("work_items")
        .insert({ module_id: mod.id, title: "Elle eklenen" })
        .select()
        .single(),
    );
    const closedByUser = await propose(db, mod, prep({ key: "assessment:2:prep" }));
    await closeWorkItem(db, registry, closedByUser.id, "dropped");

    const archived = await archiveModule(db, registry, mod);
    const state = async () => ({
      item: ok(await db.from("work_items").select("status").eq("id", item.id).single()).status,
      rhythm: ok(await db.from("rhythms").select("active").eq("id", rhythm.id).single()).active,
      block: ok(await db.from("blocks").select("status").eq("id", block.id).single()).status,
      byHand: ok(await db.from("work_items").select("status").eq("id", byHand.id).single()).status,
      closedByUser: ok(
        await db.from("work_items").select("status").eq("id", closedByUser.id).single(),
      ).status,
    });
    expect(await state()).toEqual({
      item: "dropped",
      rhythm: false,
      block: "cancelled",
      byHand: "dropped",
      closedByUser: "dropped",
    });

    // Switched on again, the module proposes its open records again.
    await activateModule(db, registry, recorder.definition);
    expect(archived.id).toBe(mod.id);
    const again = await propose(db, mod, prep());
    expect(again).toMatchObject({ id: item.id, created: false });
    await propose(
      db,
      mod,
      prep({ key: "rhythm:1", when: { recurrence: { count: 2, period: "week" } } }),
    );
    await propose(
      db,
      mod,
      prep({
        key: "exam:1",
        when: {
          fixed: { starts_at: "2099-03-01T10:00:00+03:00", ends_at: "2099-03-01T12:00:00+03:00" },
        },
      }),
    );
    await propose(db, mod, prep({ key: "assessment:2:prep" }));
    expect(await state()).toEqual({
      item: "active",
      rhythm: true,
      block: "planned",
      // No key, so nothing proposes it again; and what the user closed stays closed.
      byHand: "dropped",
      closedByUser: "dropped",
    });
    const restored = ok(
      await db.from("work_items").select("provenance").eq("id", item.id).single(),
    );
    expect(restored.provenance).not.toHaveProperty("status");
  });

  it("asks one question and tells the module the answer", async () => {
    const recorder = recordingModule();
    const registry = createRegistry([recorder.definition]);
    const mod = await activateModule(db, registry, recorder.definition);
    const ctx = createModuleContext({ db, registry, module: mod });

    await ctx.ask({
      kind: "attendance",
      question: "Derse girdin mi?",
      options: [
        { value: "yes", label: "Girdim" },
        { value: "no", label: "Girmedim" },
      ],
      subject: SOURCE,
    });
    const prompt = ok(await db.from("prompts").select("*").single());
    expect(prompt).toMatchObject({ kind: "attendance", status: "pending", subject_id: SOURCE.id });

    await answerModulePrompt(db, registry, prompt, "yes");
    // Answered again from the other screen: nothing changes and the module is not told twice.
    await answerModulePrompt(db, registry, prompt, "no");
    const answered = ok(await db.from("prompts").select("*").single());
    expect(answered).toMatchObject({ status: "answered", answer: { value: "yes" } });
    expect(recorder.heard.map((event) => [event.type, event.payload])).toEqual([
      [
        "core.prompt_answered",
        {
          module: "sinama",
          kind: "attendance",
          subject_type: SOURCE.type,
          subject_id: SOURCE.id,
          value: "yes",
        },
      ],
    ]);
  });

  it("gives the module its own work to read, and nobody else's", async () => {
    const recorder = recordingModule();
    const registry = createRegistry([recorder.definition]);
    const mod = await activateModule(db, registry, recorder.definition);
    const other = await makeModule(db, "diger", "Diğer");
    const ctx = createModuleContext({ db, registry, module: mod });

    await ctx.propose(prep());
    const rhythm = await ctx.propose(prep({ key: "r", when: RECURRENCE }));
    await propose(db, other, prep({ key: "baska" }));
    ok(await db.from("tasks").insert({ module_id: other.id, title: "Başka" }).select().single());

    expect((await ctx.work.items()).map((item) => item.key)).toEqual(["assessment:1:prep"]);
    expect(await ctx.work.tasks()).toEqual([]);
    const [progress] = await ctx.work.rhythms();
    expect(progress).toMatchObject({ done: 0, target: 2, debt: 2 });

    await logRhythm(db, rhythm.id, new Date());
    const foreign = ok(
      await db
        .from("rhythms")
        .insert({ module_id: other.id, title: "Başka", target_count: 1, period: "week" })
        .select()
        .single(),
    );
    await logRhythm(db, foreign.id, new Date());
    expect((await ctx.work.rhythms())[0]).toMatchObject({ done: 1, debt: 1 });
    const logs = await ctx.work.rhythmLogs("2000-01-01");
    expect(logs.map((log) => log.rhythm_id)).toEqual([rhythm.id]);
    expect(await ctx.work.rhythmLogs("2999-01-01")).toEqual([]);

    await ctx.saveSettings({ hedef: 3 });
    expect(
      ok(await db.from("modules").select("settings").eq("id", mod.id).single()).settings,
    ).toEqual({ hedef: 3 });
  });
});
