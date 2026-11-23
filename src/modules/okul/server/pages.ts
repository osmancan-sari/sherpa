import { dayKey, shiftDay, weekdayOf, weekStart } from "@/lib/date";
import type { Assessment, ClassSession, Course, PrepDoc, SessionLog, TermData } from "../queries";
import {
  disclosedWeight,
  docDay,
  remainingAbsences,
  runningTotal,
  totalWeight,
  weightedScore,
} from "./derive";
import { docsReady, facetOf, key } from "./proposals";
import { dayMonth, daysUntil, KIND_LABEL, MONTH_SHORT, percent, WEEKDAY_SHORT } from "./text";

// What the module's pages show (okul-sayfalar.md): the term's work by week, a row's lines, a
// course's summary. Pure; the components draw it and the unit tests read it.

/** The core's side of a row: its work item's effort, as the pages need it. */
export type WorkInfo = {
  key: string | null;
  effort_total_minutes: number | null;
  effort_done_minutes: number;
  effort_provisional: boolean;
  status: string;
};

export type Row = {
  id: string;
  title: string;
  kind: string;
  course: { id: string; code: string; name: string; color: string; facet: string };
  date: string | null;
  time: string | null;
  estimated: boolean;
  weight: number | null;
  done: boolean;
  submitted: boolean;
  score: number | null;
  /** "Robotics · Ödev · %0" */
  line: string;
  /** "hazırlık 2 sa / yaklaşık 8 sa", "çalışma 0 dk / 3 sa"; none without work */
  progress: { label: string; done: number; total: number | null; provisional: boolean } | null;
  /** An exam's documents: "dokümanlar hazır" or "dokümanlar: 1 Ara" */
  docs: { ready: boolean; day: string | null } | null;
  parentId: string | null;
  owner: string | null;
  ownerName: string | null;
  proposed: boolean;
};

const EXAMS = ["quiz", "midterm", "final"];

/** The minutes the module counted for an assessment (decision 9), by role. */
export function spentOn(log: SessionLog[], id: string, prep: boolean): number {
  return log
    .filter((line) => line.assessment_id === id && (line.role === "prep") === prep)
    .filter((line) => line.role !== "submit")
    .reduce((sum, line) => sum + line.minutes, 0);
}

export function rowOf(
  a: Assessment,
  course: Course,
  data: Pick<TermData, "log" | "prepDocs">,
  items: WorkInfo[],
): Row {
  const exam = EXAMS.includes(a.kind);
  const workKey = exam
    ? key.prep(a.id)
    : a.kind === "project_step"
      ? key.step(a.id)
      : key.homework(a.id);
  const item = items.find((row) => row.key === workKey) ?? null;
  const weight = a.weight === null ? null : Number(a.weight);
  const kindText = EXAMS.includes(a.kind) ? null : KIND_LABEL[a.kind];
  const docs = exam
    ? {
        ready: docsReady(data.prepDocs.filter((doc: PrepDoc) => doc.assessment_id === a.id)).ready,
        day: docDay(a.kind, a.date),
      }
    : null;
  return {
    id: a.id,
    title: a.title,
    kind: a.kind,
    course: {
      id: course.id,
      code: course.code,
      name: course.name,
      color: course.color,
      facet: facetOf(course),
    },
    date: a.date,
    time: a.time ? a.time.slice(0, 5) : null,
    estimated: a.date_status === "estimated",
    weight,
    done: a.status === "done" || Boolean(a.submitted_at),
    submitted: Boolean(a.submitted_at),
    score: a.score === null ? null : Number(a.score),
    line: [course.name, kindText, percent(weight)].filter(Boolean).join(" · "),
    progress: item
      ? {
          label: exam ? "hazırlık" : "çalışma",
          done: spentOn(data.log, a.id, exam),
          total: item.effort_total_minutes,
          provisional: item.effort_provisional,
        }
      : null,
    docs,
    parentId: a.parent_id,
    owner: a.owner,
    ownerName: a.owner_name,
    proposed: a.proposed,
  };
}

export function rowsOf(data: TermData, items: WorkInfo[]): Row[] {
  const rows: Row[] = [];
  for (const a of data.assessments) {
    const course = data.courses.find((row) => row.id === a.course_id);
    if (course) rows.push(rowOf(a, course, data, items));
  }
  return rows.sort(
    (a, b) =>
      (a.date ?? "9999").localeCompare(b.date ?? "9999") ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.title.localeCompare(b.title, "tr"),
  );
}

export type WeekGroup = {
  key: string;
  /** "23–29 KAS", "30 KAS – 6 ARA", "FİNAL DÖNEMİ · 2–17 OCA" */
  label: string;
  rows: Row[];
  /** "%40 + tahmini %5" */
  weight: string | null;
  exactWeight: number;
  estimatedWeight: number;
};

/** "23–29 KAS" or "30 KAS – 6 ARA". */
export function weekLabel(from: string): string {
  const to = shiftDay(from, 6);
  const [, m1, d1] = from.split("-").map(Number);
  const [, m2, d2] = to.split("-").map(Number);
  const upper = (m: number) => MONTH_SHORT[m - 1].toLocaleUpperCase("tr");
  return m1 === m2 ? `${d1}–${d2} ${upper(m1)}` : `${d1} ${upper(m1)} – ${d2} ${upper(m2)}`;
}

function weightText(exact: number, estimated: number): string | null {
  const parts = [
    exact > 0 ? percent(Math.round(exact * 10) / 10) : null,
    estimated > 0 ? `tahmini ${percent(Math.round(estimated * 10) / 10)}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" + ") : null;
}

function group(keyText: string, label: string, rows: Row[]): WeekGroup {
  const counted = rows.filter((row) => row.weight !== null);
  const exact = counted.filter((r) => !r.estimated).reduce((s, r) => s + (r.weight ?? 0), 0);
  const estimated = counted.filter((r) => r.estimated).reduce((s, r) => s + (r.weight ?? 0), 0);
  return {
    key: keyText,
    label,
    rows,
    weight: weightText(exact, estimated),
    exactWeight: exact,
    estimatedWeight: estimated,
  };
}

export type Term = {
  /** Weeks gone by, folded ("Geçenler"). */
  past: Row[];
  weeks: WeekGroup[];
  finals: WeekGroup | null;
  /** No date and no estimate ("Tahmin edilemeyen"). */
  unknown: Row[];
};

/** The term's work by week, from this week on (okul-sayfalar.md, "Ana sayfa"). */
export function termOf(
  rows: Row[],
  term: { finals_from: string | null; finals_to: string | null } | null,
  now: Date,
): Term {
  const today = dayKey(now);
  const thisWeek = weekStart(today);
  const inFinals = (row: Row) =>
    term?.finals_from && term.finals_to && row.date !== null
      ? row.date >= term.finals_from && row.date <= term.finals_to
      : false;
  const dated = rows.filter((row) => row.date !== null);
  const past = dated.filter((row) => (row.date as string) < thisWeek);
  const ahead = dated.filter((row) => (row.date as string) >= thisWeek && !inFinals(row));
  const byWeek = new Map<string, Row[]>();
  for (const row of ahead) {
    const week = weekStart(row.date as string);
    byWeek.set(week, [...(byWeek.get(week) ?? []), row]);
  }
  const weeks = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, list]) => group(week, weekLabel(week), list));
  const finalRows = dated.filter(inFinals);
  const finals =
    finalRows.length > 0 && term?.finals_from && term.finals_to
      ? group(
          "finals",
          `FİNAL DÖNEMİ · ${finalsRange(term.finals_from, term.finals_to)}`,
          finalRows,
        )
      : null;
  return { past, weeks, finals, unknown: rows.filter((row) => row.date === null) };
}

function finalsRange(from: string, to: string): string {
  const [, m1, d1] = from.split("-").map(Number);
  const [, m2, d2] = to.split("-").map(Number);
  const upper = (m: number) => MONTH_SHORT[m - 1].toLocaleUpperCase("tr");
  return m1 === m2 ? `${d1}–${d2} ${upper(m1)}` : `${d1} ${upper(m1)} – ${d2} ${upper(m2)}`;
}

/** The day column of a row: "24" over "Kas Sal". */
export function dayColumn(day: string): { date: string; under: string } {
  const [, month, date] = day.split("-").map(Number);
  return {
    date: String(date),
    under: `${MONTH_SHORT[month - 1]} ${WEEKDAY_SHORT[weekdayOf(day) - 1]}`,
  };
}

/** The minutes as the pages write them; a placeholder total says "yaklaşık". */
export function progressText(progress: NonNullable<Row["progress"]>): string {
  const minutes = (n: number) => {
    if (n < 60) return `${n} dk`;
    const h = Math.floor(n / 60);
    const m = n % 60;
    return m === 0 ? `${h} sa` : `${h} sa ${m} dk`;
  };
  if (progress.total === null) return `${progress.label} ${minutes(progress.done)}`;
  return `${progress.label} ${minutes(progress.done)} / ${progress.provisional ? "yaklaşık " : ""}${minutes(progress.total)}`;
}

/** "dokümanlar hazır" or "dokümanlar: 1 Ara". */
export function docsText(docs: NonNullable<Row["docs"]>): string {
  if (docs.ready) return "dokümanlar hazır";
  return docs.day ? `dokümanlar: ${dayMonth(docs.day)}` : "dokümanlar bekliyor";
}

// --- A course ---------------------------------------------------------------------------------

export type CourseSummary = {
  total: number;
  disclosed: number;
  /** "Açıklanan %9,7 · kalan %90,3" */
  disclosedLine: string;
  absences: ReturnType<typeof remainingAbsences>;
  next: { title: string; days: number } | null;
};

export function courseSummary(
  course: Course,
  assessments: Assessment[],
  sessions: ClassSession[],
  now: Date,
): CourseSummary {
  const today = dayKey(now);
  const mine = assessments.filter((a) => a.course_id === course.id);
  const scored = mine.map((a) => ({
    score: a.score === null ? null : Number(a.score),
    weight: a.weight === null ? null : Number(a.weight),
    excluded: a.excluded,
  }));
  const total = runningTotal(scored);
  const disclosed = disclosedWeight(scored);
  const all = totalWeight(scored);
  const next = mine
    .filter((a) => a.date && a.date >= today && a.status !== "done" && !a.submitted_at)
    .filter((a) => a.status !== "cancelled")
    .sort((a, b) => (a.date as string).localeCompare(b.date as string))[0];
  const rest = Math.max(0, Math.round((Math.max(all, 100) - disclosed) * 10) / 10);
  return {
    total,
    disclosed,
    disclosedLine: `Açıklanan ${percent(disclosed)} · kalan ${percent(rest)}`,
    absences: remainingAbsences(
      course,
      sessions.filter((session) => session.course_id === course.id),
    ),
    next: next ? { title: next.title, days: daysUntil(today, next.date as string) } : null,
  };
}

/** A score's part of the total: "not 90 → 2,7 puan". */
export function scoreLine(a: Pick<Assessment, "score" | "weight" | "excluded">): string | null {
  const points = weightedScore({
    score: a.score === null ? null : Number(a.score),
    weight: a.weight === null ? null : Number(a.weight),
    excluded: a.excluded,
  });
  if (a.score === null) return null;
  const score = Number(a.score);
  return points === null
    ? `not ${score}`
    : `not ${score} → ${String(Math.round(points * 100) / 100).replace(".", ",")} puan`;
}
