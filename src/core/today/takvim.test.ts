import { describe, expect, it } from "vitest";
import { rhythm, session, task, workItem } from "@/core/testing/factories";
import { istanbulInstant } from "@/lib/date";
import { doneOn, dueOn, dueText, horizonNote, sessionTaskIds, weekLabel } from "./takvim";

// Takvim's words and lists (docs/tasarim/ekranlar/takvim.md; Ç4c). Pure.

const iso = (day: string, time: string) => istanbulInstant(day, time).toISOString();

describe("weekLabel", () => {
  it("names a week in one month, across two months and across two years", () => {
    expect(weekLabel("2026-11-09")).toBe("9–15 Kasım");
    expect(weekLabel("2026-11-30")).toBe("30 Kasım–6 Aralık");
    expect(weekLabel("2026-12-28")).toBe("28 Aralık–3 Ocak 2027");
  });
});

describe("dueText", () => {
  const now = istanbulInstant("2026-11-13", "14:10");
  it("says the weekday within the coming six days, else the date", () => {
    expect(dueText(iso("2026-11-15", "23:59"), now)).toBe("Teslim Pazar, 15 Kas");
    expect(dueText(iso("2026-11-16", "09:00"), now)).toBe("Teslim Pazartesi, 16 Kas");
    expect(dueText(iso("2026-12-03", "09:00"), now)).toBe("Teslim 3 Ara");
  });
});

describe("horizonNote", () => {
  it("says the week's work against its time and its deadlines", () => {
    const load = {
      weekStart: "2026-11-30",
      capacityMinutes: 30 * 60,
      demandMinutes: 34 * 60,
      byModule: {},
      deadlines: [
        { id: "a", title: "A", dueAt: iso("2026-12-01", "10:00"), weight: 1 },
        { id: "b", title: "B", dueAt: iso("2026-12-02", "10:00"), weight: 1 },
        { id: "c", title: "C", dueAt: iso("2026-12-03", "10:00"), weight: 1 },
      ],
      over: true,
    };
    expect(horizonNote(load)).toBe("30 Kasım haftası: 34 sa iş, 30 sa vakit · 3 teslim");
    expect(horizonNote({ ...load, deadlines: [] })).toBe("30 Kasım haftası: 34 sa iş, 30 sa vakit");
  });
});

describe("dueOn", () => {
  it("lists the items and the tasks of their own due on the day, by the hour", () => {
    const exam = workItem({ title: "Midterm", due_at: iso("2026-11-12", "10:30") });
    const report = task({ title: "Rapor", due_at: iso("2026-11-12", "09:00") });
    const sitting = task({
      title: "Oturum",
      work_item_id: exam.id,
      due_at: iso("2026-11-12", "08:00"),
    });
    const other = task({ title: "Başka gün", due_at: iso("2026-11-13", "09:00") });
    const dropped = task({
      title: "Bırakılan",
      status: "dropped",
      due_at: iso("2026-11-12", "11:00"),
    });
    const rows = dueOn("2026-11-12", [exam], [report, sitting, other, dropped]);
    expect(rows.map((row) => row.title)).toEqual(["Rapor", "Midterm"]);
  });
});

describe("doneOn", () => {
  it("adds up a work's sessions of the day, in the order first started; open ones are left out", () => {
    const essay = task({ title: "Deneme yazısı" });
    const morning = rhythm({ title: "Sabah" });
    const day = "2026-11-12";
    const rows = doneOn(
      day,
      [
        session({ task_id: essay.id, started_at: iso(day, "10:00"), ended_at: iso(day, "10:40") }),
        session({
          rhythm_id: morning.id,
          started_at: iso(day, "07:05"),
          ended_at: iso(day, "07:10"),
        }),
        session({ task_id: essay.id, started_at: iso(day, "15:00"), ended_at: iso(day, "15:20") }),
        session({ title: "Plansız", started_at: iso(day, "16:00"), ended_at: iso(day, "16:30") }),
        session({ task_id: essay.id, started_at: iso(day, "18:00"), ended_at: null }),
        session({
          task_id: essay.id,
          started_at: iso("2026-11-11", "10:00"),
          ended_at: iso("2026-11-11", "11:00"),
        }),
      ],
      { tasks: [essay], items: [], rhythms: [morning] },
    );
    expect(rows.map((row) => [row.title, row.minutes])).toEqual([
      ["Sabah", 5],
      ["Deneme yazısı", 60],
      ["Plansız", 30],
    ]);
    expect(
      sessionTaskIds(day, [session({ task_id: essay.id, started_at: iso(day, "10:00") })]),
    ).toEqual([essay.id]);
  });
});
