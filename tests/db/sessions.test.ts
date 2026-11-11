import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { adminDb, makeModule, ok, ownerDb, wipe } from "./helpers";

// Sessions and the limits around tasks, against the real database, signed in like the app.

const db = ownerDb();

beforeEach(wipe);
afterAll(wipe);

/** Moves a session's start into the past, as if the clock had been running. */
async function backdate(sessionId: string, minutes: number) {
  const startedAt = new Date(Date.now() - minutes * 60_000).toISOString();
  ok(
    await adminDb()
      .from("sessions")
      .update({ started_at: startedAt })
      .eq("id", sessionId)
      .select("id")
      .single(),
  );
}

describe("a task is one sitting", () => {
  it("refuses a task longer than 90 minutes, and shorter than 5", async () => {
    const mod = await makeModule(db);
    const long = await db
      .from("tasks")
      .insert({ module_id: mod.id, title: "Rapor", est_minutes: 91 });
    expect(long.error?.code).toBe("23514");
    const short = await db
      .from("tasks")
      .insert({ module_id: mod.id, title: "Rapor", est_minutes: 4 });
    expect(short.error?.code).toBe("23514");

    const edge = ok(
      await db
        .from("tasks")
        .insert({ module_id: mod.id, title: "Rapor", est_minutes: 90 })
        .select()
        .single(),
    );
    expect(edge.est_minutes).toBe(90);

    // Editing an existing task past the limit is refused as well.
    const stretched = await db.from("tasks").update({ est_minutes: 120 }).eq("id", edge.id);
    expect(stretched.error?.code).toBe("23514");
  });

  it("lets a work item carry the longer effort instead", async () => {
    const mod = await makeModule(db);
    const item = ok(
      await db
        .from("work_items")
        .insert({
          module_id: mod.id,
          title: "Rapor",
          effort_total_minutes: 240,
          session_minutes: 60,
        })
        .select()
        .single(),
    );
    expect(item.effort_total_minutes).toBe(240);
    const tooLong = await db.from("work_items").update({ session_minutes: 120 }).eq("id", item.id);
    expect(tooLong.error?.code).toBe("23514");
  });

  it("keeps importance between 1 and 4 and refuses an empty title", async () => {
    const mod = await makeModule(db);
    const high = await db.from("tasks").insert({ module_id: mod.id, title: "x", importance: 5 });
    expect(high.error?.code).toBe("23514");
    const blank = await db.from("tasks").insert({ module_id: mod.id, title: "   " });
    expect(blank.error?.code).toBe("23514");
  });
});

describe("sessions", () => {
  it("Başla then Bitti leaves one session record and a finished task", async () => {
    const mod = await makeModule(db);
    const task = ok(
      await db.from("tasks").insert({ module_id: mod.id, title: "HW2" }).select().single(),
    );

    const started = ok(await db.rpc("start_session", { p_task_id: task.id }));
    expect(started.task_id).toBe(task.id);
    expect(started.module_id).toBe(mod.id);
    expect(started.ended_at).toBeNull();
    expect(ok(await db.from("tasks").select("status").eq("id", task.id).single()).status).toBe(
      "doing",
    );

    await backdate(started.id, 25);
    const ended = ok(await db.rpc("end_session", { p_session_id: started.id }));
    expect(ended.ended_at).not.toBeNull();

    const sessions = ok(await db.from("sessions").select("*"));
    expect(sessions).toHaveLength(1);
    const minutes =
      (Date.parse(sessions[0].ended_at!) - Date.parse(sessions[0].started_at)) / 60_000;
    expect(Math.round(minutes)).toBe(25);

    const after = ok(await db.from("tasks").select("status, done_at").eq("id", task.id).single());
    expect(after.status).toBe("done");
    expect(after.done_at).toBe(ended.ended_at);
  });

  it("cannot hold two open sessions: the table itself refuses a second one", async () => {
    const mod = await makeModule(db);
    ok(await db.from("sessions").insert({ module_id: mod.id, title: "ilk" }).select().single());
    const second = await db.from("sessions").insert({ module_id: mod.id, title: "ikinci" });
    expect(second.error?.code).toBe("23505");

    const open = ok(await db.from("sessions").select("id").is("ended_at", null));
    expect(open).toHaveLength(1);
  });

  it("starting something else stops what was running", async () => {
    const mod = await makeModule(db);
    const first = ok(
      await db.from("tasks").insert({ module_id: mod.id, title: "Birinci" }).select().single(),
    );
    const second = ok(
      await db.from("tasks").insert({ module_id: mod.id, title: "İkinci" }).select().single(),
    );

    const a = ok(await db.rpc("start_session", { p_task_id: first.id }));
    const b = ok(await db.rpc("start_session", { p_task_id: second.id }));

    const open = ok(await db.from("sessions").select("id").is("ended_at", null));
    expect(open.map((row) => row.id)).toEqual([b.id]);
    const closed = ok(await db.from("sessions").select("ended_at").eq("id", a.id).single());
    expect(closed.ended_at).not.toBeNull();

    // The first task was stopped, not finished: it goes back to the pool.
    const tasks = ok(await db.from("tasks").select("id, status"));
    expect(tasks.find((row) => row.id === first.id)?.status).toBe("todo");
    expect(tasks.find((row) => row.id === second.id)?.status).toBe("doing");
  });

  it("stopping without finishing returns the task to the pool", async () => {
    const mod = await makeModule(db);
    const task = ok(
      await db.from("tasks").insert({ module_id: mod.id, title: "HW2" }).select().single(),
    );
    const started = ok(await db.rpc("start_session", { p_task_id: task.id }));
    ok(await db.rpc("end_session", { p_session_id: started.id, p_outcome: "stopped" }));

    const after = ok(await db.from("tasks").select("status, done_at").eq("id", task.id).single());
    expect(after.status).toBe("todo");
    expect(after.done_at).toBeNull();
    expect(ok(await db.from("sessions").select("id").is("ended_at", null))).toHaveLength(0);
  });

  it("ending a session twice changes nothing the second time", async () => {
    const mod = await makeModule(db);
    const task = ok(
      await db.from("tasks").insert({ module_id: mod.id, title: "HW2" }).select().single(),
    );
    const started = ok(await db.rpc("start_session", { p_task_id: task.id }));
    const first = ok(await db.rpc("end_session", { p_session_id: started.id }));
    const second = ok(
      await db.rpc("end_session", { p_session_id: started.id, p_outcome: "stopped" }),
    );
    expect(second.ended_at).toBe(first.ended_at);
    expect(ok(await db.from("tasks").select("status").eq("id", task.id).single()).status).toBe(
      "done",
    );
  });

  it("unplanned work is a session with only a title; a module is optional", async () => {
    const started = ok(await db.rpc("start_session", { p_title: "  Telefon görüşmesi " }));
    expect(started.title).toBe("Telefon görüşmesi");
    expect(started.task_id).toBeNull();
    expect(started.module_id).toBeNull();

    const nothing = await db.rpc("start_session", { p_title: "   " });
    expect(nothing.error).not.toBeNull();

    ok(await db.rpc("end_session", { p_session_id: started.id }));
    expect(ok(await db.from("tasks").select("id"))).toHaveLength(0);
  });

  it("a session on a work item creates its next sitting and counts the minutes", async () => {
    const mod = await makeModule(db);
    const item = ok(
      await db
        .from("work_items")
        .insert({
          module_id: mod.id,
          title: "Midterm hazırlığı",
          effort_total_minutes: 300,
          session_minutes: 60,
          energy: "deep",
          importance: 4,
          due_at: "2026-11-20T10:00:00+03:00",
        })
        .select()
        .single(),
    );

    const started = ok(await db.rpc("start_session", { p_work_item_id: item.id }));
    const task = ok(await db.from("tasks").select("*").eq("id", started.task_id!).single());
    expect(task).toMatchObject({
      work_item_id: item.id,
      module_id: mod.id,
      title: "Midterm hazırlığı",
      est_minutes: 60,
      energy: "deep",
      importance: 4,
      status: "doing",
    });

    await backdate(started.id, 40);
    ok(await db.rpc("end_session", { p_session_id: started.id, p_outcome: "stopped" }));
    const paused = ok(await db.from("work_items").select("*").eq("id", item.id).single());
    expect(paused.effort_done_minutes).toBe(40);
    // The item is not closed on its own.
    expect(paused.status).toBe("active");

    // Starting again continues the same sitting instead of piling up new ones.
    const again = ok(await db.rpc("start_session", { p_work_item_id: item.id }));
    expect(again.task_id).toBe(task.id);
    await backdate(again.id, 20);
    ok(await db.rpc("end_session", { p_session_id: again.id }));

    const done = ok(await db.from("work_items").select("*").eq("id", item.id).single());
    expect(done.effort_done_minutes).toBe(60);
    expect(ok(await db.from("tasks").select("id").eq("work_item_id", item.id))).toHaveLength(1);
  });

  it("an open sitting follows its item's name, deadline, importance and fit; a finished one does not", async () => {
    const mod = await makeModule(db);
    const make = async (title: string) =>
      ok(
        await db
          .from("work_items")
          .insert({
            module_id: mod.id,
            title,
            effort_total_minutes: 300,
            session_minutes: 30,
            importance: 2,
            due_at: "2026-11-20T10:00:00+03:00",
          })
          .select()
          .single(),
      );
    const item = await make("Eski ad");
    const other = await make("Başka kalem");
    const sittingsOf = async (itemId: string) =>
      ok(await db.from("tasks").select("*").eq("work_item_id", itemId).order("created_at"));

    // One finished sitting and one that was started and stopped, on the item; one stopped
    // sitting on the other item.
    const first = ok(await db.rpc("start_session", { p_work_item_id: item.id }));
    ok(await db.rpc("end_session", { p_session_id: first.id }));
    const second = ok(await db.rpc("start_session", { p_work_item_id: item.id }));
    ok(await db.rpc("end_session", { p_session_id: second.id, p_outcome: "stopped" }));
    const third = ok(await db.rpc("start_session", { p_work_item_id: other.id }));
    ok(await db.rpc("end_session", { p_session_id: third.id, p_outcome: "stopped" }));
    expect((await sittingsOf(item.id)).map((task) => task.status)).toEqual(["done", "todo"]);

    ok(
      await db
        .from("work_items")
        .update({
          title: "Yeni ad",
          due_at: "2026-11-12T10:00:00+03:00",
          importance: 4,
          energy: "deep",
          context: "desk",
        })
        .eq("id", item.id)
        .select()
        .single(),
    );
    const [finished, open] = await sittingsOf(item.id);
    expect(open).toMatchObject({
      title: "Yeni ad",
      importance: 4,
      energy: "deep",
      context: "desk",
      status: "todo",
      est_minutes: 30,
    });
    expect(Date.parse(open.due_at!)).toBe(Date.parse("2026-11-12T10:00:00+03:00"));
    // History keeps what it had; the other item's sitting is not touched.
    expect(finished).toMatchObject({ title: "Eski ad", importance: 2, status: "done" });
    expect(Date.parse(finished.due_at!)).toBe(Date.parse("2026-11-20T10:00:00+03:00"));
    expect(await sittingsOf(other.id)).toMatchObject([{ title: "Başka kalem", importance: 2 }]);

    // A deadline and a fit that are taken away again are taken away from the sitting too.
    ok(
      await db
        .from("work_items")
        .update({ due_at: null, energy: null, context: null })
        .eq("id", item.id)
        .select()
        .single(),
    );
    expect((await sittingsOf(item.id))[1]).toMatchObject({
      title: "Yeni ad",
      due_at: null,
      energy: "light",
      context: "any",
    });

    // A change that is none of these (the effort) leaves the sitting as it is.
    const before = (await sittingsOf(item.id))[1];
    ok(
      await db
        .from("work_items")
        .update({ effort_total_minutes: 600 })
        .eq("id", item.id)
        .select()
        .single(),
    );
    expect((await sittingsOf(item.id))[1].updated_at).toBe(before.updated_at);
  });

  it("the sitting of an item without a session length defaults to 45 minutes at most", async () => {
    const mod = await makeModule(db);
    const big = ok(
      await db
        .from("work_items")
        .insert({ module_id: mod.id, title: "Büyük", effort_total_minutes: 600 })
        .select()
        .single(),
    );
    const small = ok(
      await db
        .from("work_items")
        .insert({ module_id: mod.id, title: "Küçük", effort_total_minutes: 20 })
        .select()
        .single(),
    );
    const a = ok(await db.rpc("start_session", { p_work_item_id: big.id }));
    const b = ok(await db.rpc("start_session", { p_work_item_id: small.id }));
    // Effort used up (or exceeded) but the item still open: a plain 45 again, not 5.
    const spent = ok(
      await db
        .from("work_items")
        .insert({
          module_id: mod.id,
          title: "Tükenen",
          effort_total_minutes: 60,
          effort_done_minutes: 80,
        })
        .select()
        .single(),
    );
    const unknown = ok(
      await db
        .from("work_items")
        .insert({ module_id: mod.id, title: "Bilinmeyen" })
        .select()
        .single(),
    );
    const c = ok(await db.rpc("start_session", { p_work_item_id: spent.id }));
    const d = ok(await db.rpc("start_session", { p_work_item_id: unknown.id }));
    const tasks = ok(await db.from("tasks").select("id, est_minutes"));
    expect(tasks.find((row) => row.id === a.task_id)?.est_minutes).toBe(45);
    expect(tasks.find((row) => row.id === b.task_id)?.est_minutes).toBe(20);
    expect(tasks.find((row) => row.id === c.task_id)?.est_minutes).toBe(45);
    expect(tasks.find((row) => row.id === d.task_id)?.est_minutes).toBe(45);
  });

  it("finishing a rhythm session logs the rhythm once", async () => {
    const mod = await makeModule(db);
    const rhythm = ok(
      await db
        .from("rhythms")
        .insert({ module_id: mod.id, title: "Süpürme", target_count: 2, period: "week" })
        .select()
        .single(),
    );
    const stopped = ok(await db.rpc("start_session", { p_rhythm_id: rhythm.id }));
    ok(await db.rpc("end_session", { p_session_id: stopped.id, p_outcome: "stopped" }));
    expect(ok(await db.from("rhythm_logs").select("id"))).toHaveLength(0);

    const started = ok(await db.rpc("start_session", { p_rhythm_id: rhythm.id }));
    expect(started.module_id).toBe(mod.id);
    ok(await db.rpc("end_session", { p_session_id: started.id }));
    const logs = ok(await db.from("rhythm_logs").select("*"));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ rhythm_id: rhythm.id, session_id: started.id });
  });

  it("one tap completes a task, closing a session that runs on it", async () => {
    const mod = await makeModule(db);
    const quick = ok(
      await db.from("tasks").insert({ module_id: mod.id, title: "Fatura" }).select().single(),
    );
    const done = ok(await db.rpc("complete_task", { p_task_id: quick.id }));
    expect(done.status).toBe("done");
    expect(done.done_at).not.toBeNull();
    expect(ok(await db.from("sessions").select("id"))).toHaveLength(0);

    const running = ok(
      await db.from("tasks").insert({ module_id: mod.id, title: "Sunum" }).select().single(),
    );
    const session = ok(await db.rpc("start_session", { p_task_id: running.id }));
    ok(await db.rpc("complete_task", { p_task_id: running.id }));
    const closed = ok(await db.from("sessions").select("ended_at").eq("id", session.id).single());
    expect(closed.ended_at).not.toBeNull();
  });
});

describe("archiving a module", () => {
  it("drops open work, quiets rhythms, closes series and cancels coming blocks; nothing is deleted", async () => {
    const mod = await makeModule(db);
    const other = await makeModule(db, "diger", "Diğer");
    const today = ok(await db.rpc("istanbul_today"));

    const open = ok(
      await db.from("tasks").insert({ module_id: mod.id, title: "Açık" }).select().single(),
    );
    const finished = ok(
      await db
        .from("tasks")
        .insert({ module_id: mod.id, title: "Biten", status: "done" })
        .select()
        .single(),
    );
    const kept = ok(
      await db.from("tasks").insert({ module_id: other.id, title: "Başka" }).select().single(),
    );
    const item = ok(
      await db.from("work_items").insert({ module_id: mod.id, title: "Kalem" }).select().single(),
    );
    const rhythm = ok(
      await db
        .from("rhythms")
        .insert({ module_id: mod.id, title: "Ritim", target_count: 1, period: "week" })
        .select()
        .single(),
    );
    const prompt = ok(
      await db
        .from("prompts")
        .insert({ module_id: mod.id, kind: "attendance", question: "Derse girdin mi?" })
        .select()
        .single(),
    );
    const series = ok(
      await db
        .from("block_series")
        .insert({
          module_id: mod.id,
          title: "Ders",
          weekday: 1,
          start_time: "09:00",
          end_time: "10:00",
        })
        .select()
        .single(),
    );
    const seriesBlock = (day: string, hour = "09") => ({
      series_id: series.id,
      occurrence_on: day,
      title: "Ders",
      starts_at: `${day}T${hour}:00:00+03:00`,
      ends_at: `${day}T${Number(hour) + 1}:00:00+03:00`,
    });
    ok(
      await db
        .from("blocks")
        .insert(
          [
            seriesBlock("2026-01-05"),
            seriesBlock("2099-01-05"),
            // Moved by hand to the afternoon and given a place: still not deleted.
            {
              ...seriesBlock("2099-01-12", "14"),
              location: "A101",
              provenance: { starts_at: "user" },
            },
            {
              module_id: mod.id,
              title: "Tek seferlik",
              starts_at: "2099-02-01T09:00:00+03:00",
              ends_at: "2099-02-01T10:00:00+03:00",
            },
            {
              module_id: other.id,
              title: "Başka modül",
              starts_at: "2099-02-01T12:00:00+03:00",
              ends_at: "2099-02-01T13:00:00+03:00",
            },
          ],
          // Rows of different shapes: let missing columns take their defaults, not null.
          { defaultToNull: false },
        )
        .select(),
    );
    const session = ok(await db.rpc("start_session", { p_task_id: open.id }));

    const archived = ok(await db.rpc("archive_module", { p_module_id: mod.id }));
    expect(archived.status).toBe("archived");

    const tasks = ok(await db.from("tasks").select("id, status"));
    expect(tasks.find((row) => row.id === open.id)?.status).toBe("dropped");
    expect(tasks.find((row) => row.id === finished.id)?.status).toBe("done");
    expect(tasks.find((row) => row.id === kept.id)?.status).toBe("todo");
    expect(ok(await db.from("work_items").select("status").eq("id", item.id).single()).status).toBe(
      "dropped",
    );
    expect(ok(await db.from("rhythms").select("active").eq("id", rhythm.id).single()).active).toBe(
      false,
    );
    expect(ok(await db.from("prompts").select("status").eq("id", prompt.id).single()).status).toBe(
      "expired",
    );
    const closedSeries = ok(
      await db.from("block_series").select("valid_to").eq("id", series.id).single(),
    );
    expect(closedSeries.valid_to! < today).toBe(true);

    const blocks = ok(
      await db.from("blocks").select("title, occurrence_on, status, location").order("starts_at"),
    );
    expect(blocks).toEqual([
      { title: "Ders", occurrence_on: "2026-01-05", status: "planned", location: null },
      { title: "Ders", occurrence_on: "2099-01-05", status: "cancelled", location: null },
      { title: "Ders", occurrence_on: "2099-01-12", status: "cancelled", location: "A101" },
      { title: "Tek seferlik", occurrence_on: null, status: "cancelled", location: null },
      { title: "Başka modül", occurrence_on: null, status: "planned", location: null },
    ]);
    expect(
      ok(await db.from("sessions").select("ended_at").eq("id", session.id).single()).ended_at,
    ).not.toBeNull();
  });
});
