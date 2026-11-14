import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRegistry } from "@/core/contract/registry";
import type { ModuleDefinition } from "@/core/contract/types";
import { setModuleStatus } from "@/core/data/module-rows";
import { closeWorkItem } from "@/core/data/outcome";
import {
  closeUnansweredTold,
  completeTaskTold,
  dropTaskTold,
  endSessionTold,
  startSessionTold,
  tellDayClosed,
  tellDayStarted,
} from "@/core/data/session-events";
import { createRhythm, createTask, createWorkItem } from "@/core/data/work";
import type { AppEvent } from "@/core/types";
import { makeModule, ok, ownerDb, wipe } from "./helpers";

// The core's session and day events (docs/06-modul-sozlesmesi.md, "Olaylar"; Ç3c): a session's
// events reach its own module only, the day's reach every active module.

const db = ownerDb();
beforeEach(wipe);
afterAll(wipe);

const CORE = ["core.session_started", "core.session_ended", "core.day_started", "core.day_closed"];

function listener(slug: string) {
  const heard: AppEvent[] = [];
  const view = () => null;
  const definition: ModuleDefinition = {
    slug,
    name: slug,
    kind: "lifelong",
    color: "#2563eb",
    chip: async () => ({ text: "", health: "ok" }),
    intake: [],
    emits: [],
    on: Object.fromEntries(
      CORE.map((type) => [type, async (event: AppEvent) => void heard.push(event)]),
    ),
    modeBehavior: {
      normal: { weightMultiplier: 1, floorMultiplier: 1 },
      busy: { weightMultiplier: 1, floorMultiplier: 1 },
      minimum: { weightMultiplier: 1, floorMultiplier: 1 },
      holiday: { weightMultiplier: 1, floorMultiplier: 1 },
    },
    weeklyReport: async () => ({ metrics: [], suggestions: [] }),
    ui: { tabs: [{ key: "genel", label: "Genel", component: view }] },
  };
  return { definition, heard };
}

async function setup() {
  const a = listener("birinci");
  const b = listener("ikinci");
  const registry = createRegistry([a.definition, b.definition]);
  const modA = await makeModule(db, "birinci", "Birinci");
  const modB = await makeModule(db, "ikinci", "İkinci");
  return { a, b, registry, modA, modB, told: { db, registry } };
}

const kinds = (events: AppEvent[]) =>
  events.map((event) => {
    const payload = event.payload as { result?: string };
    return payload.result ? `${event.type}:${payload.result}` : event.type;
  });

describe("session events", () => {
  it("reach the work's own module only, with its source, the result and the minutes", async () => {
    const { a, b, told, modA } = await setup();
    // A module's task carries its source (as an item's sitting does).
    const task = ok(
      await db
        .from("tasks")
        .insert({
          module_id: modA.id,
          title: "Rutin",
          source_type: "birinci.kayit",
          source_id: "8f2c1d7e-3b4a-4c5d-9e6f-0a1b2c3d4e5f",
        })
        .select()
        .single(),
    );
    const session = await startSessionTold(told, { taskId: task.id });
    await endSessionTold(told, session.id, "done");
    expect(kinds(a.heard)).toEqual(["core.session_started", "core.session_ended:done"]);
    expect(b.heard).toEqual([]);
    expect(a.heard[1].payload).toMatchObject({
      module: "birinci",
      session_id: session.id,
      task_id: task.id,
      rhythm_id: null,
      source: { type: "birinci.kayit", id: "8f2c1d7e-3b4a-4c5d-9e6f-0a1b2c3d4e5f" },
      minutes: 0,
      measured: true,
    });
    // Written to the events table too, as the core's own.
    const rows = ok(await db.from("events").select("type, module_slug").order("occurred_at"));
    expect(rows.map((row) => row.type)).toEqual(["core.session_started", "core.session_ended"]);
    expect(rows.every((row) => row.module_slug === null)).toBe(true);
  });

  it("a session stopped by another start is told 'stopped'; deferred, stuck and unanswered say so", async () => {
    const { a, b, told, modA, modB } = await setup();
    const first = await createTask(db, { module_id: modA.id, title: "Bir" });
    const other = await createTask(db, { module_id: modB.id, title: "İki" });
    await startSessionTold(told, { taskId: first.id });
    const second = await startSessionTold(told, { taskId: other.id });
    expect(kinds(a.heard)).toEqual(["core.session_started", "core.session_ended:stopped"]);
    expect(kinds(b.heard)).toEqual(["core.session_started"]);
    await endSessionTold(told, second.id, "stopped", "deferred");
    const third = await startSessionTold(told, { taskId: other.id });
    await endSessionTold(told, third.id, "stopped", "stuck");
    const fourth = await startSessionTold(told, { taskId: other.id });
    await closeUnansweredTold(told, fourth.id);
    expect(kinds(b.heard).filter((kind) => kind.startsWith("core.session_ended"))).toEqual([
      "core.session_ended:deferred",
      "core.session_ended:stuck",
      "core.session_ended:unanswered",
    ]);
    expect((b.heard.at(-1)!.payload as { measured: boolean }).measured).toBe(false);
  });

  it("one tap 'Bitti' on a running task ends its session as done; ending twice tells once", async () => {
    const { a, told, modA } = await setup();
    const task = await createTask(db, { module_id: modA.id, title: "Bir" });
    const session = await startSessionTold(told, { taskId: task.id });
    await completeTaskTold(told, task.id);
    await endSessionTold(told, session.id, "done");
    expect(kinds(a.heard)).toEqual(["core.session_started", "core.session_ended:done"]);
  });

  it("a rhythm's session reaches its module; unplanned work without a module reaches nobody", async () => {
    const { a, b, told, modA } = await setup();
    const rhythm = await createRhythm(db, {
      module_id: modA.id,
      title: "Esneme",
      target_count: 3,
      period: "week",
      est_minutes: 10,
      energy: "light",
      context: "any",
    });
    const session = await startSessionTold(told, { rhythmId: rhythm.id });
    expect(a.heard[0].payload).toMatchObject({ rhythm_id: rhythm.id });
    await startSessionTold(told, { title: "Plansız" });
    expect(kinds(a.heard)).toEqual(["core.session_started", "core.session_ended:stopped"]);
    expect(b.heard).toEqual([]);
    expect(session.module_id).toBe(modA.id);
  });

  it("closing an item with its sitting running tells 'done' when finished, 'stopped' when dropped; Bırak tells 'stopped'", async () => {
    const { a, told, modA, registry } = await setup();
    const finished = await createWorkItem(db, {
      module_id: modA.id,
      title: "Rapor",
      effort_total_minutes: 90,
    });
    await startSessionTold(told, { workItemId: finished.id });
    await closeWorkItem(db, registry, finished.id, "done");
    const dropped = await createWorkItem(db, {
      module_id: modA.id,
      title: "Taslak",
      effort_total_minutes: 90,
    });
    await startSessionTold(told, { workItemId: dropped.id });
    await closeWorkItem(db, registry, dropped.id, "dropped");
    const task = await createTask(db, { module_id: modA.id, title: "Bir" });
    await startSessionTold(told, { taskId: task.id });
    await dropTaskTold(told, task.id);
    expect(kinds(a.heard).filter((kind) => kind.startsWith("core.session_ended"))).toEqual([
      "core.session_ended:done",
      "core.session_ended:stopped",
      "core.session_ended:stopped",
    ]);
    expect(ok(await db.from("tasks").select("status").eq("id", task.id).single()).status).toBe(
      "dropped",
    );
  });

  it("a paused module hears nothing", async () => {
    const { a, told, modA } = await setup();
    const task = await createTask(db, { module_id: modA.id, title: "Bir" });
    await setModuleStatus(db, modA.id, "paused");
    await startSessionTold(told, { taskId: task.id });
    expect(a.heard).toEqual([]);
  });
});

describe("the core's day in the session events (Ç3g)", () => {
  it("carry the planning day of the start: a session started past midnight is the evening's", async () => {
    const { a, modA, told } = await setup();
    const routine = await createRhythm(db, {
      title: "Akşam",
      period: "day",
      target_count: 1,
      module_id: modA.id,
    });
    const late = ok(
      await db
        .from("sessions")
        .insert({
          rhythm_id: routine.id,
          module_id: modA.id,
          started_at: "2026-11-10T21:20:00Z", // 00:20 on the 11th in Istanbul
          ended_at: "2026-11-10T21:40:00Z",
        })
        .select()
        .single(),
    );
    const { tellStarted } = await import("@/core/data/session-events");
    await tellStarted(told, late);
    expect(a.heard[0].payload).toMatchObject({ session_id: late.id, day: "2026-11-10" });
    const now = await startSessionTold(told, { rhythmId: routine.id });
    await endSessionTold(told, now.id, "done");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
      new Date(Date.parse(now.started_at) - 5 * 3_600_000),
    );
    // Started now: its day is the planning day of now (before 05:00 the day before).
    expect(a.heard[1].payload).toMatchObject({ session_id: now.id, day: today });
    expect(a.heard[2].payload).toMatchObject({ session_id: now.id, day: today, result: "done" });
  });
});

describe("day events", () => {
  it("reach every active module", async () => {
    const { a, b, told, modB } = await setup();
    await tellDayStarted(told, {
      date: "2026-11-18",
      wokeAt: "2026-11-18T04:10:00Z",
      estimated: true,
    });
    await setModuleStatus(db, modB.id, "paused");
    await tellDayClosed(told, { date: "2026-11-18", bedAt: "2026-11-18T20:30:00Z" });
    expect(kinds(a.heard)).toEqual(["core.day_started", "core.day_closed"]);
    expect(kinds(b.heard)).toEqual(["core.day_started"]);
    expect(a.heard[0].payload).toEqual({
      date: "2026-11-18",
      woke_at: "2026-11-18T04:10:00Z",
      estimated: true,
      // Ç3g: where the waking came from (an estimated one is the first touch's).
      source: "estimate",
    });
  });
});

describe("the deneme module hears the core (Ç3c)", () => {
  it("resets a workout's step when its session starts, keeps its last session, counts the days", async () => {
    const { listeners } = await import("@/modules/deneme/rules");
    const deneme = listener("deneme");
    const definition = { ...deneme.definition, on: listeners };
    const registry = createRegistry([definition]);
    const told = { db, registry };
    const mod = await makeModule(db, "deneme", "Deneme");
    const item = ok(
      await db
        .from("deneme_items")
        .insert({ title: "Salon", kind: "antrenman", scene_step: 3 })
        .select()
        .single(),
    );
    const rhythm = ok(
      await db
        .from("rhythms")
        .insert({
          module_id: mod.id,
          title: "Salon",
          target_count: 3,
          period: "week",
          est_minutes: 45,
          energy: "physical",
          context: "any",
          source_type: "deneme.item",
          source_id: item.id,
        })
        .select()
        .single(),
    );
    const session = await startSessionTold(told, { rhythmId: rhythm.id });
    expect(
      ok(await db.from("deneme_items").select("scene_step").eq("id", item.id).single()).scene_step,
    ).toBeNull();
    await endSessionTold(told, session.id, "stopped", "stuck");
    await tellDayStarted(told, {
      date: "2026-11-18",
      wokeAt: "2026-11-18T04:00:00Z",
      estimated: false,
    });
    await tellDayClosed(told, { date: "2026-11-18", bedAt: "2026-11-18T20:00:00Z" });
    const settings = ok(await db.from("modules").select("settings").eq("id", mod.id).single())
      .settings as {
      days_started?: number;
      last_session?: { result: string };
      last_bed_day?: string;
    };
    expect(settings.last_bed_day).toBe("2026-11-18");
    expect(settings.days_started).toBe(1);
    expect(settings.last_session?.result).toBe("stuck");
    // Ç3g: the core's day of the session and where the waking came from.
    const more = settings as { last_session?: { day?: string }; last_wake_source?: string };
    expect(more.last_session?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(more.last_wake_source).toBe("screen");
  });
});
