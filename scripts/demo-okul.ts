import { createRegistry } from "@/core/contract/registry";
import { createModuleContext } from "@/core/data/context";
import { activateModule } from "@/core/data/module-rows";
import type { Db } from "@/core/types";
import { token } from "@/core/ui/tokens";
import { dayKey, shiftDay, weekdayOf } from "@/lib/date";
import { okul } from "@/modules/okul/module";
import {
  insertAssessment,
  insertClassNote,
  insertCourse,
  insertSession,
  insertTerm,
} from "@/modules/okul/queries";
import { setDocsReady, syncAll } from "@/modules/okul/rules";
import { addMeeting } from "@/modules/okul/server/entries";

// Okul's sample term (prompts/okul-adim-1.md, "Örnek veri"): made up, after the frames
// (docs/tasarim/kareler/okul/): six courses with the frames' names and invented codes, their
// lessons for the whole term (week 8 a holiday), the work the frames show around today, a few
// scores, a sentence written in class, a team meeting. Dates are counted from `now`, so the pages
// look like the frames whenever they are drawn. The screenshots and the visual test use it.
//
// Nothing here is real: no course, score, attendance or note comes from the user's data.

type Lesson = { weekday: number; start: string; end: string; room: string };

const COURSES: {
  code: string;
  name: string;
  color: string;
  lesson: Lesson;
  absence_limit?: number;
  attendance_min_pct?: number;
  grading_note?: string;
  vf?: string[];
}[] = [
  {
    code: "ROB301E",
    name: "Robotics",
    color: token("color-swatch-violet"),
    lesson: { weekday: 2, start: "09:30", end: "12:20", room: "EEB 5302" },
    absence_limit: 4,
    grading_note: "Quizlerin en iyi üçü sayılır.",
    vf: ["En iyi 3 quiz ve midterm toplamı en az 20 / 60"],
  },
  {
    code: "BDA410E",
    name: "Big Data",
    color: token("color-swatch-orange"),
    lesson: { weekday: 4, start: "08:30", end: "11:20", room: "MED A21" },
  },
  {
    code: "ALG305E",
    name: "Algoritma",
    color: token("color-swatch-teal"),
    lesson: { weekday: 1, start: "09:30", end: "12:20", room: "EEB 4205" },
    vf: ["4 ödevden en az 3'ü teslim"],
  },
  {
    code: "MLO420E",
    name: "MLOps",
    color: token("color-swatch-sky"),
    lesson: { weekday: 5, start: "09:30", end: "12:20", room: "Çevrim içi" },
  },
  {
    code: "DLR303E",
    name: "Deep Learning",
    color: token("color-swatch-pink"),
    lesson: { weekday: 1, start: "14:30", end: "17:20", room: "EEB 1301" },
    attendance_min_pct: 70,
    grading_note: "Proje notu takım içi değerlendirmeyle kişiye göre düzeltilir.",
    vf: ["Devam en az %70", "Quiz ortalaması en az 10", "Midterm en az 10"],
  },
  {
    code: "DVZ330E",
    name: "Data Viz",
    color: token("color-swatch-green"),
    lesson: { weekday: 2, start: "14:30", end: "17:20", room: "EEB 2101" },
  },
];

const TERM = { name: "26-27 Güz", starts_on: "2026-09-28", ends_on: "2026-12-31" };

/** The lessons of a weekday through the term; week 8 is the break. */
function lessonDays(weekday: number): { day: string; week: number }[] {
  const days: { day: string; week: number }[] = [];
  let day = TERM.starts_on;
  while (weekdayOf(day) !== weekday) day = shiftDay(day, 1);
  for (let week = 1; day <= TERM.ends_on; week += 1, day = shiftDay(day, 7)) {
    days.push({ day, week });
  }
  return days;
}

export async function seedOkul(db: Db, now: Date): Promise<Record<string, number>> {
  const registry = createRegistry([okul]);
  const row = await activateModule(db, registry, okul);
  const ctx = createModuleContext({ db, registry, module: row, now: () => now });
  const today = dayKey(now);
  const at = (n: number) => shiftDay(today, n);

  const term = await insertTerm(ctx, {
    ...TERM,
    finals_from: "2027-01-02",
    finals_to: "2027-01-17",
    break_weeks: [8],
  });
  const ids: Record<string, string> = {};
  for (const [position, course] of COURSES.entries()) {
    const created = await insertCourse(ctx, {
      term_id: term.id,
      code: course.code,
      name: course.name,
      color: course.color,
      position,
      weekday: course.lesson.weekday,
      start_time: course.lesson.start,
      end_time: course.lesson.end,
      room: course.lesson.room,
      location: course.lesson.room === "Çevrim içi" ? "online" : "campus",
      absence_limit: course.absence_limit ?? null,
      attendance_min_pct: course.attendance_min_pct ?? null,
      grading_note: course.grading_note ?? null,
      vf_conditions: (course.vf ?? []).map((text) => ({ text })),
    });
    ids[course.code] = created.id;
  }

  // Every lesson of the term; the past ones marked where the course asks (one missed).
  let sessions = 0;
  let lastLesson: string | null = null;
  for (const course of COURSES) {
    for (const { day, week } of lessonDays(course.lesson.weekday)) {
      const asks = course.absence_limit !== undefined || course.attendance_min_pct !== undefined;
      const past = day < today;
      const session = await insertSession(ctx, {
        course_id: ids[course.code],
        date: day,
        course_week: week,
        kind: week === 8 ? "holiday" : "lecture",
        topic: week === 8 ? "Ara tatil" : `Hafta ${week}`,
        attendance: week === 8 || !past || !asks ? null : week === 3 ? "missed" : "attended",
      });
      sessions += 1;
      if (course.code === "DLR303E" && past && week !== 8) lastLesson = session.id;
    }
  }
  if (lastLesson) await insertClassNote(ctx, lastLesson, "Quiz 2 gelecek ay, kapsam 5–9. hafta");

  const add = (code: string, row: Omit<Parameters<typeof insertAssessment>[1], "course_id">) =>
    insertAssessment(ctx, { course_id: ids[code], date_status: "exact", ...row });

  // Robotics: the midterm with its documents marked ready, a quiz, an assignment, a project.
  const robMidterm = await add("ROB301E", {
    title: "Midterm",
    kind: "midterm",
    date: at(1),
    time: "10:30",
    duration_min: 90,
    room: "EEB 5302",
    weight: 20,
  });
  await add("ROB301E", {
    title: "Quiz 3",
    kind: "quiz",
    date: at(15),
    time: "09:30",
    duration_min: 30,
    weight: 5,
    date_source: "announcement",
  });
  await add("ROB301E", {
    title: "Quiz 2",
    kind: "quiz",
    date: at(-14),
    weight: 5,
    score: 80,
    score_source: "user",
    status: "done",
  });
  await add("ROB301E", {
    title: "Assignment 3",
    kind: "homework",
    output_kind: "code",
    date: at(17),
    date_status: "estimated",
    weight: 0,
  });
  const robProject = await add("ROB301E", {
    title: "Proje",
    kind: "project",
    date: at(30),
    weight: 25,
  });
  await add("ROB301E", {
    title: "Proposal",
    kind: "project_step",
    parent_id: robProject.id,
    date: at(10),
    time: "23:59",
    owner: "me",
    position: 1,
    output_kind: "report",
    submits: true,
  });
  await add("ROB301E", {
    title: "Ara rapor",
    kind: "project_step",
    parent_id: robProject.id,
    date: at(22),
    owner: "me",
    position: 2,
    proposed: true,
    output_kind: "report",
    submits: true,
  });

  // Big Data.
  await add("BDA410E", {
    title: "Quiz 4",
    kind: "quiz",
    date: at(1),
    date_status: "estimated",
    weight: 5,
  });
  await add("BDA410E", {
    title: "Quiz 5",
    kind: "quiz",
    date: at(15),
    date_status: "estimated",
    weight: 5,
  });
  await add("BDA410E", {
    title: "Proje: Progress Report",
    kind: "homework",
    output_kind: "report",
    date: at(25),
    weight: 0,
  });

  // Algoritma: the assignment of the frames' third scenario.
  await add("ALG305E", {
    title: "Assignment 2",
    kind: "homework",
    output_kind: "code",
    date: at(3),
    time: "23:59",
    weight: 0,
  });
  await add("ALG305E", {
    title: "Quiz 3",
    kind: "quiz",
    date: at(10),
    time: "09:30",
    duration_min: 30,
    weight: 10,
  });
  await add("ALG305E", {
    title: "Assignment 1",
    kind: "homework",
    output_kind: "code",
    date: at(-20),
    weight: 0,
    status: "done",
    submitted_at: new Date(now.getTime() - 21 * 86_400_000).toISOString(),
    submit_source: "user",
  });

  // MLOps.
  await add("MLO420E", { title: "Midterm", kind: "midterm", date: at(4), weight: 20 });
  await add("MLO420E", { title: "Quiz 2", kind: "quiz", date: at(25), weight: 10 });

  // Deep Learning: the course page of the frames.
  await add("DLR303E", {
    title: "Midterm",
    kind: "midterm",
    date: at(7),
    time: "14:30",
    duration_min: 120,
    room: "EEB 1301",
    weight: 20,
  });
  await add("DLR303E", {
    title: "Homework 2",
    kind: "homework",
    output_kind: "written",
    date: at(14),
    date_status: "estimated",
    weight: 1.67,
  });
  await add("DLR303E", { title: "Quiz 2", kind: "quiz", date: at(28), weight: 5 });
  await add("DLR303E", {
    title: "Quiz 1",
    kind: "quiz",
    date: at(-21),
    weight: 5,
    score: 60,
    score_source: "user",
    status: "done",
  });
  await add("DLR303E", {
    title: "Homework 1",
    kind: "homework",
    date: at(-20),
    weight: 1.67,
    score: 100,
    score_source: "user",
    status: "done",
    submitted_at: new Date(now.getTime() - 20 * 86_400_000).toISOString(),
    submit_source: "user",
  });
  const dlProject = await add("DLR303E", {
    title: "Proje",
    kind: "project",
    date: at(35),
    date_status: "estimated",
    weight: 25,
  });
  await add("DLR303E", {
    title: "Proposal",
    kind: "project_step",
    parent_id: dlProject.id,
    date: at(-14),
    weight: 3,
    score: 90,
    score_source: "user",
    owner: "me",
    position: 1,
    status: "done",
    submits: false,
  });
  await add("DLR303E", {
    title: "Veri toplama betiği",
    kind: "project_step",
    parent_id: dlProject.id,
    date: at(12),
    owner: "me",
    position: 2,
    proposed: true,
    output_kind: "code",
    submits: false,
  });
  await add("DLR303E", {
    title: "Temel model",
    kind: "project_step",
    parent_id: dlProject.id,
    date: at(19),
    owner: "other",
    owner_name: "2. kişi",
    position: 3,
    proposed: true,
    output_kind: "code",
    submits: false,
  });
  await add("DLR303E", {
    title: "Final",
    kind: "final",
    date: null,
    date_status: "unknown",
    weight: 40,
  });
  await addMeeting(ctx, dlProject.id, { day: at(2), time: "15:00", minutes: 45 });

  // Data Viz.
  await add("DVZ330E", {
    title: "Homework 2",
    kind: "homework",
    output_kind: "written",
    date: at(21),
    weight: 20,
  });
  await add("DVZ330E", {
    title: "Proje: tüm teslimler",
    kind: "homework",
    output_kind: "report",
    date: at(27),
    date_status: "estimated",
    weight: 30,
  });
  await add("DVZ330E", {
    title: "Final",
    kind: "final",
    date: null,
    date_status: "unknown",
    weight: 40,
  });

  await syncAll(ctx);
  await setDocsReady(ctx, robMidterm.id, true);
  const sized = await sizeTheWork(db, now);
  const assessments = (await db.from("okul_assessments").select("id")).data?.length ?? 0;
  return {
    okul_courses: COURSES.length,
    okul_sessions: sessions,
    okul_assessments: assessments,
    okul_sized: sized,
  };
}

/**
 * What the AI's `size` would write for each proposal (the sample has no AI behind it): a
 * placeholder preparation by its exam's kind, homework three hours, a step two, a task half an
 * hour. Written as the AI's, so a later proposal of the module does not change it.
 */
async function sizeTheWork(db: Db, now: Date): Promise<number> {
  const { data, error } = await db
    .from("work_items")
    .select("id, source_type, meta, provenance, effort_total_minutes")
    .like("source_type", "okul.%");
  if (error) throw new Error(error.message);
  let sized = 0;
  for (const item of data ?? []) {
    if (item.effort_total_minutes !== null) continue;
    const exam = (item.meta as { exam?: string } | null)?.exam;
    const minutes =
      item.source_type === "okul.prep"
        ? exam === "quiz"
          ? 120
          : 480
        : item.source_type === "okul.homework"
          ? 180
          : item.source_type === "okul.step"
            ? 120
            : 30;
    const { error: writeError } = await db
      .from("work_items")
      .update({
        effort_total_minutes: minutes,
        provenance: { ...(item.provenance as object), effort_total_minutes: "ai" },
      })
      .eq("id", item.id);
    if (writeError) throw new Error(writeError.message);
    sized += 1;
  }
  void now;
  return sized;
}
