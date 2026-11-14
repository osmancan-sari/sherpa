import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRegistry } from "@/core/contract/registry";
import type { ModuleContext } from "@/core/contract/types";
import { createModuleContext } from "@/core/data/context";
import { endSessionTold, startSessionTold, tellStarted } from "@/core/data/session-events";
import type { AppEvent, ModuleRow } from "@/core/types";
import { loadPlanRows } from "@/core/data/keep";
import { buildPlan, planInput } from "@/core/planner";
import { istanbulInstant } from "@/lib/date";
import { rutin } from "@/modules/rutin/module";
import {
  ensureRun,
  getRun,
  listRoutines,
  listSteps,
  moveRun,
  saveRecords,
  updateStep,
} from "@/modules/rutin/queries";
import { closeRun, openRun, proposeAll, writeStartList } from "@/modules/rutin/rules";
import { makeModule, ok, ownerDb, strangerDb, wipe } from "./helpers";

// Rutin's data (docs/moduller/rutin.md, section 3 and "Adım 1 · Temel"): the starting list is
// written once and never over the user's list; the three rhythms are proposed from it; a run is
// opened and closed with its session, on the core's day (a bedtime after midnight is the night
// before: criterion 7); two screens moving the run at once move it once.

const db = ownerDb();
const phone = ownerDb();
const registry = createRegistry([rutin]);

beforeEach(wipe);
afterAll(wipe);

async function setup(now: () => Date = () => new Date()) {
  const row: ModuleRow = await makeModule(db, "rutin", "Rutin");
  const ctx = createModuleContext({ db, registry, module: row, now });
  const other = createModuleContext({ db: phone, registry, module: row, now });
  return { row, ctx, other };
}

const routineByKey = async (ctx: ModuleContext, key: string) =>
  (await listRoutines(ctx)).find((row) => row.key === key)!;

function event(type: string, payload: Record<string, unknown>): AppEvent {
  return {
    id: "e",
    user_id: "",
    type,
    module_slug: null,
    payload: payload as AppEvent["payload"],
    occurred_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("the starting list", () => {
  it("is written on the first switch-on: three routines and the steps of 8.1", async () => {
    const { ctx } = await setup();
    await rutin.onActivate!(ctx);
    const routines = await listRoutines(ctx);
    expect(routines.map((row) => [row.key, row.title, row.active]).sort()).toEqual([
      ["aksam", "Akşam kapanışı", true],
      ["hazirlik", "Duş ve hazırlık", true],
      ["sabah", "Sabah", true],
    ]);
    const steps = await listSteps(ctx);
    const of = (key: string) => {
      const id = routines.find((row) => row.key === key)!.id;
      return steps
        .filter((step) => step.routine_id === id && step.parent_id === null)
        .sort((a, b) => a.position - b.position)
        .map((step) => step.title);
    };
    expect(of("sabah")).toEqual(["Diş bakımı", "Bir bardak su"]);
    expect(of("hazirlik")).toEqual(["Duş", "SPF", "Giyin", "Yürüyüş"]);
    expect(of("aksam")).toEqual([
      "Antiperspirant",
      "Diş bakımı",
      "Yüz",
      "Yarının listesi",
      "Telefonu salona bırak",
    ]);
    // Add-ons hang on their step; only phase 1 is switched on.
    const shower = steps.find((step) => step.title === "Duş")!;
    const addOns = steps.filter((step) => step.parent_id === shower.id);
    expect(addOns.map((step) => [step.title, step.every_days, step.active])).toEqual([
      ["Dercos şampuan", 3, true],
      ["Nasır kremi", 2, false],
    ]);
    expect(steps.find((step) => step.title === "Yarının listesi")).toMatchObject({
      kind: "closing",
      active: false,
      minimum: true,
    });
    const teeth = steps.find((step) => step.ref === "S1")!;
    expect(teeth.parts).toEqual([
      { title: "Su jeti" },
      { title: "Fırçala", seconds: 120, timer: true, hold: true },
      { title: "Dil", seconds: 25, timer: false, hold: false },
      { title: "Tükür", note: "Suyla çalkala." },
    ]);
  });

  it("is never written over the user's list (switched on again, or by two screens at once)", async () => {
    const { ctx, other } = await setup();
    await Promise.all([writeStartList(ctx), writeStartList(other)]);
    const steps = await listSteps(ctx);
    expect(steps.length).toBe(14);
    expect(await listRoutines(ctx)).toHaveLength(3);

    const water = steps.find((step) => step.ref === "S2")!;
    await updateStep(ctx, water.id, { title: "İki bardak su", seconds: 120 });
    expect(await writeStartList(ctx)).toBe(false);
    await rutin.onActivate!(ctx);
    const again = await listSteps(ctx);
    expect(again).toHaveLength(14);
    expect(again.find((step) => step.id === water.id)).toMatchObject({
      title: "İki bardak su",
      seconds: 120,
    });
  });
});

describe("the three rhythms", () => {
  it("are proposed with their anchor, order, facet and the length of their open steps", async () => {
    const { ctx, row } = await setup();
    await rutin.onActivate!(ctx);
    const rhythms = ok(await db.from("rhythms").select("*").eq("module_id", row.id));
    const byKey = (key: string) => rhythms.find((rhythm) => rhythm.key === `rutin:${key}`)!;
    expect(byKey("sabah")).toMatchObject({
      title: "Sabah",
      target_count: 1,
      period: "day",
      floor_count: 1,
      energy: "light",
      context: "home",
      facet: "sabah",
      timing: { anchor: "wake", order: 10 },
      meta: { routine: "sabah" },
      // 3 + 1 minutes; the core takes 5 at least.
      est_minutes: 5,
      active: true,
    });
    expect(byKey("hazirlik")).toMatchObject({
      title: "Duş ve hazırlık",
      energy: "physical",
      facet: "sabah",
      timing: { anchor: "wake", order: 30 },
      // 10 + 3 + 15 + 12: add-ons are not counted.
      est_minutes: 40,
    });
    expect(byKey("aksam")).toMatchObject({
      title: "Akşam kapanışı",
      facet: "aksam",
      timing: { anchor: "bed", order: 10 },
      // 1 + 3 + 3 + 2: the closed "Yarının listesi" is not counted.
      est_minutes: 9,
    });
    expect(byKey("sabah").source_id).toBe((await routineByKey(ctx, "sabah")).id);
  });

  it("follow the list: a changed length is proposed again; a routine switched off is taken back", async () => {
    const { ctx, row } = await setup();
    await rutin.onActivate!(ctx);
    const walk = (await listSteps(ctx)).find((step) => step.ref === "S8")!;
    await updateStep(ctx, walk.id, { active: false });
    await proposeAll(ctx);
    const rhythm = async (key: string) =>
      ok(await db.from("rhythms").select("*").eq("module_id", row.id).eq("key", key).single());
    expect((await rhythm("rutin:hazirlik")).est_minutes).toBe(28);

    const evening = await routineByKey(ctx, "aksam");
    ok(await db.from("rutin_routines").update({ active: false }).eq("id", evening.id).select());
    await proposeAll(ctx);
    expect((await rhythm("rutin:aksam")).active).toBe(false);
    ok(await db.from("rutin_routines").update({ active: true }).eq("id", evening.id).select());
    await proposeAll(ctx);
    expect((await rhythm("rutin:aksam")).active).toBe(true);
  });
});

describe("a run", () => {
  it("opens when the routine's session starts and closes when it ends with Bitti", async () => {
    const { ctx, row } = await setup();
    await rutin.onActivate!(ctx);
    const rhythm = ok(
      await db
        .from("rhythms")
        .select("*")
        .eq("module_id", row.id)
        .eq("key", "rutin:sabah")
        .single(),
    );
    const told = { db, registry };
    const session = await startSessionTold(told, { rhythmId: rhythm.id });
    const morning = await routineByKey(ctx, "sabah");
    const runs = ok(await db.from("rutin_runs").select("*"));
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      routine_id: morning.id,
      session_id: session.id,
      step_position: 0,
      part_position: 0,
      finished_at: null,
    });

    // Stopped halfway: the run stays open and goes on where it stood.
    ok(await db.from("rutin_runs").update({ step_position: 1 }).eq("id", runs[0].id).select());
    await endSessionTold(told, session.id, "stopped");
    expect(ok(await db.from("rutin_runs").select("*").single()).finished_at).toBeNull();
    const again = await startSessionTold(told, { rhythmId: rhythm.id });
    expect(ok(await db.from("rutin_runs").select("*").single())).toMatchObject({
      session_id: again.id,
      step_position: 1,
    });
    const ended = await endSessionTold(told, again.id, "done");
    expect(ok(await db.from("rutin_runs").select("*").single()).finished_at).toBe(ended.ended_at);
  });

  it("started again after Bitti begins at its first step; its bedtime taken back goes on where it stood", async () => {
    const { ctx, row } = await setup();
    await rutin.onActivate!(ctx);
    const rhythm = ok(
      await db
        .from("rhythms")
        .select("*")
        .eq("module_id", row.id)
        .eq("key", "rutin:sabah")
        .single(),
    );
    const told = { db, registry };
    const first = await startSessionTold(told, { rhythmId: rhythm.id });
    const run = ok(await db.from("rutin_runs").select("*").single());
    const teeth = (await listSteps(ctx)).find((step) => step.ref === "S1")!;
    await saveRecords(ctx, [
      { run_id: run.id, step_id: teeth.id, result: "done", seconds: 170, bulk: false },
    ]);
    ok(
      await db
        .from("rutin_runs")
        .update({ step_position: 2, minimum_done: true })
        .eq("id", run.id)
        .select(),
    );
    const ended = await endSessionTold(told, first.id, "done");

    // The same session told as started again (its bedtime was taken back): reopened, in place.
    await openRun(
      ctx,
      event("core.session_started", {
        session_id: first.id,
        source: { type: "rutin.routine", id: rhythm.source_id },
        started_at: first.started_at,
        day: run.day,
      }),
    );
    expect(ok(await db.from("rutin_runs").select("*").single())).toMatchObject({
      session_id: first.id,
      step_position: 2,
      finished_at: null,
    });
    await closeRun(
      ctx,
      event("core.session_ended", {
        session_id: first.id,
        result: "done",
        ended_at: ended.ended_at,
      }),
    );

    // Started again later that day: a new pass from the first step, in the same row. What was
    // done that day stays done (a step passed again writes over its own record).
    const second = await startSessionTold(told, { rhythmId: rhythm.id });
    expect(ok(await db.from("rutin_runs").select("*"))).toMatchObject([
      {
        id: run.id,
        session_id: second.id,
        step_position: 0,
        part_position: 0,
        finished_at: null,
        minimum_done: true,
      },
    ]);
    expect(ok(await db.from("rutin_run_steps").select("*"))).toMatchObject([
      { step_id: teeth.id, result: "done" },
    ]);
  });

  it("belongs to the core's day: Yatıyorum after midnight closes the evening's run (criterion 7)", async () => {
    // Ç3g: the day comes with the core's `core.session_started` (its planning day of the start);
    // the module keeps no copy of the rule.
    const day = "2026-11-13";
    const { ctx, row } = await setup();
    await rutin.onActivate!(ctx);
    const told = { db, registry };
    const evening = await routineByKey(ctx, "aksam");
    const rhythm = ok(
      await db
        .from("rhythms")
        .select("*")
        .eq("module_id", row.id)
        .eq("key", "rutin:aksam")
        .single(),
    );
    const late = (time: string, date = "2026-11-14") => istanbulInstant(date, time).toISOString();

    // A start told without a session or without the core's day opens nothing.
    await openRun(
      ctx,
      event("core.session_started", {
        session_id: null,
        source: { type: "rutin.routine", id: evening.id },
        started_at: late("23:50", day),
        day,
      }),
    );
    await openRun(
      ctx,
      event("core.session_started", {
        session_id: "00000000-0000-0000-0000-000000000000",
        source: { type: "rutin.routine", id: evening.id },
        started_at: late("23:50", day),
      }),
    );
    expect(await getRun(ctx, evening.id, day)).toBeNull();

    // Started at 23:50, "Yatıyorum" at 00:10: the core tells the start with its day.
    const session = ok(
      await db
        .from("sessions")
        .insert({ rhythm_id: rhythm.id, module_id: row.id, started_at: late("23:50", day) })
        .select()
        .single(),
    );
    await tellStarted(told, session);
    const [started] = ok(
      await db.from("events").select("payload").eq("type", "core.session_started"),
    );
    expect(started.payload).toMatchObject({ session_id: session.id, day });
    ok(
      await db
        .from("sessions")
        .update({ ended_at: late("00:10") })
        .eq("id", session.id)
        .select(),
    );
    await closeRun(
      ctx,
      event("core.session_ended", {
        session_id: session.id,
        result: "done",
        ended_at: late("00:10"),
      }),
    );
    const closed = await getRun(ctx, evening.id, day);
    expect(Date.parse(closed!.finished_at!)).toBe(Date.parse(late("00:10")));
    expect(await getRun(ctx, evening.id, "2026-11-14")).toBeNull();

    // Started after midnight too (00:20): still the night before.
    const second = ok(
      await db
        .from("sessions")
        .insert({
          rhythm_id: rhythm.id,
          module_id: row.id,
          started_at: late("00:20", "2026-11-15"),
        })
        .select()
        .single(),
    );
    await tellStarted(told, second);
    expect(await getRun(ctx, evening.id, "2026-11-14")).toMatchObject({ session_id: second.id });
  });

  it("is the same row on two screens, and moves once when both move it", async () => {
    const { ctx, other } = await setup();
    await rutin.onActivate!(ctx);
    const morning = await routineByKey(ctx, "sabah");
    const at = new Date();
    const [one, two] = await Promise.all([
      ensureRun(ctx, { routineId: morning.id, day: "2026-11-14", sessionId: null, at }),
      ensureRun(other, { routineId: morning.id, day: "2026-11-14", sessionId: null, at }),
    ]);
    expect(one.id).toBe(two.id);
    const moved = await Promise.all([
      moveRun(ctx, one, { part_position: 1 }),
      moveRun(other, two, { part_position: 1 }),
    ]);
    expect(moved.filter(Boolean)).toHaveLength(1);
    expect((await getRun(ctx, morning.id, "2026-11-14"))!.part_position).toBe(1);
  });

  it("keeps a deleted step's records, and is nobody else's", async () => {
    const { ctx } = await setup();
    await rutin.onActivate!(ctx);
    const morning = await routineByKey(ctx, "sabah");
    const run = await ensureRun(ctx, {
      routineId: morning.id,
      day: "2026-11-14",
      sessionId: null,
      at: new Date(),
    });
    const water = (await listSteps(ctx)).find((step) => step.ref === "S2")!;
    await saveRecords(ctx, [
      { run_id: run.id, step_id: water.id, result: "done", seconds: 40, bulk: false },
    ]);
    // Saving again (the other screen) changes the record, it adds none.
    await saveRecords(ctx, [
      { run_id: run.id, step_id: water.id, result: "skipped", seconds: null, bulk: false },
    ]);
    expect(ok(await db.from("rutin_run_steps").select("*"))).toHaveLength(1);
    ok(await db.from("rutin_steps").delete().eq("id", water.id).select());
    expect(ok(await db.from("rutin_run_steps").select("*"))).toMatchObject([
      { step_id: null, result: "skipped" },
    ]);
    expect(ok(await strangerDb().from("rutin_runs").select("*"))).toEqual([]);
    expect(ok(await strangerDb().from("rutin_steps").select("*"))).toEqual([]);
  });

  it("hangs an add-on only on a step of the same routine, never on another add-on", async () => {
    const { ctx } = await setup();
    await rutin.onActivate!(ctx);
    const steps = await listSteps(ctx);
    const dercos = steps.find((step) => step.title === "Dercos şampuan")!;
    const evening = await routineByKey(ctx, "aksam");
    const teeth = steps.find((step) => step.ref === "S1")!;
    const shower = steps.find((step) => step.title === "Duş")!;
    const otherRoutine = await db
      .from("rutin_steps")
      .insert({ routine_id: evening.id, parent_id: shower.id, title: "Yanlış ek" });
    expect(otherRoutine.error?.message).toMatch(/routine/);
    const nested = await db
      .from("rutin_steps")
      .insert({ routine_id: dercos.routine_id, parent_id: dercos.id, title: "Ekin eki" });
    expect(nested.error?.message).toMatch(/add-on/);
    const withAddOns = await db
      .from("rutin_steps")
      .update({ parent_id: teeth.id })
      .eq("id", shower.id);
    expect(withAddOns.error).not.toBeNull();
  });

  it("refuses sub-steps that are not a list and a frequency out of range", async () => {
    const { ctx } = await setup();
    await rutin.onActivate!(ctx);
    const step = (await listSteps(ctx))[0];
    const parts = await db
      .from("rutin_steps")
      .update({ parts: { title: "x" } })
      .eq("id", step.id);
    expect(parts.error).not.toBeNull();
    const often = await db.from("rutin_steps").update({ every_days: 0 }).eq("id", step.id);
    expect(often.error).not.toBeNull();
  });
});

describe("a morning not done (criterion 11, simulation B2)", () => {
  it("is offered after the waking and gone from the Today screen in the afternoon", async () => {
    const { ctx, row } = await setup();
    await rutin.onActivate!(ctx);
    const date = "2026-11-13";
    ok(await db.from("settings").insert({}).select().single());
    ok(
      await db
        .from("days")
        .insert({ date, woke_at: istanbulInstant(date, "07:00").toISOString() })
        .select(),
    );
    const rhythms = ok(await db.from("rhythms").select("*").eq("module_id", row.id));
    const morning = rhythms.filter((rhythm) => rhythm.key !== "rutin:aksam").map((r) => r.id);
    const at = async (time: string) => {
      const now = istanbulInstant(date, time);
      const rows = await loadPlanRows(db, now);
      const plan = buildPlan(planInput(rows, { date, now, context: "home" }));
      const offered = plan.slots.flatMap((slot) =>
        slot.assignment ? [slot.assignment.candidate.id] : [],
      );
      const now_ = plan.now.kind === "suggest" ? plan.now.assignment.candidate.id : null;
      return { offered, now: now_, kind: plan.now.kind };
    };
    const early = await at("07:05");
    expect(early.now).toBe(rhythms.find((rhythm) => rhythm.key === "rutin:sabah")!.id);
    const afternoon = await at("14:00");
    expect(afternoon.offered.filter((id) => morning.includes(id))).toEqual([]);
    expect(morning).not.toContain(afternoon.now);
  });
});
