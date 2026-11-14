import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { endSession, startSession, startSessionIfIdle } from "@/core/data/sessions";
import { createRhythm, createTask } from "@/core/data/work";
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
