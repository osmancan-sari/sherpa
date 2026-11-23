import { describe, expect, it } from "vitest";
import {
  attendanceOf,
  disclosedWeight,
  docDay,
  hasAttendanceRule,
  prepProgress,
  remainingAbsences,
  runningTotal,
  weightedScore,
} from "./derive";

// okul.md section 3, "Türetilen değerler"; prompts/okul-adim-1.md, "Testler" → "Türetilenler".

const row = (score: number | null, weight: number | null, excluded = false) => ({
  score,
  weight,
  excluded,
});

describe("scores", () => {
  it("weighs a score by its weight; none when excluded, unscored or unweighted", () => {
    expect(weightedScore(row(80, 20))).toBe(16);
    expect(weightedScore(row(80, 20, true))).toBeNull();
    expect(weightedScore(row(null, 20))).toBeNull();
    expect(weightedScore(row(80, null))).toBeNull();
  });

  it("adds a course's weighted scores, excluded ones out; the disclosed weight likewise", () => {
    const rows = [row(80, 20), row(50, 10), row(100, 30, true), row(null, 40)];
    expect(runningTotal(rows)).toBe(21);
    expect(disclosedWeight(rows)).toBe(30);
    expect(runningTotal([])).toBe(0);
  });
});

const lesson = (attendance: string | null, kind = "lecture", kepler: string | null = null) => ({
  kind,
  attendance,
  kepler_attendance: kepler,
});

describe("absences", () => {
  it("asks only in a course with an attendance condition", () => {
    expect(hasAttendanceRule({ absence_limit: null, attendance_min_pct: null })).toBe(false);
    expect(hasAttendanceRule({ absence_limit: 3, attendance_min_pct: null })).toBe(true);
    expect(hasAttendanceRule({ absence_limit: null, attendance_min_pct: 70 })).toBe(true);
    expect(
      remainingAbsences({ absence_limit: null, attendance_min_pct: null }, [lesson("missed")]),
    ).toBeNull();
  });

  it("a count of allowed absences: what is left after the misses", () => {
    const sessions = [lesson("attended"), lesson("missed"), lesson(null), lesson("missed")];
    expect(remainingAbsences({ absence_limit: 3, attendance_min_pct: null }, sessions)).toEqual({
      held: 4,
      missed: 2,
      attended: 1,
      allowed: 3,
      remaining: 1,
    });
  });

  it("a share to attend: 'Yapılmadı' leaves the denominator, holidays and exams are not lessons", () => {
    // 10 lessons held (one more not held), a holiday and an exam: 30% of 10 may be missed.
    const sessions = [
      ...Array.from({ length: 8 }, () => lesson("attended")),
      lesson("missed"),
      lesson(null),
      lesson("not_held"),
      lesson(null, "holiday"),
      lesson(null, "exam"),
    ];
    const absences = remainingAbsences({ absence_limit: null, attendance_min_pct: 70 }, sessions);
    expect(absences).toMatchObject({ held: 10, missed: 1, allowed: 3, remaining: 2 });
    // Without the session that did not take place it would be 11 held: still 3 allowed (floor).
    const withIt = remainingAbsences({ absence_limit: null, attendance_min_pct: 80 }, sessions);
    expect(withIt).toMatchObject({ held: 10, allowed: 2, remaining: 1 });
  });

  it("Kepler's record counts over the user's mark; 'Yapılmadı' over Kepler's", () => {
    expect(attendanceOf(lesson("attended", "lecture", "absent"))).toBe("missed");
    expect(attendanceOf(lesson(null, "lecture", "present"))).toBe("attended");
    expect(attendanceOf(lesson("not_held", "lecture", "absent"))).toBe("not_held");
    expect(attendanceOf(lesson("missed"))).toBe("missed");
  });

  it("never goes below zero", () => {
    const sessions = [lesson("missed"), lesson("missed"), lesson("missed")];
    expect(
      remainingAbsences({ absence_limit: 1, attendance_min_pct: null }, sessions),
    ).toMatchObject({ remaining: 0 });
  });
});

describe("preparation", () => {
  it("the document day: a quiz a week before, a midterm and a final two weeks before", () => {
    expect(docDay("quiz", "2026-12-09")).toBe("2026-12-02");
    expect(docDay("midterm", "2026-12-09")).toBe("2026-11-25");
    expect(docDay("final", "2027-01-05")).toBe("2026-12-22");
    expect(docDay("homework", "2026-12-09")).toBeNull();
    expect(docDay("quiz", null)).toBeNull();
  });

  it("the progress of a preparation: minutes worked of its effort", () => {
    expect(prepProgress(120, 480)).toEqual({ done: 120, total: 480, share: 0.25 });
    expect(prepProgress(600, 480)).toEqual({ done: 600, total: 480, share: 1 });
    expect(prepProgress(30, null)).toEqual({ done: 30, total: null, share: null });
  });
});
