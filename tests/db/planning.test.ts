import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { keepWeek, loadPlanRows } from "@/core/data/keep";
import {
  answerFollowUp,
  clearPastPlannedDays,
  closeDay,
  deferTask,
  listLifeModes,
  planDay,
  saveDayPlan,
  saveStats,
  saveWeekPlan,
  setLifeMode,
  skipToday,
  touchDay,
  waitOnTask,
} from "@/core/data/planning";
import { closeUnanswered, confirmSession, startSession } from "@/core/data/sessions";
import { createTask, createWorkItem, reopenTask } from "@/core/data/work";
import { buildPlan, planInput, storedPlan, tomorrowInput } from "@/core/planner";
import { dayKey, istanbulInstant, shiftDay, weekStart } from "@/lib/date";
import { makeModule, ok, ownerDb, strangerDb, wipe } from "./helpers";

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
  it("gets the engine's plan once, with the day's type and mode; a plan written meanwhile stays", async () => {
    const mod = await makeModule(db);
    const work = await createTask(db, { module_id: mod.id, title: "Rapor" });
    const first = await plan();
    const row = await planDay(db, { plan: first.plan, day: first.input });
    expect(row).toMatchObject({
      plan_source: "auto",
      top3: [work.id],
      day_type: "home",
      life_mode: "normal",
      started_at: null,
    });
    // The whole day's slots (08:00–19:00), not what is left of it at 09:00.
    expect(storedPlan(row).slotMinutes).toBeGreaterThan(600);
    await db.from("days").update({ plan_source: "closing", top3: [] }).eq("id", row.id);
    const again = await planDay(db, { plan: first.plan, day: first.input });
    expect(again).toMatchObject({ plan_source: "closing", top3: [] });
  });

  it("writes the first touch once", async () => {
    await touchDay(db, TODAY, NOW);
    await touchDay(db, TODAY, istanbulInstant(TODAY, "10:00"));
    expect(Date.parse((await day(TODAY))!.started_at!)).toBe(NOW.getTime());
  });

  it("keeps the day's slot minutes of its first record when the plan is made again", async () => {
    const mod = await makeModule(db);
    await createTask(db, { module_id: mod.id, title: "Okuma" });
    const morning = await plan();
    const first = await planDay(db, { plan: morning.plan, day: morning.input });
    const late = await plan(istanbulInstant(TODAY, "17:00"));
    const again = await saveDayPlan(db, { plan: late.plan, day: late.input, source: "auto" });
    expect(storedPlan(again).slotMinutes).toBe(storedPlan(first).slotMinutes);
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
      tomorrow: { plan: buildPlan(input), day: input },
      note: "Yarın erken",
    });
    expect(await day(shiftDay(TODAY, 1))).toMatchObject({
      plan_source: "closing",
      top3: [work.id],
    });
    const today = await day(TODAY);
    expect(today).toMatchObject({ closing_note: "Yarın erken" });
    expect(today!.closed_at).not.toBeNull();
    // The next morning the engine does not replace the closing's plan.
    const morning = istanbulInstant(shiftDay(TODAY, 1), "08:30");
    const next = await plan(morning);
    const kept = await planDay(db, { plan: next.plan, day: next.input });
    expect(kept).toMatchObject({ plan_source: "closing", top3: [work.id] });
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

  it("a sitting put off takes its item's other sittings off today's plan", async () => {
    const mod = await makeModule(db);
    const item = await createWorkItem(db, {
      module_id: mod.id,
      title: "Tez",
      effort_total_minutes: 180,
      session_minutes: 60,
    });
    await keepWeek(db, NOW);
    const before = await plan();
    const sittings = before.plan.candidates.filter((row) => row.task?.work_item_id === item.id);
    expect(sittings.length).toBeGreaterThan(0);
    await deferTask(db, sittings[0].task!, TODAY);
    const after = await plan();
    expect(after.plan.candidates.filter((row) => row.task?.work_item_id === item.id)).toEqual([]);
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

describe("Geri al", () => {
  it("on a sitting finished with its item opens the item again", async () => {
    const mod = await makeModule(db);
    const item = await createWorkItem(db, {
      module_id: mod.id,
      title: "Tez",
      effort_total_minutes: 120,
    });
    const sitting = await createTask(db, {
      module_id: mod.id,
      title: "Tez",
      work_item_id: item.id,
    });
    await db
      .from("tasks")
      .update({ status: "done", done_at: NOW.toISOString() })
      .eq("id", sitting.id);
    await db.from("work_items").update({ status: "done" }).eq("id", item.id);
    await reopenTask(db, sitting.id);
    expect(ok(await db.from("work_items").select("status").eq("id", item.id).single())).toEqual({
      status: "active",
    });
    expect(ok(await db.from("tasks").select("status").eq("id", sitting.id).single())).toEqual({
      status: "todo",
    });
  });
});

describe("waiting work", () => {
  it("waits with a follow-up day; the follow-up brings it back or waits more", async () => {
    const mod = await makeModule(db);
    const work = await createTask(db, { module_id: mod.id, title: "Hocadan cevap" });
    const waiting = await waitOnTask(db, work, "Hoca", TODAY);
    expect(waiting).toMatchObject({
      status: "waiting",
      waiting_on: "Hoca",
      follow_up_on: shiftDay(TODAY, 3),
    });
    const more = await answerFollowUp(db, work, false, shiftDay(TODAY, 3));
    expect(more).toMatchObject({ status: "waiting", follow_up_on: shiftDay(TODAY, 6) });
    const back = await answerFollowUp(db, work, true, shiftDay(TODAY, 6));
    expect(back).toMatchObject({ status: "todo", waiting_on: null, follow_up_on: null });
  });

  it("a waiting sitting holds its whole item, and its answer frees it", async () => {
    const mod = await makeModule(db);
    const item = await createWorkItem(db, {
      module_id: mod.id,
      title: "Anket",
      effort_total_minutes: 120,
    });
    const sitting = await createTask(db, {
      module_id: mod.id,
      title: "Anket",
      work_item_id: item.id,
    });
    await waitOnTask(db, sitting, "Danışman", TODAY);
    expect(ok(await db.from("work_items").select("status").eq("id", item.id).single())).toEqual({
      status: "waiting",
    });
    await answerFollowUp(db, sitting, true, shiftDay(TODAY, 3));
    expect(ok(await db.from("work_items").select("status").eq("id", item.id).single())).toEqual({
      status: "active",
    });
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

  it("is committed again when asked, and follows the AI's advice within the rules", async () => {
    const mod = await makeModule(db);
    const a = await createWorkItem(db, { module_id: mod.id, title: "A", effort_total_minutes: 90 });
    const b = await createWorkItem(db, { module_id: mod.id, title: "B", effort_total_minutes: 90 });
    await keepWeek(db, NOW);
    const asked = await keepWeek(db, istanbulInstant(TODAY, "12:00"), {
      force: true,
      advise: async () => ({ committed: [b.id], drop: [a.id], reasons: { [b.id]: "B öne." } }),
    });
    expect(asked.action).toEqual({ kind: "commit", reason: "none" });
    expect(asked.plan).toMatchObject({
      committed: [b.id],
      plan_source: "ai",
      reasons: { [b.id]: "B öne." },
    });
    // A's sitting is no longer needed this week.
    const open = ok(
      await db.from("tasks").select("work_item_id").eq("status", "todo").order("work_item_id"),
    );
    expect(open.every((row) => row.work_item_id === b.id)).toBe(true);
    // Advice that fails is no advice: the engine commits on its own.
    const failed = await keepWeek(db, istanbulInstant(TODAY, "13:00"), {
      force: true,
      advise: async () => {
        throw new Error("down");
      },
    });
    expect(failed.plan).toMatchObject({ plan_source: "auto" });
  });

  it("learns from measured sessions when the week is new, and commits on what it learned", async () => {
    const mod = await makeModule(db);
    // Five finished sittings of 30 minutes' estimate that took 60: the multiplier is 2.
    for (let n = 0; n < 5; n++) {
      const day = shiftDay(TODAY, -(n + 1));
      const task = await createTask(db, { module_id: mod.id, title: `Ödev ${n}`, est_minutes: 30 });
      const start = istanbulInstant(day, "10:00");
      ok(
        await db
          .from("sessions")
          .insert({
            task_id: task.id,
            module_id: mod.id,
            started_at: start.toISOString(),
            ended_at: new Date(start.getTime() + 60 * 60_000).toISOString(),
          })
          .select(),
      );
      await db
        .from("tasks")
        .update({ status: "done", done_at: start.toISOString() })
        .eq("id", task.id);
    }
    await keepWeek(db, NOW);
    expect(
      ok(
        await db
          .from("planner_stats")
          .select("key, value, sample_size")
          .eq("key", `est_multiplier:${mod.slug}:task`),
      ),
    ).toEqual([{ key: `est_multiplier:${mod.slug}:task`, value: 2, sample_size: 5 }]);
    const { input } = await plan();
    expect(input.stats).toContainEqual({
      key: `est_multiplier:${mod.slug}:task`,
      value: 2,
      sample_size: 5,
    });
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

describe("a session nobody answered for", () => {
  it("is closed at its estimate, unmeasured; the task goes back, the item counts the estimate", async () => {
    const mod = await makeModule(db);
    const item = await createWorkItem(db, {
      module_id: mod.id,
      title: "Tez",
      effort_total_minutes: 300,
    });
    const sitting = await createTask(db, {
      module_id: mod.id,
      title: "Tez",
      work_item_id: item.id,
      est_minutes: 40,
    });
    const session = await startSession(db, { taskId: sitting.id });
    const start = new Date(Date.now() - 3 * 60 * 60_000);
    await db.from("sessions").update({ started_at: start.toISOString() }).eq("id", session.id);
    const closed = await closeUnanswered(db, session.id);
    expect(closed.measured).toBe(false);
    expect(Date.parse(closed.ended_at!) - start.getTime()).toBe(40 * 60_000);
    expect(ok(await db.from("tasks").select("status").eq("id", sitting.id).single())).toEqual({
      status: "todo",
    });
    expect(
      ok(await db.from("work_items").select("effort_done_minutes").eq("id", item.id).single()),
    ).toEqual({
      effort_done_minutes: 40,
    });
    // Closing it again changes nothing.
    expect((await closeUnanswered(db, session.id)).ended_at).toBe(closed.ended_at);
  });

  it("keeps 'devam' on the session for every screen", async () => {
    const mod = await makeModule(db);
    const task = await createTask(db, { module_id: mod.id, title: "Okuma" });
    const session = await startSession(db, { taskId: task.id });
    await confirmSession(db, session.id, NOW);
    expect(
      ok(await db.from("sessions").select("confirmed_at").eq("id", session.id).single())
        .confirmed_at,
    ).not.toBeNull();
  });
});

describe("the week's sittings and a sitting started meanwhile (Ç3b audit)", () => {
  it("a sitting the user started after the screen read its list is counted: no second one", async () => {
    const mod = await makeModule(db);
    const item = await createWorkItem(db, {
      module_id: mod.id,
      title: "Rapor",
      effort_total_minutes: 90,
    });
    // The screen read the tasks (none yet); then the user started the item by hand.
    const stale: never[] = [];
    await startSession(db, { workItemId: item.id });
    const week = weekStart(dayKey(new Date()));
    await saveWeekPlan(
      db,
      {
        weekStart: week,
        committed: [{ itemId: item.id, minutes: 45, sittings: [45], required: false, from: 0 }],
        moduleBudgets: {},
        capacityMinutes: 600,
        capacityByDay: {},
        left: [],
        lifeMode: "normal",
        source: "auto",
        reasons: {},
      },
      { tasks: stale, items: [item] },
    );
    const sittings = ok(await db.from("tasks").select("*").eq("work_item_id", item.id));
    expect(sittings.map((task) => task.status)).toEqual(["doing"]);
  });

  it("Başla on an item and the keeper writing its sittings at the same moment leave one open sitting each round (Ç3c)", async () => {
    const mod = await makeModule(db);
    const week = weekStart(dayKey(new Date()));
    const doubled: string[] = [];
    // Twenty rounds, each with a fresh item: the two writes leave together, so they meet in
    // the database in either order (and, before the fix, in between).
    for (let round = 0; round < 20; round++) {
      const item = await createWorkItem(db, {
        module_id: mod.id,
        title: `Rapor ${round}`,
        effort_total_minutes: 45,
      });
      await Promise.all([
        startSession(db, { workItemId: item.id }),
        saveWeekPlan(
          db,
          {
            weekStart: week,
            committed: [{ itemId: item.id, minutes: 45, sittings: [45], required: false, from: 0 }],
            moduleBudgets: {},
            capacityMinutes: 600,
            capacityByDay: {},
            left: [],
            lifeMode: "normal",
            source: "auto",
            reasons: {},
          },
          { tasks: [], items: [item] },
        ),
      ]);
      const open = ok(
        await db
          .from("tasks")
          .select("id")
          .eq("work_item_id", item.id)
          .in("status", ["todo", "doing", "waiting"]),
      );
      if (open.length !== 1) doubled.push(`round ${round}: ${open.length} open sittings`);
    }
    expect(doubled).toEqual([]);
  });
});

describe("the day's frame columns and the sittings function (Ç3c)", () => {
  it("a sitting started by its own id while the keeper trims the item is never dropped under its session (Ç3c audit)", async () => {
    const mod = await makeModule(db);
    const lost: string[] = [];
    for (let round = 0; round < 15; round++) {
      const item = await createWorkItem(db, {
        module_id: mod.id,
        title: `Rapor ${round}`,
        effort_total_minutes: 135,
      });
      const first = await db.rpc("save_week_sittings", {
        p_committed: [{ item_id: item.id, sittings: [45, 45, 45] }],
      });
      expect(first.error).toBeNull();
      const sittings = ok(
        await db.from("tasks").select("id, position").eq("work_item_id", item.id).order("position"),
      );
      const last = sittings[sittings.length - 1];
      // The keeper trims the item to one sitting while the user starts its last one.
      // Whichever comes first: the keeper drops the sitting and the start is refused, or the
      // start wins and the keeper keeps it. Never a session on a dropped sitting.
      const [start] = await Promise.all([
        startSession(db, { taskId: last.id }).then(
          () => "started",
          (error: Error) => error.message,
        ),
        db.rpc("save_week_sittings", { p_committed: [{ item_id: item.id, sittings: [45] }] }),
      ]);
      const started = ok(await db.from("tasks").select("status").eq("id", last.id).single());
      if (start === "started" && started.status !== "doing") {
        lost.push(`round ${round}: ${started.status}`);
      }
      if (start !== "started") expect(start).toBe("this task is closed");
      const open = await db.from("sessions").select("id").is("ended_at", null).maybeSingle();
      if (open.data)
        await db.rpc("end_session", { p_session_id: open.data.id, p_outcome: "stopped" });
    }
    expect(lost).toEqual([]);
  });

  it("a new settings row has the user's frame; the value must be an object or empty", async () => {
    const row = ok(await db.from("settings").insert({}).select().single());
    expect(row.day_frame).toEqual({
      wake: ["06:00", "09:00"],
      bed: ["22:00", "01:00"],
      sleep_minutes: 480,
    });
    const bad = await db.from("settings").update({ day_frame: "06:00" }).eq("id", row.id);
    expect(bad.error).not.toBeNull();
    const off = await db.from("settings").update({ day_frame: null }).eq("id", row.id);
    expect(off.error).toBeNull();
  });

  it("a day keeps its waking and bedtime, estimated or not", async () => {
    const row = ok(
      await db
        .from("days")
        .insert({
          date: TODAY,
          woke_at: istanbulInstant(TODAY, "07:10").toISOString(),
          woke_estimated: true,
          expected_bed: "00:30",
        })
        .select()
        .single(),
    );
    expect(row).toMatchObject({ woke_estimated: true, expected_bed: "00:30:00", bed_at: null });
  });

  it("another account's call opens and drops nothing of the owner's sittings", async () => {
    const mod = await makeModule(db);
    const item = await createWorkItem(db, {
      module_id: mod.id,
      title: "Rapor",
      effort_total_minutes: 90,
    });
    const stranger = strangerDb();
    const result = await stranger.rpc("save_week_sittings", {
      p_committed: [{ item_id: item.id, sittings: [45, 45] }],
    });
    expect(result.error).toBeNull();
    const sittings = ok(await db.from("tasks").select("id").eq("work_item_id", item.id));
    expect(sittings).toEqual([]);
  });

  it("opens the share's sittings once; a second call adds none and drops the extra ones", async () => {
    const mod = await makeModule(db);
    const item = await createWorkItem(db, {
      module_id: mod.id,
      title: "Rapor",
      effort_total_minutes: 135,
    });
    const call = (sittings: number[]) =>
      db.rpc("save_week_sittings", { p_committed: [{ item_id: item.id, sittings }] });
    expect((await call([45, 45, 45])).error).toBeNull();
    expect((await call([45, 45, 45])).error).toBeNull();
    let open = ok(
      await db
        .from("tasks")
        .select("position, est_minutes, status")
        .eq("work_item_id", item.id)
        .eq("status", "todo")
        .order("position"),
    );
    expect(open.map((task) => task.position)).toEqual([1, 2, 3]);
    expect((await call([45])).error).toBeNull();
    open = ok(
      await db
        .from("tasks")
        .select("position, est_minutes, status")
        .eq("work_item_id", item.id)
        .eq("status", "todo"),
    );
    expect(open.map((task) => task.position)).toEqual([1]);
  });
});
