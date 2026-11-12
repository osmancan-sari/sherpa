import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeModule, ok, ownerDb, strangerDb, wipe } from "./helpers";

// The constraints the envelope, the block series and the day plan lean on.

const db = ownerDb();

beforeEach(wipe);
afterAll(wipe);

const UNIQUE = "23505";
const CHECK = "23514";
const FOREIGN_KEY = "23503";

describe("one record per proposal key", () => {
  it("refuses a second work item, rhythm or block with the same key in a module", async () => {
    const mod = await makeModule(db);
    const other = await makeModule(db, "diger", "Diğer");

    ok(
      await db
        .from("work_items")
        .insert({ module_id: mod.id, key: "a:1", title: "Kalem" })
        .select()
        .single(),
    );
    const again = await db
      .from("work_items")
      .insert({ module_id: mod.id, key: "a:1", title: "Kalem" });
    expect(again.error?.code).toBe(UNIQUE);

    const rhythm = {
      module_id: mod.id,
      key: "r:1",
      title: "Ritim",
      target_count: 1,
      period: "week" as const,
    };
    ok(await db.from("rhythms").insert(rhythm).select().single());
    expect((await db.from("rhythms").insert(rhythm)).error?.code).toBe(UNIQUE);

    const block = {
      module_id: mod.id,
      key: "b:1",
      title: "Randevu",
      starts_at: "2026-11-16T09:00:00+03:00",
      ends_at: "2026-11-16T10:00:00+03:00",
    };
    ok(await db.from("blocks").insert(block).select().single());
    expect((await db.from("blocks").insert(block)).error?.code).toBe(UNIQUE);

    // The same key in another module is a different proposal; rows without a key never clash.
    ok(
      await db
        .from("work_items")
        .insert({ module_id: other.id, key: "a:1", title: "Kalem" })
        .select()
        .single(),
    );
    ok(
      await db
        .from("work_items")
        .insert([
          { module_id: mod.id, title: "Elle 1" },
          { module_id: mod.id, title: "Elle 2" },
        ])
        .select(),
    );
  });
});

describe("blocks and series", () => {
  async function makeSeries() {
    return ok(
      await db
        .from("block_series")
        .insert({ title: "Ders", weekday: 1, start_time: "09:00", end_time: "11:00" })
        .select()
        .single(),
    );
  }

  it("holds one block per series day, wherever the block was moved to", async () => {
    const series = await makeSeries();
    const first = ok(
      await db
        .from("blocks")
        .insert({
          series_id: series.id,
          occurrence_on: "2026-11-16",
          title: "Ders",
          starts_at: "2026-11-16T09:00:00+03:00",
          ends_at: "2026-11-16T11:00:00+03:00",
        })
        .select()
        .single(),
    );
    // Moved to the afternoon by hand: the day it stands for does not change.
    ok(
      await db
        .from("blocks")
        .update({
          starts_at: "2026-11-16T14:00:00+03:00",
          ends_at: "2026-11-16T16:00:00+03:00",
        })
        .eq("id", first.id)
        .select()
        .single(),
    );
    const regenerated = await db.from("blocks").insert({
      series_id: series.id,
      occurrence_on: "2026-11-16",
      title: "Ders",
      starts_at: "2026-11-16T09:00:00+03:00",
      ends_at: "2026-11-16T11:00:00+03:00",
    });
    expect(regenerated.error?.code).toBe(UNIQUE);
  });

  it("ties the series and its day together: both or neither", async () => {
    const series = await makeSeries();
    const times = {
      title: "Ders",
      starts_at: "2026-11-16T09:00:00+03:00",
      ends_at: "2026-11-16T11:00:00+03:00",
    };
    const noDay = await db.from("blocks").insert({ ...times, series_id: series.id });
    expect(noDay.error?.code).toBe(CHECK);
    const noSeries = await db.from("blocks").insert({ ...times, occurrence_on: "2026-11-16" });
    expect(noSeries.error?.code).toBe(CHECK);
  });

  it("refuses a block or series that ends before it starts, and a weekday outside 1 to 7", async () => {
    const backwards = await db.from("blocks").insert({
      title: "Ters",
      starts_at: "2026-11-16T11:00:00+03:00",
      ends_at: "2026-11-16T09:00:00+03:00",
    });
    expect(backwards.error?.code).toBe(CHECK);

    const series = { title: "Ders", weekday: 1, start_time: "11:00", end_time: "09:00" };
    expect((await db.from("block_series").insert(series)).error?.code).toBe(CHECK);
    for (const weekday of [0, 8]) {
      const result = await db
        .from("block_series")
        .insert({ title: "Ders", weekday, start_time: "09:00", end_time: "11:00" });
      expect(result.error?.code, `weekday ${weekday}`).toBe(CHECK);
    }
  });
});

describe("one row per day, week and user", () => {
  it("refuses a second row for the same day, week or settings", async () => {
    ok(await db.from("days").insert({ date: "2026-11-12" }).select().single());
    expect((await db.from("days").insert({ date: "2026-11-12" })).error?.code).toBe(UNIQUE);

    ok(await db.from("week_plans").insert({ week_start: "2026-11-09" }).select().single());
    expect((await db.from("week_plans").insert({ week_start: "2026-11-09" })).error?.code).toBe(
      UNIQUE,
    );

    ok(await db.from("settings").insert({}).select().single());
    expect((await db.from("settings").insert({})).error?.code).toBe(UNIQUE);

    // Another account has its own day.
    ok(await strangerDb().from("days").insert({ date: "2026-11-12" }).select().single());
  });
});

describe("rows only point at rows of the same account", () => {
  it("refuses a row that hangs itself on another account's module, series or task", async () => {
    const stranger = strangerDb();
    const mod = await makeModule(db);
    const series = ok(
      await db
        .from("block_series")
        .insert({ title: "Ders", weekday: 1, start_time: "09:00", end_time: "11:00" })
        .select()
        .single(),
    );
    const task = ok(
      await db.from("tasks").insert({ module_id: mod.id, title: "İş" }).select().single(),
    );

    const item = await stranger
      .from("work_items")
      .insert({ module_id: mod.id, key: "a:1", title: "Yabancı" });
    expect(item.error?.code).toBe(FOREIGN_KEY);
    const foreignTask = await stranger
      .from("tasks")
      .insert({ module_id: mod.id, title: "Yabancı" });
    expect(foreignTask.error?.code).toBe(FOREIGN_KEY);
    const block = await stranger.from("blocks").insert({
      series_id: series.id,
      occurrence_on: "2026-11-16",
      title: "Yabancı",
      starts_at: "2026-11-16T09:00:00+03:00",
      ends_at: "2026-11-16T11:00:00+03:00",
    });
    expect(block.error?.code).toBe(FOREIGN_KEY);
    const session = await stranger.from("sessions").insert({ task_id: task.id });
    expect(session.error?.code).toBe(FOREIGN_KEY);
    const unplanned = await stranger.rpc("start_session", { p_title: "x", p_module_id: mod.id });
    expect(unplanned.error?.code).toBe(FOREIGN_KEY);

    // So the owner's own proposal and block generation are never blocked by a stranger's row.
    ok(
      await db
        .from("work_items")
        .insert({ module_id: mod.id, key: "a:1", title: "Kalem" })
        .select()
        .single(),
    );
  });
});

describe("closed work stays closed", () => {
  it("does not start a session on a finished or dropped task, or on a closed item", async () => {
    const mod = await makeModule(db);
    const done = ok(
      await db
        .from("tasks")
        .insert({ module_id: mod.id, title: "Biten", status: "done" })
        .select()
        .single(),
    );
    const dropped = ok(
      await db
        .from("tasks")
        .insert({ module_id: mod.id, title: "Bırakılan", status: "dropped" })
        .select()
        .single(),
    );
    const item = ok(
      await db
        .from("work_items")
        .insert({ module_id: mod.id, title: "Kapalı", status: "dropped" })
        .select()
        .single(),
    );

    expect((await db.rpc("start_session", { p_task_id: done.id })).error).not.toBeNull();
    expect((await db.rpc("start_session", { p_task_id: dropped.id })).error).not.toBeNull();
    expect((await db.rpc("start_session", { p_work_item_id: item.id })).error).not.toBeNull();
    expect(ok(await db.from("sessions").select("id"))).toHaveLength(0);

    // One tap on a dropped task does not bring it back as done.
    ok(await db.rpc("complete_task", { p_task_id: dropped.id }));
    expect(ok(await db.from("tasks").select("status").eq("id", dropped.id).single()).status).toBe(
      "dropped",
    );
  });

  it("starting a waiting task ends the wait", async () => {
    const mod = await makeModule(db);
    const task = ok(
      await db
        .from("tasks")
        .insert({
          module_id: mod.id,
          title: "Onay",
          status: "waiting",
          waiting_on: "hoca",
          follow_up_on: "2026-11-20",
        })
        .select()
        .single(),
    );
    const session = ok(await db.rpc("start_session", { p_task_id: task.id }));
    ok(await db.rpc("end_session", { p_session_id: session.id, p_outcome: "stopped" }));
    const after = ok(await db.from("tasks").select("*").eq("id", task.id).single());
    expect(after).toMatchObject({ status: "todo", waiting_on: null, follow_up_on: null });
  });
});

describe("the planner's columns (Ç3)", () => {
  it("counts how often a task was put off, never below zero", async () => {
    const mod = await makeModule(db);
    const task = ok(
      await db.from("tasks").insert({ module_id: mod.id, title: "İş" }).select().single(),
    );
    expect(task.defer_count).toBe(0);
    const below = await db.from("tasks").update({ defer_count: -1 }).eq("id", task.id);
    expect(below.error?.code).toBe(CHECK);
  });

  it("keeps the life mode and the item shares of a week's commitment", async () => {
    const week = ok(
      await db.from("week_plans").insert({ week_start: "2026-11-16" }).select().single(),
    );
    expect(week).toMatchObject({ life_mode: null, shares: {}, day_capacity: {} });
    const busy = ok(
      await db
        .from("week_plans")
        .update({ life_mode: "busy", shares: { a: 90 } })
        .eq("id", week.id)
        .select()
        .single(),
    );
    expect(busy).toMatchObject({ life_mode: "busy", shares: { a: 90 } });
  });
});

describe("time constraints (Ç3b)", () => {
  it("keep an object or nothing in work items, tasks and rhythms", async () => {
    const mod = await makeModule(db);
    const timing = { windows: [{ from: "16:00", to: "18:00" }] };
    const item = ok(
      await db
        .from("work_items")
        .insert({ module_id: mod.id, title: "Kalem", timing })
        .select()
        .single(),
    );
    expect(item.timing).toEqual(timing);
    const task = ok(
      await db.from("tasks").insert({ module_id: mod.id, title: "İş" }).select().single(),
    );
    expect(task.timing).toBeNull();
    const rhythm = ok(
      await db
        .from("rhythms")
        .insert({ module_id: mod.id, title: "Spor", target_count: 3, period: "week", timing })
        .select()
        .single(),
    );
    expect(rhythm.timing).toEqual(timing);
    for (const table of ["work_items", "tasks", "rhythms"] as const) {
      for (const bad of [[], "07:00", 5]) {
        const result = await db.from(table).update({ timing: bad }).eq("module_id", mod.id);
        expect(result.error?.code).toBe(CHECK);
      }
    }
  });
});
