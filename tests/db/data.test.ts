import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRegistry } from "@/core/contract/registry";
import { listDuePrompts, snoozePrompt, getSettings } from "@/core/data/inbox";
import { listModules, setModuleStatus, updateModule, getModule } from "@/core/data/module-rows";
import { propose } from "@/core/data/propose";
import { endSession, getOpenSession, listSessions, startSession } from "@/core/data/sessions";
import {
  completeTask,
  createRhythm,
  createTask,
  createWorkItem,
  dropTask,
  listRhythmLogs,
  listRhythms,
  listTasks,
  listWorkItems,
  logRhythm,
  reopenTask,
  updateRhythm,
  updateTask,
  updateWorkItem,
} from "@/core/data/work";
import { closeWorkItem } from "@/core/data/outcome";
import { dayKey } from "@/lib/date";
import { makeModule, ok, ownerDb, wipe } from "./helpers";

// The user's own creating, editing and status changes (the "elle" half of the pool).

const db = ownerDb();
const SOURCE = { type: "sinama.kayit", id: "8f2c1d7e-3b4a-4c5d-9e6f-0a1b2c3d4e5f" };

beforeEach(wipe);
afterAll(wipe);

describe("work items by hand", () => {
  it("marks every field the user gives as the user's", async () => {
    const mod = await makeModule(db);
    const item = await createWorkItem(db, {
      module_id: mod.id,
      title: "  TUM başvurusu ",
      due_at: "2026-12-01T20:59:00Z",
      effort_total_minutes: 600,
    });
    expect(item).toMatchObject({
      title: "TUM başvurusu",
      status: "active",
      effort_total_minutes: 600,
    });
    expect(item.provenance).toEqual({
      title: "user",
      due_at: "user",
      effort_total_minutes: "user",
    });
    expect((await listWorkItems(db)).map((row) => row.id)).toEqual([item.id]);
  });

  it("an edit marks only the edited fields, and closed items leave the open list", async () => {
    const mod = await makeModule(db);
    const { id } = await propose(db, mod, {
      schema: 1,
      key: "k",
      source: SOURCE,
      title: "Kalem",
      importance: 3,
    });
    const edited = await updateWorkItem(db, id, { session_minutes: 60 });
    expect(edited.provenance).toMatchObject({
      session_minutes: "user",
      title: "module",
      importance: "module",
    });

    await closeWorkItem(db, createRegistry([]), id, "done");
    expect(await listWorkItems(db)).toEqual([]);
  });
});

describe("rhythms by hand", () => {
  it("creates, edits and logs a rhythm", async () => {
    const mod = await makeModule(db);
    const rhythm = await createRhythm(db, {
      module_id: mod.id,
      title: " Süpürme ",
      target_count: 2,
      period: "week",
      est_minutes: 20,
    });
    expect(rhythm).toMatchObject({
      title: "Süpürme",
      active: true,
      floor_count: 0,
      est_minutes: 20,
    });
    expect(rhythm.provenance).toEqual({
      title: "user",
      target_count: "user",
      period: "user",
      est_minutes: "user",
    });

    const edited = await updateRhythm(db, rhythm.id, { target_count: 3 });
    expect(edited.target_count).toBe(3);
    expect(edited.provenance).toMatchObject({ target_count: "user" });

    const now = new Date();
    await logRhythm(db, rhythm.id, now);
    const logs = await listRhythmLogs(db, dayKey(now));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ rhythm_id: rhythm.id, done_on: dayKey(now), session_id: null });
    expect(await listRhythmLogs(db, "2999-01-01")).toEqual([]);

    // A rhythm switched off leaves the list.
    await updateRhythm(db, rhythm.id, { active: false });
    expect(await listRhythms(db)).toEqual([]);
  });
});

describe("tasks by hand", () => {
  it("edits a task, finishes it and takes the finish back", async () => {
    const mod = await makeModule(db);
    const task = await createTask(db, { module_id: mod.id, title: "Fatura" });
    const edited = await updateTask(db, task.id, { est_minutes: 15, importance: 3 });
    expect(edited).toMatchObject({ est_minutes: 15, importance: 3 });

    const done = await completeTask(db, task.id);
    expect(done.status).toBe("done");
    const reopened = await reopenTask(db, task.id);
    expect(reopened).toMatchObject({ status: "todo", done_at: null });
  });

  it("drops a task without deleting it; a session running on it is stopped and kept", async () => {
    const mod = await makeModule(db);
    const task = await createTask(db, { module_id: mod.id, title: "Vazgeçilecek iş" });
    const other = await createTask(db, { module_id: mod.id, title: "Öbür iş" });
    const session = await startSession(db, { taskId: task.id });

    const dropped = await dropTask(db, task.id);
    expect(dropped.status).toBe("dropped");
    expect(await getOpenSession(db)).toBeNull();
    const [kept] = ok(await db.from("sessions").select("*").eq("id", session.id));
    expect(kept.ended_at).not.toBeNull();
    expect(ok(await db.from("tasks").select("id")).length).toBe(2);
    expect((await listTasks(db, new Date())).map((row) => row.id)).toEqual([other.id]);

    // Dropping a task nobody is working on leaves a session on another task alone.
    const running = await startSession(db, { taskId: other.id });
    const second = await createTask(db, { module_id: mod.id, title: "Üçüncü iş" });
    await dropTask(db, second.id);
    expect((await getOpenSession(db))?.id).toBe(running.id);
  });
});

describe("sessions", () => {
  it("reads the open session and the recent ones", async () => {
    const mod = await makeModule(db);
    expect(await getOpenSession(db)).toBeNull();

    const first = await startSession(db, { title: "Telefon", moduleId: mod.id });
    expect(first.module_id).toBe(mod.id);
    expect((await getOpenSession(db))?.id).toBe(first.id);
    await endSession(db, first.id);
    const second = await startSession(db, { title: "Yürüyüş" });
    expect(second.module_id).toBeNull();

    const sessions = await listSessions(db, new Date());
    expect(sessions.map((session) => session.title)).toEqual(["Yürüyüş", "Telefon"]);
    expect(await listSessions(db, new Date("2099-01-01T00:00:00Z"))).toEqual([]);
  });
});

describe("questions", () => {
  it("shows a question only once it is due, and later again after 'Sonra'", async () => {
    const mod = await makeModule(db);
    const now = new Date("2026-11-12T10:40:00+03:00");
    const insert = (question: string, askAfter: string) =>
      db
        .from("prompts")
        .insert({ module_id: mod.id, kind: "attendance", question, ask_after: askAfter })
        .select()
        .single();
    const due = ok(await insert("Derse girdin mi?", "2026-11-12T10:00:00+03:00"));
    ok(await insert("Teslim ettin mi?", "2026-11-12T18:00:00+03:00"));
    ok(await insert("Daha eski", "2026-11-11T10:00:00+03:00"));

    expect((await listDuePrompts(db, now)).map((prompt) => prompt.question)).toEqual([
      "Daha eski",
      "Derse girdin mi?",
    ]);

    await snoozePrompt(db, due.id, now);
    expect((await listDuePrompts(db, now)).map((prompt) => prompt.question)).toEqual(["Daha eski"]);
    const threeHoursOn = new Date(now.getTime() + 3 * 3_600_000);
    expect((await listDuePrompts(db, threeHoursOn)).map((prompt) => prompt.question)).toEqual([
      "Daha eski",
      "Derse girdin mi?",
    ]);
  });
});

describe("module rows and settings", () => {
  it("pauses, resumes and edits a module", async () => {
    const mod = await makeModule(db);
    await makeModule(db, "diger", "Diğer");
    expect((await listModules(db)).map((row) => row.slug)).toEqual(["sinama", "diger"]);

    expect((await setModuleStatus(db, mod.id, "paused")).status).toBe("paused");
    expect((await getModule(db, "sinama"))?.status).toBe("paused");
    expect((await setModuleStatus(db, mod.id, "active")).status).toBe("active");
    expect(await getModule(db, "yok")).toBeNull();

    const edited = await updateModule(db, mod.id, {
      name: "Okul",
      weekly_floor_minutes: 120,
      sort: 5,
    });
    expect(edited).toMatchObject({ name: "Okul", weekly_floor_minutes: 120, sort: 5 });
    expect((await listModules(db)).map((row) => row.slug)).toEqual(["diger", "sinama"]);
  });

  it("has no settings row until one is written; the defaults are the documented ones", async () => {
    expect(await getSettings(db)).toBeNull();
    ok(await db.from("settings").insert({}).select().single());
    expect(await getSettings(db)).toMatchObject({
      finish_line_default: "19:00:00",
      capacity_factors: { home: 0.7, office: 0.4, campus: 0.5 },
      slot: { deep_min: 45, deep_max: 90, light_min: 15, break_min: 15 },
      default_day_type: "home",
      return_after_days: 3,
      ai_enabled: true,
      ai_monthly_budget_usd: 5,
    });
  });
});
