import { describe, expect, it } from "vitest";
import { moduleRow, session, task } from "@/core/testing/factories";
import { istanbulInstant, shiftDay } from "@/lib/date";
import { capacityFactors, estimateMultipliers, type PlannedDay } from "./learn";

// Learning (docs/04-planlayici.md, "Öğrenme").

const DAY = "2026-11-02";
const sat = (day: string, minutes: number, measured = true) => {
  const start = istanbulInstant(day, "10:00");
  return session({
    started_at: start.toISOString(),
    ended_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
    measured,
  });
};

describe("estimate multipliers", () => {
  const mod = moduleRow({ slug: "okul" });
  const sittings = (minutes: number[], measured = true) =>
    minutes.map((real, index) => {
      const work = task({ module_id: mod.id, kind: "prep", est_minutes: 30, status: "done" });
      return { work, run: { ...sat(shiftDay(DAY, index), real, measured), task_id: work.id } };
    });

  it("takes the median of real ÷ estimate; unmeasured sessions do not count", () => {
    const measured = sittings([30, 45, 45, 60, 90]);
    const unmeasured = sittings([600, 600, 600], false);
    const all = [...measured, ...unmeasured];
    const stats = estimateMultipliers(
      all.map((row) => row.run),
      all.map((row) => row.work),
      [mod],
    );
    expect(stats).toEqual([{ key: "est_multiplier:okul:prep", value: 1.5, sample_size: 5 }]);
  });

  it("needs five samples, and stays between 0.5 and 3", () => {
    const few = sittings([60, 60, 60, 60]);
    expect(
      estimateMultipliers(
        few.map((row) => row.run),
        few.map((row) => row.work),
        [mod],
      ),
    ).toEqual([]);
    const slow = sittings([300, 300, 300, 300, 300]);
    expect(
      estimateMultipliers(
        slow.map((row) => row.run),
        slow.map((row) => row.work),
        [mod],
      )[0].value,
    ).toBe(3);
  });

  it("looks at the last 20 sessions only", () => {
    const old = sittings(Array(20).fill(90));
    const recent = sittings(Array(20).fill(30)).map(({ work, run }, index) => ({
      work,
      run: {
        ...run,
        started_at: istanbulInstant(shiftDay("2026-12-01", index), "10:00").toISOString(),
        ended_at: istanbulInstant(shiftDay("2026-12-01", index), "10:30").toISOString(),
      },
    }));
    const all = [...old, ...recent];
    expect(
      estimateMultipliers(
        all.map((row) => row.run),
        all.map((row) => row.work),
        [mod],
      )[0],
    ).toMatchObject({ value: 1, sample_size: 20 });
  });
});

describe("capacity factors", () => {
  const days = (count: number, type: PlannedDay["dayType"] = "home"): PlannedDay[] =>
    Array.from({ length: count }, (_, index) => ({
      date: shiftDay(DAY, index),
      dayType: type,
      slotMinutes: 400,
    }));

  it("averages worked ÷ slot minutes per day type; unmeasured sessions do not count", () => {
    const planned = days(5);
    const sessions = planned.flatMap((day) => [sat(day.date, 200), sat(day.date, 400, false)]);
    expect(capacityFactors(planned, sessions)).toEqual([
      { key: "capacity:home", value: 0.5, sample_size: 5 },
    ]);
  });

  it("needs five days of a type", () => {
    expect(capacityFactors(days(4), [])).toEqual([]);
  });

  it("does not let days without tracking empty the plan", () => {
    expect(capacityFactors(days(6), [])[0].value).toBe(0.2);
  });
});
