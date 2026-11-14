import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRegistry } from "@/core/contract/registry";
import { endSessionClosing, goOnInChain } from "@/core/data/session-events";
import { endSession, startSession, startSessionIfIdle } from "@/core/data/sessions";
import { createRhythm, createTask } from "@/core/data/work";
import { loadPlanRows } from "@/core/data/keep";
import { buildPlan, planInput } from "@/core/planner";
import { chainsOf } from "@/core/today/chain";
import { dayKey, istanbulInstant } from "@/lib/date";
import { seedChains } from "../../scripts/demo-chains";
import { anonDb, makeModule, ok, ownerDb, wipe } from "./helpers";

// Ç3f: the chain's own start (start_session_if_idle; docs/06-modul-sozlesmesi.md, "Diziler"):
// the next work of a chain, or its first after a waking told from outside, starts only if no
// session is open and none has started since. Two devices doing it at once start one session.

const db = ownerDb();
const phone = ownerDb();

beforeEach(wipe);
afterAll(wipe);

async function chain() {
  const mod = await makeModule(db);
  const teeth = await createTask(db, { module_id: mod.id, title: "Diş", est_minutes: 10 });
  const shower = await createTask(db, { module_id: mod.id, title: "Duş", est_minutes: 15 });
  const neck = await createRhythm(db, {
    module_id: mod.id,
    title: "Boyun",
    target_count: 1,
    period: "day",
    est_minutes: 10,
  });
  return { mod, teeth, shower, neck };
}

const openSessions = async () => ok(await db.from("sessions").select("*").is("ended_at", null));

describe("start_session_if_idle", () => {
  it("starts the work through the usual start when nothing has started since", async () => {
    const { teeth, shower } = await chain();
    const first = await startSession(db, { taskId: teeth.id });
    const ended = await endSession(db, first.id, "done");
    const next = await startSessionIfIdle(db, ended.ended_at!, { taskId: shower.id });
    expect(next).toMatchObject({ task_id: shower.id, ended_at: null });
    // The task is running, as with Başla.
    expect(ok(await db.from("tasks").select("status").eq("id", shower.id).single()).status).toBe(
      "doing",
    );
  });

  it("starts nothing while a session is open, or when one started since", async () => {
    const { teeth, shower, neck } = await chain();
    const first = await startSession(db, { taskId: teeth.id });
    expect(await startSessionIfIdle(db, first.started_at, { taskId: shower.id })).toBeNull();
    expect((await openSessions()).map((row) => row.id)).toEqual([first.id]);

    const ended = await endSession(db, first.id, "done");
    // The user started something else by hand after it ended.
    const own = await startSession(db, { rhythmId: neck.id });
    await endSession(db, own.id, "stopped");
    expect(await startSessionIfIdle(db, ended.ended_at!, { taskId: shower.id })).toBeNull();
    expect(await openSessions()).toEqual([]);
    expect(ok(await db.from("tasks").select("status").eq("id", shower.id).single()).status).toBe(
      "todo",
    );
  });

  it("two devices finishing at once start one session (race)", async () => {
    const { mod } = await chain();
    const doubled: string[] = [];
    for (let round = 0; round < 15; round++) {
      const current = await createTask(db, {
        module_id: mod.id,
        title: `Diş ${round}`,
        est_minutes: 10,
      });
      const next = await createTask(db, {
        module_id: mod.id,
        title: `Duş ${round}`,
        est_minutes: 10,
      });
      const session = await startSession(db, { taskId: current.id });
      // Both screens press Bitti; each then starts the chain's next work.
      const both = await Promise.all(
        [db, phone].map(async (client) => {
          const ended = await endSession(client, session.id, "done");
          return startSessionIfIdle(client, ended.ended_at!, { taskId: next.id });
        }),
      );
      const started = both.filter(Boolean);
      const open = await openSessions();
      if (started.length !== 1 || open.length !== 1) {
        doubled.push(`round ${round}: ${started.length} started, ${open.length} open`);
      }
      const all = ok(await db.from("sessions").select("id").eq("task_id", next.id));
      if (all.length !== 1) doubled.push(`round ${round}: ${all.length} sessions on the next work`);
      for (const row of open) await endSession(db, row.id, "stopped");
    }
    expect(doubled).toEqual([]);
  });

  it("needs a moment and planned work, and a signed-in user", async () => {
    const { teeth } = await chain();
    const noSince = await db.rpc("start_session_if_idle", {
      p_since: null as unknown as string,
      p_task_id: teeth.id,
    });
    expect(noSince.error?.code).toBe("22023");
    const nothing = await db.rpc("start_session_if_idle", { p_since: new Date().toISOString() });
    expect(nothing.error?.code).toBe("22023");
    const anon = await anonDb().rpc("start_session_if_idle", {
      p_since: new Date().toISOString(),
      p_task_id: teeth.id,
    });
    expect(anon.error).not.toBeNull();
    expect(await openSessions()).toEqual([]);
  });
});

describe("going on from an end (Ç3f step audit)", () => {
  const told = { db, registry: createRegistry([]) };

  it("goes on only from an end this call made: not from a session stopped on the other screen", async () => {
    const { teeth, shower } = await chain();
    const session = await startSession(db, { taskId: teeth.id });
    // The phone stops it; the second screen, not caught up yet, then says Bitti.
    await endSession(phone, session.id, "stopped");
    const late = await endSessionClosing(told, session.id, "done");
    expect(late.closed).toBe(false);
    expect(await goOnInChain(told, late, { taskId: shower.id })).toBeNull();
    expect(await openSessions()).toEqual([]);
    // The stop stands: the task went back to the pool, it is not done.
    expect(ok(await db.from("tasks").select("status").eq("id", teeth.id).single()).status).toBe(
      "todo",
    );

    const again = await startSession(db, { taskId: teeth.id });
    const own = await endSessionClosing(told, again.id, "done");
    expect(own.closed).toBe(true);
    expect(await goOnInChain(told, own, { taskId: shower.id })).toMatchObject({
      task_id: shower.id,
    });
  });

  it("a next work that cannot start leaves the end standing, without an error", async () => {
    const { teeth, shower } = await chain();
    const session = await startSession(db, { taskId: teeth.id });
    // The next one was finished on the other screen meanwhile.
    await db
      .from("tasks")
      .update({ status: "done", done_at: new Date().toISOString() })
      .eq("id", shower.id);
    const ended = await endSessionClosing(told, session.id, "done");
    await expect(goOnInChain(told, ended, { taskId: shower.id })).resolves.toBeNull();
    expect(ok(await db.from("tasks").select("status").eq("id", teeth.id).single()).status).toBe(
      "done",
    );
    expect(await openSessions()).toEqual([]);
  });
});

describe("the sample chains (scripts/demo-chains.ts)", () => {
  it("make one wake chain and one bed chain of two modules, in the shared order", async () => {
    const now = new Date();
    const summary = await seedChains(db, now);
    expect(summary.chain_work).toBe(5);
    const date = dayKey(now);
    // A fresh account's settings: the day's frame is on by default.
    ok(await db.from("settings").insert({}).select().single());
    ok(
      await db
        .from("days")
        .insert({ date, woke_at: istanbulInstant(date, "07:00").toISOString() })
        .select()
        .single(),
    );
    const rows = await loadPlanRows(db, now);
    const input = planInput(rows, {
      date,
      now: istanbulInstant(date, "07:05"),
      context: "desk",
    });
    const chains = chainsOf(input, buildPlan(input));
    const slug = (moduleId: string) => rows.modules.find((row) => row.id === moduleId)?.slug;
    expect(chains.wake?.rows.map((row) => `${row.title} (${slug(row.moduleId)})`)).toEqual([
      "Diş ve su (deneme)",
      "Boyun hareketleri (sablon-kopya)",
      "Duş ve hazırlık (deneme)",
    ]);
    expect(chains.bed?.rows.map((row) => `${row.title} (${slug(row.moduleId)})`)).toEqual([
      "Akşam esnemesi (sablon-kopya)",
      "Akşam diş (deneme)",
    ]);
  });
});
