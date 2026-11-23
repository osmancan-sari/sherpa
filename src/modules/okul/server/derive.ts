import { shiftDay } from "@/lib/date";

// The values okul.md (section 3, "Türetilen değerler") derives from the module's records. Pure:
// the pages, the rules and the tests compute them the same way; nothing here is stored.

type Scored = {
  score: number | null;
  weight: number | null;
  excluded: boolean;
};

/** The weighted score of one assessment: score × weight ÷ 100; none when excluded or unknown. */
export function weightedScore(row: Scored): number | null {
  if (row.excluded || row.score === null || row.weight === null) return null;
  return (Number(row.score) * Number(row.weight)) / 100;
}

/** The running total of a course: the sum of the weighted scores so far. */
export function runningTotal(rows: Scored[]): number {
  return round1(rows.reduce((sum, row) => sum + (weightedScore(row) ?? 0), 0));
}

/** The weight already disclosed: of the assessments whose score has come. */
export function disclosedWeight(rows: Scored[]): number {
  return round1(
    rows
      .filter((row) => !row.excluded && row.score !== null && row.weight !== null)
      .reduce((sum, row) => sum + Number(row.weight), 0),
  );
}

/** The weight of the course's assessments that count (excluded ones out). */
export function totalWeight(rows: Scored[]): number {
  return round1(
    rows.filter((row) => !row.excluded).reduce((sum, row) => sum + Number(row.weight ?? 0), 0),
  );
}

const round1 = (value: number) => Math.round(value * 10) / 10;

// --- Attendance ---------------------------------------------------------------------------------

type AttendanceRule = { absence_limit: number | null; attendance_min_pct: number | null };
type AttendedSession = {
  kind: string;
  attendance: string | null;
  kepler_attendance: string | null;
};

/** A course asks "Derse girdin mi?" only when it has an attendance condition (rule 15). */
export const hasAttendanceRule = (course: AttendanceRule) =>
  course.absence_limit !== null || course.attendance_min_pct !== null;

/** The sessions attendance is counted on: lessons, recitations, presentations; not exams. */
export const COUNTED_KINDS = ["lecture", "recitation", "presentation"];

/**
 * How a session counts: Kepler's record when there is one, otherwise the user's mark
 * (okul.md section 3). "Yapılmadı" is the user's and stands over Kepler's: it did not take place.
 */
export function attendanceOf(session: AttendedSession): "attended" | "missed" | "not_held" | null {
  if (session.attendance === "not_held") return "not_held";
  if (session.kepler_attendance === "present") return "attended";
  if (session.kepler_attendance === "absent") return "missed";
  return (session.attendance as "attended" | "missed" | null) ?? null;
}

export type Absences = {
  /** Sessions that take place in the term (planned ones, holidays and "Yapılmadı" out). */
  held: number;
  missed: number;
  attended: number;
  /** Absences the condition allows in all. */
  allowed: number;
  /** Absences still allowed; never below zero. */
  remaining: number;
};

/**
 * The absences left under the course's condition. A count of allowed absences is used as it is;
 * a share to attend allows the rest of the held sessions (rounded down). "Yapılmadı" leaves the
 * denominator; a holiday is not a session.
 */
export function remainingAbsences(
  course: AttendanceRule,
  sessions: AttendedSession[],
): Absences | null {
  if (!hasAttendanceRule(course)) return null;
  const counted = sessions.filter((session) => COUNTED_KINDS.includes(session.kind));
  const states = counted.map(attendanceOf);
  const held = states.filter((state) => state !== "not_held").length;
  const missed = states.filter((state) => state === "missed").length;
  const attended = states.filter((state) => state === "attended").length;
  const allowed =
    course.absence_limit !== null
      ? course.absence_limit
      : Math.floor((held * (100 - (course.attendance_min_pct as number))) / 100);
  return { held, missed, attended, allowed, remaining: Math.max(0, allowed - missed) };
}

// --- Preparation --------------------------------------------------------------------------------

/** How far a preparation has come: minutes worked of its effort ("2 sa / 8 sa"). */
export function prepProgress(
  spentMinutes: number,
  totalMinutes: number | null,
): { done: number; total: number | null; share: number | null } {
  const done = Math.max(0, Math.round(spentMinutes));
  if (totalMinutes === null || totalMinutes <= 0) return { done, total: null, share: null };
  return { done, total: totalMinutes, share: Math.min(1, done / totalMinutes) };
}

/** Days before the exam its documents are made (rule 6): a quiz's a week, the others' two. */
export const DOC_LEAD_DAYS: Record<string, number> = { quiz: 7, midterm: 14, final: 14 };

/** The document day of an exam on `date`; none for other kinds or without a date. */
export function docDay(kind: string, date: string | null): string | null {
  const lead = DOC_LEAD_DAYS[kind];
  if (lead === undefined || date === null) return null;
  return shiftDay(date, -lead);
}
