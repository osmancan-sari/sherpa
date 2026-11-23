import { token } from "@/core/ui/tokens";
import type { ModuleContext, ModuleDefinition, ModuleFacet } from "@/core/contract/types";
import { dayKey, shiftDay } from "@/lib/date";
import { OkulBackdrop } from "./components/Backdrop";
import { CoursePage } from "./components/CoursePage";
import { OkulHome } from "./components/Home";
import { AssessmentPage, AttendancePage } from "./components/DetailPages";
import { LessonView } from "./components/LessonView";
import { OkulSettingsForm } from "./components/Settings";
import { loadTerm, unwrap } from "./queries";
import {
  listeners,
  onOutcome,
  SIZING_HINTS,
  sizingActuals,
  syncAll,
  syncAssessment,
} from "./rules";
import { okulScene } from "./scene";
import { remainingAbsences } from "./server/derive";
import {
  addAssessment,
  addClassNote,
  addStep,
  findAssessment,
  findCourse,
  markSubmitted,
  setAttendance,
  setDocsReady,
  setGrade,
  updateDate,
} from "./server/entries";
import { deadlineOf, examStartOf, facetOf, SOURCE } from "./server/proposals";
import { readSentence } from "./server/sentence";
import { KIND_LABEL, nearDay } from "./server/text";
import { jobs } from "./jobs";

// Okul: the term's exams, homework, projects and lessons (docs/moduller/okul.md, approved 23 Nov
// 2026). Step 1 ("Temel", prompts/okul-adim-1.md): the tables, the Notion import, the pages, the
// lessons as fixed blocks with their view, the preparation as a load with "Dokümanım hazır", the
// homework and project scenes, the hand-in and the meeting checklists. Ninova, Kepler, files and
// notifications come with step 2; the documents and their mixed sittings with step 3.

const TERM_TABLES = [
  "okul_terms",
  "okul_courses",
  "okul_assessments",
  "okul_sessions",
  "okul_class_notes",
  "okul_prep_docs",
  "okul_meetings",
  "okul_tasks",
  "okul_session_log",
];

type FacetRow = {
  code: string;
  name: string;
  color: string;
  okul_assessments: {
    title: string;
    kind: string;
    date: string | null;
    time: string | null;
    status: string;
    submitted_at: string | null;
  }[];
};

/**
 * The courses of the active term, each a facet with its colour; the line under its name says its
 * code and what comes next (`detail`). One query: the courses with their term and assessments.
 */
export async function facets(ctx: ModuleContext): Promise<ModuleFacet[]> {
  const rows = unwrap(
    await ctx.db
      .from("okul_courses")
      .select(
        "code, name, color, okul_terms!inner(status), okul_assessments!okul_assessments_course_id_user_id_fkey(title, kind, date, time, status, submitted_at)",
      )
      .eq("okul_terms.status", "active")
      .order("position")
      .order("code"),
  ) as unknown as FacetRow[];
  const now = ctx.now();
  const today = dayKey(now);
  return rows.map((row) => {
    const next = row.okul_assessments
      .filter(
        (a) =>
          a.date !== null &&
          a.date >= today &&
          a.status !== "done" &&
          a.status !== "cancelled" &&
          !a.submitted_at,
      )
      .sort((a, b) => (a.date as string).localeCompare(b.date as string))[0];
    const detail = next
      ? `${row.code} · sıradaki: ${next.title} · ${nearDay(next.date as string, now)}`
      : row.code;
    return {
      key: facetOf(row),
      name: row.name,
      color: row.color,
      detail: detail.length > 120 ? `${detail.slice(0, 119)}…` : detail,
    };
  });
}

/**
 * The next exam or hand-in ahead ("Midterm · Sal"; decision 10, **görüşün gerek**); attention
 * while a hand-in not yet uploaded is due within a day. A work done but not uploaded ("Sonra yap")
 * is still a hand-in ahead.
 */
export async function chip(ctx: ModuleContext) {
  const data = await loadTerm(ctx);
  const now = ctx.now();
  const exams = ["quiz", "midterm", "final"];
  const ahead = data.assessments
    .filter((a) => a.status !== "cancelled" && a.date && a.date_status !== "unknown")
    .filter((a) =>
      exams.includes(a.kind)
        ? a.status !== "done"
        : ["homework", "project", "project_step"].includes(a.kind) && a.submits && !a.submitted_at,
    )
    .map((a) => ({ a, at: exams.includes(a.kind) ? examStartOf(a)! : deadlineOf(a)! }))
    .filter(({ at }) => at.getTime() > now.getTime())
    .sort((x, y) => x.at.getTime() - y.at.getTime());
  const urgent = ahead.some(
    ({ a, at }) => !exams.includes(a.kind) && at.getTime() - now.getTime() < 24 * 3_600_000,
  );
  if (ahead.length === 0) return { text: "sırada sınav ya da teslim yok", health: "ok" as const };
  const first = ahead[0];
  return {
    text: `${first.a.title} · ${nearDay(dayKey(first.at), now)}`,
    health: urgent ? ("attention" as const) : ("ok" as const),
  };
}

/**
 * The weekly report (okul.md section 10). Step 1: the first number (the exams and hand-ins of the
 * next 14 days, estimated dates included) and the attendance suggestion; the rest come with the
 * data they need (steps 2 and 3).
 */
export async function weeklyReport(ctx: ModuleContext) {
  const data = await loadTerm(ctx);
  const today = dayKey(ctx.now());
  const until = shiftDay(today, 14);
  const soon = data.assessments.filter(
    (a) => a.date && a.date >= today && a.date <= until && a.status !== "cancelled",
  );
  const exams = soon.filter((a) => ["quiz", "midterm", "final"].includes(a.kind)).length;
  const handIns = soon.filter(
    (a) => ["homework", "project", "project_step"].includes(a.kind) && a.submits,
  ).length;
  const suggestions: string[] = [];
  for (const course of data.courses) {
    const left = remainingAbsences(
      course,
      data.sessions.filter((session) => session.course_id === course.id),
    );
    if (!left || left.remaining > 1) continue;
    suggestions.push(
      left.remaining === 1
        ? `${course.name}: 1 devamsızlık hakkın kaldı.`
        : `${course.name}: devamsızlık hakkın kalmadı.`,
    );
    if (suggestions.length === 2) break;
  }
  return {
    metrics: [{ label: "Önümüzdeki 14 gün", value: `${exams} sınav · ${handIns} teslim` }],
    suggestions,
  };
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const okul: ModuleDefinition = {
  slug: "okul",
  name: "Okul",
  kind: "term",
  color: token("color-swatch-blue"),

  facets,
  chip,
  // The core's card says the title and the length; the module adds nothing in step 1 (the
  // sections of a preparation come with its documents, step 3).
  nowCard: () => null,

  intake: [
    {
      key: "assessment",
      label: "Sınav ya da teslim",
      fields: [
        { name: "sentence", label: "Tek cümle", type: "text", required: true },
        { name: "course", label: "Ders (kodu ya da adı)", type: "text", required: true },
      ],
      examples: ["okul: Quiz 4 3 Aralık YZV406E", "robotik ödev 2 teslim 5 aralık 23:59"],
      async handle(values, ctx) {
        const data = await loadTerm(ctx);
        const course = findCourse(data, values.course);
        if (!course) throw new Error("Ders bulunamadı.");
        await addAssessment(ctx, { courseId: course.id, sentence: text(values.sentence) });
      },
    },
    {
      key: "class_note",
      label: "Derste söylenen",
      fields: [
        { name: "text", label: "Tek cümle", type: "text", required: true },
        { name: "course", label: "Ders", type: "text", required: true },
      ],
      examples: ["derste: quiz gelecek hafta"],
      async handle(values, ctx) {
        const data = await loadTerm(ctx);
        const course = findCourse(data, values.course);
        const today = dayKey(ctx.now());
        const session = data.sessions
          .filter((row) => row.course_id === course?.id && row.date <= today)
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        if (!session) throw new Error("Bu dersin oturumu bulunamadı.");
        await addClassNote(ctx, session.id, text(values.text));
      },
    },
    {
      key: "attendance",
      label: "Devam",
      fields: [
        { name: "course", label: "Ders", type: "text", required: true },
        {
          name: "value",
          label: "Derse girdin mi?",
          type: "select",
          required: true,
          default: "attended",
          options: [
            { value: "attended", label: "Girdim" },
            { value: "missed", label: "Girmedim" },
            { value: "not_held", label: "Yapılmadı" },
          ],
        },
        { name: "date", label: "Gün", type: "date" },
      ],
      examples: ["robotik dersine girmedim"],
      async handle(values, ctx) {
        const data = await loadTerm(ctx);
        const course = findCourse(data, values.course);
        const day = text(values.date) || dayKey(ctx.now());
        const session = data.sessions.find(
          (row) => row.course_id === course?.id && row.date === day,
        );
        if (!session) throw new Error("O gün bu dersin oturumu yok.");
        const value = values.value as "attended" | "missed" | "not_held";
        await setAttendance(ctx, session.id, value);
      },
    },
    {
      key: "date_update",
      label: "Tarih değişti",
      fields: [
        { name: "title", label: "Sınav ya da teslim", type: "text", required: true },
        { name: "date", label: "Yeni gün", type: "date", required: true },
      ],
      examples: ["quiz 3 tarihi 10 aralık oldu"],
      async handle(values, ctx) {
        const data = await loadTerm(ctx);
        const row = findAssessment(data, values.title, ctx.now());
        if (!row) throw new Error("Sınav ya da teslim bulunamadı.");
        await updateDate(ctx, row.id, text(values.date) || null);
      },
    },
    {
      key: "grade",
      label: "Not",
      fields: [
        { name: "title", label: "Sınav ya da teslim", type: "text", required: true },
        {
          name: "score",
          label: "Not (100 üzerinden)",
          type: "number",
          min: 0,
          max: 100,
          required: true,
        },
      ],
      examples: ["midterm notum 72"],
      async handle(values, ctx) {
        const data = await loadTerm(ctx);
        const row = findAssessment(data, values.title, ctx.now());
        if (!row) throw new Error("Sınav ya da teslim bulunamadı.");
        await setGrade(ctx, row.id, typeof values.score === "number" ? values.score : null);
      },
    },
    {
      key: "submitted",
      label: "Yükledim",
      fields: [{ name: "title", label: "Ödev ya da teslim", type: "text", required: true }],
      examples: ["ödev 2'yi yükledim"],
      async handle(values, ctx) {
        const data = await loadTerm(ctx);
        const row = findAssessment(data, values.title, ctx.now());
        if (!row || !row.submits) throw new Error("Teslimi olan bir iş bulunamadı.");
        await markSubmitted(ctx, row.id);
        // The work and its hand-in leave the plan now, not at the night's job.
        await syncAssessment(ctx, row.id);
      },
    },
    {
      key: "docs_ready",
      label: "Dokümanım hazır",
      fields: [{ name: "title", label: "Sınav", type: "text", required: true }],
      examples: ["quiz 3 dokümanım hazır"],
      async handle(values, ctx) {
        const data = await loadTerm(ctx);
        const row = findAssessment(data, values.title, ctx.now());
        if (!row) throw new Error("Sınav bulunamadı.");
        await setDocsReady(ctx, row.id, true);
      },
    },
    {
      key: "step_edit",
      label: "Proje adımı",
      fields: [
        { name: "title", label: "Adım", type: "text", required: true },
        { name: "project", label: "Proje", type: "text", required: true },
        { name: "date", label: "Gün", type: "date" },
      ],
      examples: ["proje adımı: ara rapor 12 aralık"],
      async handle(values, ctx) {
        const data = await loadTerm(ctx);
        const project = data.assessments.find(
          (row) =>
            row.kind === "project" &&
            row.id === findAssessment(data, values.project, ctx.now())?.id,
        );
        if (!project) throw new Error("Proje bulunamadı.");
        const read = readSentence(text(values.title), ctx.now());
        await addStep(ctx, project.id, {
          title: read.title || text(values.title),
          date: text(values.date) || read.date,
        });
      },
    },
  ],

  emits: [],
  on: listeners,

  weeklyReport,

  async onActivate(ctx) {
    // Proposing the term again brings back the work archiving had taken back.
    await syncAll(ctx);
  },

  sizingHints: SIZING_HINTS,
  sizingActuals,
  onOutcome,

  tables: TERM_TABLES,

  jobs,

  ui: {
    tabs: [],
    page: {
      home: { label: "Ana sayfa", component: OkulHome },
      facetView: CoursePage,
      pickLabel: "Ders seç",
      status: false,
      subtitle: async (ctx) => (await loadTerm(ctx)).term?.name ?? null,
      upcoming: false,
      history: false,
      entries: false,
    },
    routes: [
      { path: "is/:id", title: "İş", component: AssessmentPage },
      { path: "devam/:course", title: "Devam", component: AttendancePage },
    ],
    settings: OkulSettingsForm,
    backdrop: OkulBackdrop,
    blockView: {
      when: (block) => block.source_type === SOURCE.lesson,
      label: "Dersi aç",
      component: LessonView,
    },
    scene: okulScene,
  },
};

export { KIND_LABEL };
