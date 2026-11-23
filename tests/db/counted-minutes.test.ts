import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ModuleDefinition } from "@/core/contract/types";
import type { AppEvent } from "@/core/types";
import { createRegistry } from "@/core/contract/registry";
import { recordBed, undoSceneBed } from "@/core/data/frame";
import { measureOutcome } from "@/core/data/outcome";
import { endSessionClosing } from "@/core/data/session-events";
import { endSession } from "@/core/data/sessions";
import { dayKey } from "@/lib/date";
import { adminDb, makeModule, ok, ownerDb, wipe } from "./helpers";

// Okul çekirdek A (docs/06-modul-sozlesmesi.md, "Sahne", controls): a scene tells, as the session
// closes, how many minutes counted (a pomodoro's focus, breaks out). The remaining effort and the
// outcome the module learns from use them; the session's range stays the wall-clock one. A value
// outside 0 .. the elapsed minutes is not kept; a scene that tells nothing counts as before.

const db = ownerDb();
const heard: AppEvent[] = [];
const view = () => null;
const listening: ModuleDefinition = {
  slug: "dinleyen",
  name: "Dinleyen",
  kind: "lifelong",
  color: "#2563eb",
  chip: async () => ({ text: "", health: "ok" }),
  intake: [],
  emits: [],
  on: {
    "core.session_ended": async (event) => {
      heard.push(event);
    },
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

/** A work item of 4 hours and a session on it that started `minutes` ago. */
async function sitting(minutes: number) {
  const mod = await makeModule(db, "dinleyen", "Dinleyen");
  const item = ok(
    await db
      .from("work_items")
      .insert({
        module_id: mod.id,
        key: "odev",
        title: "Ödev",
        effort_total_minutes: 240,
        session_minutes: 90,
      })
      .select()
      .single(),
  );
  const started = ok(await db.rpc("start_session", { p_work_item_id: item.id }));
  const startedAt = new Date(Date.now() - minutes * 60_000).toISOString();
  ok(
    await adminDb()
      .from("sessions")
      .update({ started_at: startedAt })
      .eq("id", started.id)
      .select("id")
      .single(),
  );
  return { mod, item, session: started };
}

const done = async (itemId: string) =>
  ok(await db.from("work_items").select("*").eq("id", itemId).single()).effort_done_minutes;

describe("the minutes a scene counted", () => {
  it("a session with breaks: the remaining effort counts the focus, the range stays the clock's", async () => {
    const { item, session } = await sitting(60);
    const ended = await endSession(db, session.id, "done", 45);
    expect(ended.counted_minutes).toBe(45);
    expect(await done(item.id)).toBe(45);
    // The session's own range is the wall clock: an hour.
    const span = (Date.parse(ended.ended_at!) - Date.parse(ended.started_at)) / 60_000;
    expect(Math.round(span)).toBe(60);
  });

  it("a value outside 0 .. the elapsed minutes is not kept: the elapsed time counts", async () => {
    const over = await sitting(30);
    const ended = await endSession(db, over.session.id, "stopped", 31 + 5);
    expect(ended.counted_minutes).toBeNull();
    expect(await done(over.item.id)).toBe(30);

    await wipe();
    const below = await sitting(30);
    const negative = ok(
      await db.rpc("end_session", {
        p_session_id: below.session.id,
        p_outcome: "stopped",
        p_counted: -1,
      }),
    );
    expect(negative.counted_minutes).toBeNull();
    expect(await done(below.item.id)).toBe(30);
  });

  it("zero is a value: a session spent all on breaks adds no effort", async () => {
    const { item, session } = await sitting(20);
    const ended = await endSession(db, session.id, "stopped", 0);
    expect(ended.counted_minutes).toBe(0);
    expect(await done(item.id)).toBe(0);
  });

  it("a scene that tells nothing counts as before", async () => {
    const { item, session } = await sitting(25);
    const ended = await endSession(db, session.id, "done");
    expect(ended.counted_minutes).toBeNull();
    expect(await done(item.id)).toBe(25);
  });

  it("the module hears the counted minutes beside the elapsed ones, and learns from them", async () => {
    const { item, session } = await sitting(50);
    await endSessionClosing(told, session.id, "done", "done", 35);
    const ended = heard.find((event) => event.type === "core.session_ended");
    expect(ended?.payload).toMatchObject({ minutes: 50, counted: 35, result: "done" });
    // The outcome the module learns from (onOutcome's spentMinutes) is the counted time.
    const row = ok(await db.from("work_items").select("*").eq("id", item.id).single());
    const outcome = await measureOutcome(db, row, "done");
    expect(outcome.spentMinutes).toBe(35);
  });

  it("taking back a scene's bedtime takes the counted minutes off, and the session runs without them", async () => {
    const { item, session } = await sitting(40);
    await endSessionClosing(told, session.id, "done", "done", 30);
    expect(await done(item.id)).toBe(30);
    await recordBed(db, dayKey(new Date()), new Date(), session.id);
    expect(await undoSceneBed(db, session.id)).toBe("undone");
    expect(await done(item.id)).toBe(0);
    const again = ok(await db.from("sessions").select("*").eq("id", session.id).single());
    expect(again).toMatchObject({ ended_at: null, counted_minutes: null });
  });
});
