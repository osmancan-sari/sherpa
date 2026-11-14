import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRegistry } from "@/core/contract/registry";
import type { ModuleDefinition } from "@/core/contract/types";
import { recordBed, undoSceneBed } from "@/core/data/frame";
import { loadPlanRows } from "@/core/data/keep";
import { endSessionClosing, startSessionTold, tellBedUndone } from "@/core/data/session-events";
import { createRhythm, createTask } from "@/core/data/work";
import { buildPlan, planInput } from "@/core/planner";
import type { AppEvent } from "@/core/types";
import { dayKey } from "@/lib/date";
import { makeModule, ok, ownerDb, strangerDb, wipe } from "./helpers";

// Rutin 1 (Rutin's core note 15; docs/06-modul-sozlesmesi.md, "Diziler" rule 6): a scene's
// "Yatıyorum" closes its session and writes the bedtime with the session's mark; for 10 minutes
// "Geri al" takes it back as if it was never written: the bedtime, the rhythm's log, the task's
// done go, the session runs again and the plan is the running one again. Late, or after the
// bedtime was written another way, nothing changes. Two screens at once: one result.

const db = ownerDb();
const phone = ownerDb();
const heard: AppEvent[] = [];
const view = () => null;
const listening: ModuleDefinition = {
  slug: "sinama",
  name: "Sınama",
  kind: "lifelong",
  color: "#6250d6",
  chip: async () => ({ text: "", health: "ok" }),
  intake: [],
  emits: [],
  on: {
    "core.bed_undone": async (event) => void heard.push(event),
    "core.session_started": async (event) => void heard.push(event),
  },
  modeBehavior: {
    normal: { weightMultiplier: 1, floorMultiplier: 1 },
    busy: { weightMultiplier: 1, floorMultiplier: 1 },
    minimum: { weightMultiplier: 1, floorMultiplier: 1 },
    holiday: { weightMultiplier: 1, floorMultiplier: 1 },
  },
  weeklyReport: async () => ({ metrics: [], suggestions: [] }),
  ui: { tabs: [{ key: "genel", label: "Genel", component: view }] },
};
const registry = createRegistry([listening]);
const told = { db, registry };

beforeEach(async () => {
  heard.length = 0;
  await wipe();
});
afterAll(wipe);

/** An evening routine's session ended with the scene's "Yatıyorum". */
async function bedded() {
  const mod = await makeModule(db);
  const rhythm = await createRhythm(db, {
    module_id: mod.id,
    title: "Akşam kapanışı",
    target_count: 1,
    period: "day",
    est_minutes: 10,
  });
  const date = dayKey(new Date());
  // A fresh account's settings: the day's frame is on; the day woke this morning.
  ok(await db.from("settings").insert({}).select().single());
  ok(
    await db
      .from("days")
      .insert({ date, woke_at: new Date(Date.now() - 12 * 3600_000).toISOString() })
      .select(),
  );
  const session = await startSessionTold(told, { rhythmId: rhythm.id });
  await endSessionClosing(told, session.id, "done");
  await recordBed(db, date, new Date(), session.id);
  return { mod, rhythm, session, date };
}

const day = async (date: string) => ok(await db.from("days").select("*").eq("date", date).single());
const logs = async () => ok(await db.from("rhythm_logs").select("*"));
const open = async () => ok(await db.from("sessions").select("*").is("ended_at", null));

async function nowKind() {
  const now = new Date();
  const rows = await loadPlanRows(db, now);
  return buildPlan(planInput(rows, { date: dayKey(now), now, context: "desk" })).now.kind;
}

describe("taking back a scene's bedtime", () => {
  it("removes the bedtime and the log, runs the session again, and the plan is the running one", async () => {
    const { session, date } = await bedded();
    expect((await day(date)).bed_session_id).toBe(session.id);
    expect(await logs()).toHaveLength(1);
    expect(await nowKind()).toBe("night");

    expect(await undoSceneBed(db, session.id)).toBe("undone");
    expect(await day(date)).toMatchObject({ bed_at: null, bed_session_id: null });
    expect(await logs()).toEqual([]);
    expect((await open()).map((row) => row.id)).toEqual([session.id]);
    const again = (await open())[0];
    expect(again.started_at).toBe(session.started_at);
    expect(again.confirmed_at).not.toBeNull();
    expect(await nowKind()).toBe("running");
  });

  it("tells every module the day is open again, and the work's module its session goes on", async () => {
    const { session, date } = await bedded();
    heard.length = 0;
    await undoSceneBed(db, session.id);
    await tellBedUndone(told, { date, sessionId: session.id });
    expect(heard.map((event) => event.type)).toEqual(["core.bed_undone", "core.session_started"]);
    expect(heard[0].payload).toEqual({ date });
    expect(heard[1].payload).toMatchObject({ session_id: session.id });
  });

  it("puts a task back to running, its minutes off its work item", async () => {
    const mod = await makeModule(db);
    const task = await createTask(db, { module_id: mod.id, title: "Akşam", est_minutes: 10 });
    const date = dayKey(new Date());
    const session = ok(
      await db
        .from("sessions")
        .insert({
          task_id: task.id,
          started_at: new Date(Date.now() - 20 * 60_000).toISOString(),
        })
        .select()
        .single(),
    );
    ok(await db.from("tasks").update({ status: "doing" }).eq("id", task.id).select());
    await endSessionClosing(told, session.id, "done");
    await recordBed(db, date, new Date(), session.id);
    expect(ok(await db.from("tasks").select("status").eq("id", task.id).single()).status).toBe(
      "done",
    );
    expect(await undoSceneBed(db, session.id)).toBe("undone");
    expect(ok(await db.from("tasks").select("*").eq("id", task.id).single())).toMatchObject({
      status: "doing",
      done_at: null,
    });
  });

  it("changes nothing after 10 minutes", async () => {
    const { session, date } = await bedded();
    const late = new Date(Date.now() - 11 * 60_000).toISOString();
    ok(await db.from("days").update({ bed_at: late }).eq("date", date).select());
    expect(await undoSceneBed(db, session.id)).toBe("expired");
    expect(await day(date)).toMatchObject({ bed_session_id: session.id });
    expect(Date.parse((await day(date)).bed_at!)).toBe(Date.parse(late));
    expect(await logs()).toHaveLength(1);
    expect(await open()).toEqual([]);
  });

  it("changes nothing once the bedtime was written another way, or another work started", async () => {
    const { session, date, rhythm, mod } = await bedded();
    // The core's own "Yatıyorum" (or the closing's, or the phone's automation) clears the mark.
    await recordBed(db, date, new Date());
    expect((await day(date)).bed_session_id).toBeNull();
    expect(await undoSceneBed(db, session.id)).toBe("changed");
    expect((await day(date)).bed_at).not.toBeNull();
    expect(await open()).toEqual([]);

    // Bedded again from the scene, then something else started: still nothing.
    await recordBed(db, date, new Date(), session.id);
    const other = await createTask(db, { module_id: mod.id, title: "Başka", est_minutes: 10 });
    await startSessionTold(told, { taskId: other.id });
    expect(await undoSceneBed(db, session.id)).toBe("changed");
    expect((await day(date)).bed_session_id).toBe(session.id);
    expect((await logs()).map((row) => row.rhythm_id)).toEqual([rhythm.id]);
  });

  it("gives one result when two screens take it back at once", async () => {
    for (let round = 0; round < 8; round++) {
      await wipe();
      const { session, date } = await bedded();
      const answers = await Promise.all([
        undoSceneBed(db, session.id),
        undoSceneBed(phone, session.id),
      ]);
      expect(answers).toEqual(["undone", "undone"]);
      expect((await open()).map((row) => row.id)).toEqual([session.id]);
      expect(await logs()).toEqual([]);
      expect((await day(date)).bed_at).toBeNull();
    }
  });

  it("is nobody else's", async () => {
    const { session, date } = await bedded();
    expect(await undoSceneBed(strangerDb(), session.id)).toBe("changed");
    expect((await day(date)).bed_session_id).toBe(session.id);
  });
});
