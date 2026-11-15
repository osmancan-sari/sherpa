import { describe, expect, it } from "vitest";
import { moduleRow, task, workItem } from "@/core/testing/factories";
import type { WeekPlanRow } from "@/core/types";
import { istanbulInstant, shiftDay } from "@/lib/date";
import { calendarOf } from "./calendar";
import { buildPlan } from "./plan";
import { DEFAULT_SETTINGS } from "./slots";
import type { PlanInput } from "./types";
import type { LoadInput } from "./week";

// Takvim's data (docs/04-planlayici.md, "Takvim'in verisi", Ç4a): the forecast, the week's work
// and the coming weeks, for the week shown.

const DATE = "2026-11-12"; // a Thursday
const MONDAY = "2026-11-09";
const at = (time: string, day = DATE) => istanbulInstant(day, time);
const mod = moduleRow();
const settings = { ...DEFAULT_SETTINGS, bedtime: "19:00" };

const thesis = workItem({
  module_id: mod.id,
  title: "Tez",
  effort_total_minutes: 600,
  effort_done_minutes: 60,
  due_at: at("23:59", shiftDay(DATE, 20)).toISOString(),
});
const form = task({
  module_id: mod.id,
  title: "Form",
  est_minutes: 20,
  due_at: at("17:00", shiftDay(DATE, 1)).toISOString(),
});

const input: PlanInput = {
  now: at("08:00"),
  date: DATE,
  dayType: "home",
  dayStart: at("08:00"),
  bedtime: at("19:00"),
  blocks: [],
  tasks: [form],
  workItems: [thesis],
  rhythms: [],
  rhythmLogs: [],
  modules: [mod],
  context: "desk",
  settings,
  stats: [],
  committed: [thesis.id],
  shares: { [thesis.id]: { minutes: 180, from: 0 } },
};
const load: LoadInput = {
  now: at("08:00"),
  items: [thesis],
  tasks: [form],
  rhythms: [],
  modules: [mod],
  blocks: [],
  settings,
  stats: [],
};
const weekPlan = {
  week_start: MONDAY,
  committed: [thesis.id],
  shares: { [thesis.id]: { minutes: 180, from: 0 } },
  reasons: { [thesis.id]: "Bu hafta üç oturum." },
} as unknown as WeekPlanRow;

describe("calendarOf", () => {
  it("gives this week's days after today, its work with the stored share and note, eight weeks", () => {
    const data = calendarOf({
      input,
      plan: buildPlan(input),
      load,
      weekPlans: [weekPlan],
      week: DATE,
    });
    expect(data.days.map((day) => day.date)).toEqual(["2026-11-13", "2026-11-14", "2026-11-15"]);
    expect(data.work.map((row) => row.title)).toEqual(["Form", "Tez"]);
    expect(data.work.find((row) => row.id === thesis.id)).toMatchObject({
      shareMinutes: 180,
      workedMinutes: 60,
      note: "Bu hafta üç oturum.",
    });
    expect(data.weeks).toHaveLength(8);
    expect(data.weeks[0].weekStart).toBe(MONDAY);
  });

  it("for next week: all its days forecast, no stored commitment, the spreading's share", () => {
    const next = shiftDay(MONDAY, 7);
    const data = calendarOf({
      input,
      plan: buildPlan(input),
      load,
      weekPlans: [weekPlan],
      week: shiftDay(next, 3),
    });
    expect(data.days.map((day) => day.date)).toEqual(
      Array.from({ length: 7 }, (_, index) => shiftDay(next, index)),
    );
    const row = data.work.find((entry) => entry.id === thesis.id)!;
    expect(row.note).toBeNull();
    expect(row.workedMinutes).toBe(0);
    expect(row.shareMinutes).toBeGreaterThan(0);
    expect(data.weeks[0].weekStart).toBe(next);
  });
});
