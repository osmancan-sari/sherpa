import { describe, expect, it } from "vitest";
import { readSentence } from "./sentence";

// okul.md section 7, `assessment`: one sentence ("Quiz 4 3 Aralık") or a short form.

const now = new Date("2026-11-23T10:00:00+03:00"); // a Monday

describe("one sentence to an assessment", () => {
  it("reads the kind, the day in words and the title", () => {
    expect(readSentence("Quiz 4 3 Aralık", now)).toEqual({
      title: "Quiz 4",
      kind: "quiz",
      date: "2026-12-03",
      time: null,
    });
  });

  it("reads a numeric day and an hour", () => {
    expect(readSentence("Midterm 9/12 10:30", now)).toMatchObject({
      title: "Midterm",
      kind: "midterm",
      date: "2026-12-09",
      time: "10:30",
    });
    expect(readSentence("Ödev 3 teslim 5.1 23:59", now)).toMatchObject({
      kind: "homework",
      date: "2027-01-05",
      time: "23:59",
    });
  });

  it("reads 'yarın' and a weekday ahead", () => {
    expect(readSentence("Quiz yarın", now).date).toBe("2026-11-24");
    expect(readSentence("Sunum perşembe", now).date).toBe("2026-11-26");
    expect(readSentence("Final pazartesi", now).date).toBe("2026-11-30");
  });

  it("reads a day written with a dot as a day, an hour only with a colon or after 'saat'", () => {
    expect(readSentence("Midterm 10.12", now)).toMatchObject({ date: "2026-12-10", time: null });
    expect(readSentence("Quiz 4 saat 9.30 yarın", now)).toMatchObject({
      date: "2026-11-24",
      time: "09:30",
    });
  });

  it("reads kinds that end in a Turkish letter", () => {
    expect(readSentence("proje adımı ara rapor 12 aralık", now)).toMatchObject({
      kind: "project_step",
      date: "2026-12-12",
    });
    expect(readSentence("ödev 3 5 aralık", now).kind).toBe("homework");
  });

  it("leaves what it cannot read empty", () => {
    expect(readSentence("Hocaya mail at", now)).toEqual({
      title: "Hocaya mail at",
      kind: null,
      date: null,
      time: null,
    });
  });
});
