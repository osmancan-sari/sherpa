import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRegistry } from "@/core/contract/registry";
import { createModuleContext } from "@/core/data/context";
import { keepWeek } from "@/core/data/keep";
import { endSessionClosing, startSessionTold } from "@/core/data/session-events";
import { updateWorkItem } from "@/core/data/work";
import type { ModuleRow } from "@/core/types";
import { dayKey, istanbulInstant, shiftDay } from "@/lib/date";
import { jobs } from "@/modules/okul/jobs";
import { okul } from "@/modules/okul/module";
import {
  insertAssessment,
  insertCourse,
  insertSession,
  insertTerm,
  updateAssessment,
} from "@/modules/okul/queries";
import {
  askAttendance,
  setAttendance,
  setDocsReady,
  sizingActuals,
  syncAll,
  syncAssessment,
  syncSession,
} from "@/modules/okul/rules";
import { addMeeting, removeAssessment } from "@/modules/okul/server/entries";
import { adminDb, makeModule, ok, ownerDb, wipe } from "./helpers";

// Okul step 1 (prompts/okul-adim-1.md, "Testler" → "Teklifler"): what the module proposes from its
// records, against the real database through the envelope: a preparation is a load until
// "Dokümanım hazır", the daily job moves it on, the mark opens and closes its sittings; homework is
// one item with its hand-in after it; only the user's steps, one after another; the user's date is
// never overwritten; a removed record is taken back; lessons are fixed blocks, never on a holiday.

const db = ownerDb();
const admin = adminDb();
const registry = createRegistry([okul]);

beforeEach(wipe);
afterAll(wipe);

const today = () => dayKey(new Date());
const day = (n: number) => shiftDay(today(), n);

async function setup(now: () => Date = () => new Date()) {
  const row: ModuleRow = await makeModule(db, "okul", "Okul");
  const ctx = createModuleContext({ db, registry, module: row, now });
  const term = await insertTerm(ctx, {
    name: "26-27 Güz",
    starts_on: "2026-09-28",
    ends_on: "2027-01-31",
  });
  const course = await insertCourse(ctx, {
    term_id: term.id,
    code: "SNM101E",
    name: "Sınama",
    color: "#5fd6c6",
    start_time: "10:00",
    end_time: "12:50",
    room: "D-101",
    absence_limit: 3,
  });
  const free = await insertCourse(ctx, {
    term_id: term.id,
    code: "SNM202E",
    name: "Serbest",
    color: "#c3a9ff",
    start_time: "14:00",
  });
  return { row, ctx, term, course, free };
}

const itemByKey = async (key: string) =>
  (await db.from("work_items").select("*").eq("key", key).maybeSingle()).data;
const blockByKey = async (key: string) =>
  (await db.from("blocks").select("*").eq("key", key).maybeSingle()).data;
const sittingsOf = async (itemId: string) =>
  ok(await db.from("tasks").select("*").eq("work_item_id", itemId).order("position"));

/** What the AI's `size` would write; the database tests run without it. */
async function sized(itemId: string, minutes: number) {
  const item = ok(await admin.from("work_items").select("provenance").eq("id", itemId).single());
  ok(
    await admin
      .from("work_items")
      .update({
        effort_total_minutes: minutes,
        provenance: { ...(item.provenance as object), effort_total_minutes: "ai" },
      })
      .eq("id", itemId)
      .select(),
  );
}

describe("an exam's preparation", () => {
  it("is a load with a placeholder effort and its document day; it opens no sitting", async () => {
    const { ctx, course } = await setup();
    const quiz = await insertAssessment(ctx, {
      course_id: course.id,
      title: "Quiz 3",
      kind: "quiz",
      date: day(10),
      time: "10:30",
      duration_min: 60,
      room: "D-201",
      weight: 10,
      date_status: "exact",
    });
    await syncAll(ctx);
    const prep = await itemByKey(`prep:${quiz.id}`);
    expect(prep).toMatchObject({
      title: "Quiz 3 hazırlığı",
      status: "active",
      effort_provisional: true,
      due_is_hard: true,
      source_type: "okul.prep",
      facet: "snm101e",
    });
    expect(prep!.effort_basis).toMatch(/%10/);
    expect(Date.parse(prep!.due_at!)).toBe(istanbulInstant(day(10), "10:30").getTime());
    expect(Date.parse(prep!.earliest_at!)).toBe(istanbulInstant(day(3), "05:00").getTime());
    expect(await sittingsOf(prep!.id)).toEqual([]);
    // The exam itself is a fixed block in the plan.
    expect(await blockByKey(`exam:${quiz.id}`)).toMatchObject({
      title: "Quiz 3 · Sınama",
      location: "D-201",
      status: "planned",
    });
  });

  it("whose document day has come waits for the next day's turn; the daily job moves it on", async () => {
    const { ctx, row, course } = await setup();
    const quiz = await insertAssessment(ctx, {
      course_id: course.id,
      title: "Quiz 4",
      kind: "quiz",
      date: day(3),
      date_status: "exact",
    });
    await syncAll(ctx);
    const first = await itemByKey(`prep:${quiz.id}`);
    expect(Date.parse(first!.earliest_at!)).toBe(istanbulInstant(day(1), "05:00").getTime());

    // The next night the job runs: the start moves on a day; still no sitting.
    const tomorrow = createModuleContext({
      db,
      registry,
      module: row,
      now: () => istanbulInstant(day(1), "00:30"),
    });
    await jobs.find((job) => job.key === "gunluk")!.run(tomorrow);
    const moved = await itemByKey(`prep:${quiz.id}`);
    expect(Date.parse(moved!.earliest_at!)).toBe(istanbulInstant(day(2), "05:00").getTime());
    expect(await sittingsOf(moved!.id)).toEqual([]);
  });

  it("opens its sittings with 'Dokümanım hazır'; taking it back drops the open ones and keeps what was done", async () => {
    const { ctx, course } = await setup();
    const midterm = await insertAssessment(ctx, {
      course_id: course.id,
      title: "Midterm",
      kind: "midterm",
      date: day(5),
      time: "13:30",
      weight: 30,
      date_status: "exact",
    });
    await syncAll(ctx);
    const prep = (await itemByKey(`prep:${midterm.id}`))!;
    await sized(prep.id, 240);

    // On: both documents ready by hand, the preparation may start now and the week splits it.
    await setDocsReady(ctx, midterm.id, true);
    const docs = ok(await db.from("okul_prep_docs").select("*").order("output"));
    expect(docs.map((doc) => [doc.output, doc.status, doc.produced_by, doc.file_path])).toEqual([
      ["practice", "ready", "manual", null],
      ["topic", "ready", "manual", null],
    ]);
    const marked = (await itemByKey(`prep:${midterm.id}`))!;
    expect(Date.parse(marked.earliest_at!)).toBeLessThanOrEqual(Date.now());
    expect(marked.effort_provisional).toBe(true);
    await keepWeek(db, new Date(), { force: true });
    const sittings = await sittingsOf(prep.id);
    expect(sittings.length).toBeGreaterThan(1);
    expect(sittings.every((task) => task.est_minutes <= 90)).toBe(true);

    // One sitting is worked for 30 minutes.
    const told = { db, registry };
    const session = await startSessionTold(told, { taskId: sittings[0].id });
    ok(
      await admin
        .from("sessions")
        .update({ started_at: new Date(Date.now() - 40 * 60_000).toISOString() })
        .eq("id", session.id)
        .select(),
    );
    await endSessionClosing(told, session.id, "done", "done", 30);
    expect((await itemByKey(`prep:${midterm.id}`))!.effort_done_minutes).toBe(30);

    // Off: the open sittings are taken back; the finished one and the minutes stay; the
    // preparation is a load again, from the next day's turn.
    await setDocsReady(ctx, midterm.id, false);
    const after = await sittingsOf(prep.id);
    expect(after.find((task) => task.id === sittings[0].id)!.status).toBe("done");
    expect(
      after.filter((task) => task.id !== sittings[0].id).every((t) => t.status === "dropped"),
    ).toBe(true);
    const unmarked = (await itemByKey(`prep:${midterm.id}`))!;
    expect(unmarked).toMatchObject({ id: prep.id, status: "active", effort_done_minutes: 30 });
    expect(Date.parse(unmarked.earliest_at!)).toBe(istanbulInstant(day(1), "05:00").getTime());
    expect(ok(await db.from("okul_prep_docs").select("status")).map((doc) => doc.status)).toEqual([
      "waiting",
      "waiting",
    ]);

    // On again: it goes on where it stood (the same record, the minutes worked).
    await setDocsReady(ctx, midterm.id, true);
    await keepWeek(db, new Date(), { force: true });
    const again = (await itemByKey(`prep:${midterm.id}`))!;
    expect(again).toMatchObject({ id: prep.id, status: "active", effort_done_minutes: 30 });
    const open = (await sittingsOf(prep.id)).filter((task) => task.status === "todo");
    expect(open.length).toBeGreaterThan(0);
  });
});

describe("homework and projects", () => {
  it("a homework is one item; its hand-in a ten-minute item after it", async () => {
    const { ctx, course } = await setup();
    const homework = await insertAssessment(ctx, {
      course_id: course.id,
      title: "Ödev 2",
      kind: "homework",
      output_kind: "code",
      date: day(6),
      time: "23:59",
      date_status: "exact",
    });
    await syncAll(ctx);
    const work = await itemByKey(`hw:${homework.id}`);
    expect(work).toMatchObject({ title: "Ödev 2", source_type: "okul.homework", status: "active" });
    expect(work!.meta).toMatchObject({ kind: "homework", output: "code" });
    const submit = await itemByKey(`submit:${homework.id}`);
    expect(submit).toMatchObject({
      title: "Ödev 2 teslimi",
      effort_total_minutes: 10,
      depends_on: [work!.id],
    });
    expect(Date.parse(submit!.due_at!)).toBe(istanbulInstant(day(6), "23:59").getTime());
    const items = ok(await db.from("work_items").select("key"));
    expect(items.filter((item) => item.key?.includes(homework.id))).toHaveLength(2);
  });

  it("only the user's steps are proposed, each after the one before", async () => {
    const { ctx, course } = await setup();
    const project = await insertAssessment(ctx, {
      course_id: course.id,
      title: "Proje",
      kind: "project",
      date: day(30),
      date_status: "exact",
    });
    const step = (title: string, n: number, owner: "me" | "other") =>
      insertAssessment(ctx, {
        course_id: course.id,
        parent_id: project.id,
        title,
        kind: "project_step",
        date: day(n),
        date_status: "exact",
        owner,
        position: n,
        proposed: title === "Ara rapor",
      });
    const proposal = await step("Proposal", 4, "me");
    const data = await step("Veri toplama", 8, "other");
    const report = await step("Ara rapor", 12, "me");
    await syncAll(ctx);
    expect(await itemByKey(`hw:${project.id}`)).toBeNull();
    expect(await itemByKey(`step:${data.id}`)).toBeNull();
    const first = (await itemByKey(`step:${proposal.id}`))!;
    const third = (await itemByKey(`step:${report.id}`))!;
    expect(third.depends_on).toEqual([first.id]);
    // A suggested step is a placeholder until it is known.
    expect(third.effort_provisional).toBe(true);
    expect(first.effort_provisional).toBe(false);
  });

  it("never overwrites a date the user changed; a removed record is taken back", async () => {
    const { ctx, course } = await setup();
    const homework = await insertAssessment(ctx, {
      course_id: course.id,
      title: "Ödev 3",
      kind: "homework",
      date: day(6),
      date_status: "exact",
    });
    await syncAll(ctx);
    const work = (await itemByKey(`hw:${homework.id}`))!;
    const mine = istanbulInstant(day(4), "18:00").toISOString();
    await updateWorkItem(db, work.id, { due_at: mine });

    // The source moves the deadline: the user's own stays.
    await updateAssessment(ctx, homework.id, { date: day(7) });
    await syncAssessment(ctx, homework.id);
    expect(Date.parse((await itemByKey(`hw:${homework.id}`))!.due_at!)).toBe(Date.parse(mine));

    await removeAssessment(ctx, homework.id);
    expect((await itemByKey(`hw:${homework.id}`))!.status).toBe("dropped");
    expect((await itemByKey(`submit:${homework.id}`))!.status).toBe("dropped");
  });

  it("an undated assessment is not planned", async () => {
    const { ctx, course } = await setup();
    const quiz = await insertAssessment(ctx, {
      course_id: course.id,
      title: "Quiz ?",
      kind: "quiz",
      date_status: "unknown",
    });
    await syncAll(ctx);
    expect(ok(await db.from("work_items").select("id"))).toEqual([]);
    expect(await blockByKey(`exam:${quiz.id}`)).toBeNull();
  });

  it("a team meeting is an item at its hour, for its length", async () => {
    const { ctx, course } = await setup();
    const project = await insertAssessment(ctx, {
      course_id: course.id,
      title: "Proje",
      kind: "project",
      date: day(20),
      date_status: "exact",
    });
    const meeting = await addMeeting(ctx, project.id, { day: day(2), time: "15:00", minutes: 45 });
    const item = (await itemByKey(`meeting:${meeting.id}`))!;
    expect(item).toMatchObject({ title: "Takım toplantısı", effort_total_minutes: 45 });
    expect(Date.parse(item.earliest_at!)).toBe(istanbulInstant(day(2), "15:00").getTime());
    expect(Date.parse(item.due_at!)).toBe(istanbulInstant(day(2), "15:45").getTime());
  });
});

describe("lessons", () => {
  it("are fixed blocks while ahead; never on a holiday; taken back when they will not take place", async () => {
    const { ctx, course } = await setup();
    const lesson = (n: number, kind: "lecture" | "holiday" = "lecture") =>
      insertSession(ctx, { course_id: course.id, date: day(n), kind });
    const [a, b, c, holiday, past] = [
      await lesson(1),
      await lesson(8),
      await lesson(15),
      await lesson(22, "holiday"),
      await lesson(-7),
    ];
    await syncAll(ctx);
    const block = await blockByKey(`lesson:${a.id}`);
    expect(block).toMatchObject({ title: "Sınama", location: "D-101", status: "planned" });
    expect(Date.parse(block!.starts_at)).toBe(istanbulInstant(day(1), "10:00").getTime());
    expect(Date.parse(block!.ends_at)).toBe(istanbulInstant(day(1), "12:50").getTime());
    expect(await blockByKey(`lesson:${holiday.id}`)).toBeNull();
    expect(await blockByKey(`lesson:${past.id}`)).toBeNull();

    // "Yapılmadı" and a lesson that is gone take their blocks back.
    await setAttendance(ctx, b.id, "not_held");
    expect((await blockByKey(`lesson:${b.id}`))!.status).toBe("cancelled");
    ok(await db.from("okul_sessions").delete().eq("id", c.id).select());
    await syncSession(ctx, c.id);
    expect((await blockByKey(`lesson:${c.id}`))!.status).toBe("cancelled");
  });

  it("ask 'Derse girdin mi?' only in a course with an attendance condition; the answer is the record's", async () => {
    const { ctx, course, free } = await setup();
    const now = new Date();
    const start = new Date(now.getTime() - 4 * 3_600_000);
    const hhmm = (at: Date) =>
      at.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Istanbul",
      });
    const session = (courseId: string) =>
      insertSession(ctx, {
        course_id: courseId,
        date: dayKey(start),
        start_time: hhmm(start),
        end_time: hhmm(new Date(start.getTime() + 2 * 3_600_000)),
      });
    const ruled = await session(course.id);
    const viewed = await session(course.id);
    ok(
      await db
        .from("okul_sessions")
        .update({ viewed_at: now.toISOString() })
        .eq("id", viewed.id)
        .select(),
    );
    await session(free.id);
    expect(await askAttendance(ctx)).toBe(1);
    const prompts = ok(await db.from("prompts").select("*"));
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({ kind: "attendance", subject_id: ruled.id });
    // Asked once.
    expect(await askAttendance(ctx)).toBe(0);

    // The answer from Today writes the session's attendance.
    await okul.on!["core.prompt_answered"](
      {
        id: "e",
        user_id: "",
        type: "core.prompt_answered",
        module_slug: null,
        payload: { module: "okul", kind: "attendance", subject_id: ruled.id, value: "missed" },
        occurred_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      ctx,
    );
    expect(
      ok(await db.from("okul_sessions").select("attendance").eq("id", ruled.id).single()),
    ).toEqual({
      attendance: "missed",
    });
  });
});

describe("what the module counted", () => {
  it("logs each session once and gives the course's finished work to the AI's estimate", async () => {
    const { ctx, course } = await setup();
    const done = await insertAssessment(ctx, {
      course_id: course.id,
      title: "Ödev 1",
      kind: "homework",
      date: day(2),
      date_status: "exact",
    });
    const next = await insertAssessment(ctx, {
      course_id: course.id,
      title: "Ödev 2",
      kind: "homework",
      date: day(9),
      date_status: "exact",
    });
    await syncAll(ctx);
    const work = (await itemByKey(`hw:${done.id}`))!;
    await sized(work.id, 90);
    await keepWeek(db, new Date(), { force: true });
    const [sitting] = await sittingsOf(work.id);
    const told = { db, registry };
    const session = await startSessionTold(told, { taskId: sitting.id });
    ok(
      await admin
        .from("sessions")
        .update({ started_at: new Date(Date.now() - 70 * 60_000).toISOString() })
        .eq("id", session.id)
        .select(),
    );
    await endSessionClosing(told, session.id, "done", "done", 55);
    const log = ok(await db.from("okul_session_log").select("*"));
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ assessment_id: done.id, role: "homework", minutes: 55 });

    await updateAssessment(ctx, done.id, { status: "done" });
    const other = (await itemByKey(`hw:${next.id}`))!;
    expect(await sizingActuals(other, ctx)).toEqual([{ title: "Ödev 1", minutes: 55 }]);
  });
});
