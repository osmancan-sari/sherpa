import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { keepWeek, loadPlanRows } from "@/core/data/keep";
import {
  answerFollowUp,
  clearPastPlannedDays,
  closeDay,
  deferTask,
  listLifeModes,
  saveStats,
  setLifeMode,
  skipToday,
  touchDay,
  waitOnTask,
} from "@/core/data/planning";
import { createTask, createWorkItem } from "@/core/data/work";
import { buildPlan, planInput, storedPlan, tomorrowInput } from "@/core/planner";
import { dayKey, istanbulInstant, shiftDay, weekStart } from "@/lib/date";
import { makeModule, ok, ownerDb, wipe } from "./helpers";

// What the planner keeps (src/core/data/planning.ts, keep.ts) against the local database.

const db = ownerDb();
beforeEach(wipe);
afterAll(wipe);

// A Wednesday morning: the week has days left, the day has hours left.
const TODAY = "2026-11-18";
const NOW = istanbulInstant(TODAY, "09:00");

async function plan(now = NOW) {
  const rows = await loadPlanRows(db, now);
  const input = planInput(rows, { date: dayKey(now), now, context: "desk" });
  return { rows, input, plan: buildPlan(input) };
}

const day = async (date: string) =>
  (await db.from("days").select("*").eq("date", date).maybeSingle()).data;

describe("the day's record", () => {
  it("opens on the first touch with the engine's plan, once", async () => {
    const mod = await makeModule(db);
    const work = await createTask(db, { module_id: mod.id, title: "Rapor" });
    const first = await plan();
    const row = await touchDay(db, {
      date: TODAY,
      now: NOW,
      plan: first.plan,
      dayType: first.input.dayType,
      day: null,
    });
    expect(row).toMatchObject({ plan_source: "auto", top3: [work.id] });
    expect(row.started_at).not.toBeNull();
    expect(storedPlan(row)).toMatchObject({ dayType: "home" });
    expect(storedPlan(row).slotMinutes).toBeGreaterThan(0);
    // A second touch changes nothing.
    const again = await touchDay(db, {
      date: TODAY,
      now: istanbulInstant(TODAY, "10:00"),
      plan: first.plan,
      dayType: "home",
      day: row,
    });
    expect(again.started_at).toBe(row.started_at);
  });

  it("keeps the evening's plan for tomorrow and closes today", async () => {
    const mod = await makeModule(db);
    const work = await createTask(db, { module_id: mod.id, title: "Okuma" });
    const evening = istanbulInstant(TODAY, "21:00");
    const rows = await loadPlanRows(db, evening);
    const input = tomorrowInput(rows, { now: evening, context: "desk" });
    await closeDay(db, {
      today: TODAY,
      now: evening,
      tomorrow: { plan: buildPlan(input), dayType: input.dayType },
      note: "Yarın erken",
    });
    expect(await day(shiftDay(TODAY, 1))).toMatchObject({
      plan_source: "closing",
      top3: [work.id],
    });
    const today = await day(TODAY);
    expect(today).toMatchObject({ closing_note: "Yarın erken" });
    expect(today!.closed_at).not.toBeNull();
    // The next morning's first touch keeps the closing's plan.
    const morning = istanbulInstant(shiftDay(TODAY, 1), "08:30");
    const next = await plan(morning);
    const touched = await touchDay(db, {
      date: shiftDay(TODAY, 1),
      now: morning,
      plan: next.plan,
      dayType: next.input.dayType,
      day: await day(shiftDay(TODAY, 1)),
    });
    expect(touched).toMatchObject({ plan_source: "closing", top3: [work.id] });
    expect(touched.started_at).not.toBeNull();
  });

  it("puts work off: a task to tomorrow with its count, an item or rhythm off today's list", async () => {
    const mod = await makeModule(db);
    const work = await createTask(db, { module_id: mod.id, title: "Fatura" });
    const once = await deferTask(db, work, TODAY);
    const twice = await deferTask(db, once, TODAY);
    expect(twice).toMatchObject({ planned_date: shiftDay(TODAY, 1), defer_count: 2 });
    const item = await createWorkItem(db, { module_id: mod.id, title: "Proje" });
    await skipToday(db, TODAY, item.id);
    await skipToday(db, TODAY, item.id);
    expect(storedPlan(await day(TODAY)).skipped).toEqual([item.id]);
    const { input } = await plan();
    expect(input.skipped).toEqual([item.id]);
  });

  it("forgets the days planned during an absence", async () => {
    const mod = await makeModule(db);
    const missed = await createTask(db, {
      module_id: mod.id,
      title: "Planlanmıştı",
      planned_date: shiftDay(TODAY, -3),
    });
    const later = await createTask(db, {
      module_id: mod.id,
      title: "Sonra",
      planned_date: shiftDay(TODAY, 2),
    });
    await clearPastPlannedDays(db, TODAY);
    const tasks = ok(await db.from("tasks").select("id, planned_date").order("created_at"));
    expect(tasks).toEqual([
      { id: missed.id, planned_date: null },
      { id: later.id, planned_date: shiftDay(TODAY, 2) },
    ]);
  });
});

describe("waiting work", () => {
  it("waits with a follow-up day; the follow-up brings it back or waits more", async () => {
    const mod = await makeModule(db);
    const work = await createTask(db, { module_id: mod.id, title: "Hocadan cevap" });
    const waiting = await waitOnTask(db, work.id, "Hoca", TODAY);
    expect(waiting).toMatchObject({
      status: "waiting",
      waiting_on: "Hoca",
      follow_up_on: shiftDay(TODAY, 3),
    });
    const more = await answerFollowUp(db, work.id, false, shiftDay(TODAY, 3));
    expect(more).toMatchObject({ status: "waiting", follow_up_on: shiftDay(TODAY, 6) });
    const back = await answerFollowUp(db, work.id, true, shiftDay(TODAY, 6));
    expect(back).toMatchObject({ status: "todo", waiting_on: null, follow_up_on: null });
  });
});

describe("the week", () => {
  it("is committed once, its items cut into sittings; without a trigger it stays", async () => {
    const mod = await makeModule(db);
    const item = await createWorkItem(db, {
      module_id: mod.id,
      title: "Rapor",
      effort_total_minutes: 120,
      session_minutes: 60,
      due_at: istanbulInstant(shiftDay(TODAY, 2), "23:59").toISOString(),
    });
    const first = await keepWeek(db, NOW);
    expect(first.action).toEqual({ kind: "commit", reason: "none" });
    expect(first.plan).toMatchObject({
      week_start: weekStart(TODAY),
      committed: [item.id],
      shares: { [item.id]: { minutes: 120, from: 0 } },
      plan_source: "auto",
      life_mode: "normal",
    });
    const sittings = ok(
      await db
        .from("tasks")
        .select("title, est_minutes, status, position")
        .eq("work_item_id", item.id)
        .order("position"),
    );
    expect(sittings).toEqual([
      { title: "Rapor", est_minutes: 60, status: "todo", position: 1 },
      { title: "Rapor", est_minutes: 60, status: "todo", position: 2 },
    ]);
    const again = await keepWeek(db, istanbulInstant(TODAY, "15:00"));
    expect(again.action).toBeNull();
  });

  it("never opens a sitting twice: two open sittings of an item cannot share a place", async () => {
    const mod = await makeModule(db);
    const item = await createWorkItem(db, { module_id: mod.id, title: "Rapor" });
    const sitting = { module_id: mod.id, work_item_id: item.id, title: "Rapor", position: 1 };
    ok(await db.from("tasks").insert(sitting).select().single());
    const again = await db.from("tasks").insert(sitting);
    expect(again.error?.code).toBe("23505");
    // A finished sitting frees its place; sittings without a place (started by hand) never clash.
    await db.from("tasks").update({ status: "done" }).eq("work_item_id", item.id);
    ok(await db.from("tasks").insert(sitting).select().single());
    const loose = { ...sitting, position: null };
    ok(await db.from("tasks").insert([loose, loose]).select());
  });

  it("takes in a new item without touching what was committed", async () => {
    const mod = await makeModule(db);
    const old = await createWorkItem(db, {
      module_id: mod.id,
      title: "Eski",
      effort_total_minutes: 90,
    });
    await keepWeek(db, NOW);
    const before = ok(await db.from("tasks").select("id").eq("work_item_id", old.id));
    // Undated: it joins with one sitting's worth this week.
    const fresh = await createWorkItem(db, {
      module_id: mod.id,
      title: "Yeni",
      effort_total_minutes: 60,
    });
    const result = await keepWeek(db, istanbulInstant(TODAY, "10:00"));
    expect(result.action).toEqual({ kind: "append", items: [fresh.id] });
    expect(result.plan!.committed).toEqual([old.id, fresh.id]);
    expect(ok(await db.from("tasks").select("id").eq("work_item_id", old.id))).toEqual(before);
    expect(ok(await db.from("tasks").select("est_minutes").eq("work_item_id", fresh.id))).toEqual([
      { est_minutes: 45 },
    ]);
  });

  it("is committed again when the life mode changes, and drops sittings no longer needed", async () => {
    const mod = await makeModule(db);
    await db
      .from("modules")
      .update({ mode_behavior: { busy: { weightMultiplier: 0.5, floorMultiplier: 0.5 } } })
      .eq("id", mod.id);
    const item = await createWorkItem(db, {
      module_id: mod.id,
      title: "Tarihsiz",
      effort_total_minutes: 300,
    });
    await keepWeek(db, NOW);
    await setLifeMode(db, { mode: "busy", from: TODAY, to: shiftDay(TODAY, 4) }, []);
    const result = await keepWeek(db, istanbulInstant(TODAY, "11:00"));
    expect(result.action).toEqual({ kind: "commit", reason: "mode_changed" });
    expect(result.plan).toMatchObject({ life_mode: "busy" });
    const open = ok(
      await db.from("tasks").select("status").eq("work_item_id", item.id).eq("status", "todo"),
    );
    expect(open.length).toBeGreaterThan(0);
  });

  it("keeps one learned value per key", async () => {
    await saveStats(db, [{ key: "capacity:home", value: 0.5, sample_size: 3 }]);
    await saveStats(db, [{ key: "capacity:home", value: 0.6, sample_size: 6 }]);
    expect(ok(await db.from("planner_stats").select("key, value, sample_size"))).toEqual([
      { key: "capacity:home", value: 0.6, sample_size: 6 },
    ]);
  });
});

describe("life modes", () => {
  it("one mode per day: a new period cuts the ones it overlaps", async () => {
    await setLifeMode(db, { mode: "busy", from: "2026-11-16", to: "2026-11-29" }, []);
    await setLifeMode(
      db,
      { mode: "holiday", from: "2026-11-20", to: "2026-11-22" },
      await listLifeModes(db),
    );
    const periods = (await listLifeModes(db)).map((row) => [row.mode, row.starts_on, row.ends_on]);
    expect(periods).toEqual([
      ["busy", "2026-11-16", "2026-11-19"],
      ["holiday", "2026-11-20", "2026-11-22"],
      ["busy", "2026-11-23", "2026-11-29"],
    ]);
    // "Normal" clears its range.
    await setLifeMode(
      db,
      { mode: "normal", from: "2026-11-16", to: "2026-11-22" },
      await listLifeModes(db),
    );
    expect((await listLifeModes(db)).map((row) => [row.mode, row.starts_on, row.ends_on])).toEqual([
      ["busy", "2026-11-23", "2026-11-29"],
    ]);
  });
});
