import { describe, expect, it } from "vitest";
import { dayRow, moduleRow, settingsRow } from "@/core/testing/factories";
import {
  buildPlan,
  dayStartClock,
  plannerSettings,
  planningDay,
  type PlanRows,
  planInput,
} from "@/core/planner";
import type { DayRow, Settings } from "@/core/types";
import { istanbulInstant } from "@/lib/date";
import { briefOf } from "./brief";

// The day in short for a scene (docs/06-modul-sozlesmesi.md, `TodayBrief`; Ç3g): the planning
// day, where the waking came from, tomorrow's expected waking and tonight's sleep as the planner
// has them (a real bedtime moves them, taking it back moves them back).

const DATE = "2026-11-12";
const NEXT = "2026-11-13";
const at = (time: string, day = DATE) => istanbulInstant(day, time);

function rows(days: Partial<DayRow>[] = [], settings: Settings | null = settingsRow()): PlanRows {
  return {
    settings,
    modules: [moduleRow()],
    tasks: [],
    workItems: [],
    rhythms: [],
    rhythmLogs: [],
    blocks: [],
    sessions: [],
    openSession: null,
    prompts: [],
    inbox: [],
    days: days.map((day) => dayRow({ date: DATE, ...day })),
    weekPlans: [],
    lifeModes: [],
    stats: [],
  };
}

function brief(time: string, data: PlanRows, day = DATE) {
  const now = at(time, day);
  // The day as the screen picks it (useTodayPlan): the planning day of the moment.
  const date = planningDay(now, dayStartClock(plannerSettings(data.settings)));
  const input = planInput(data, { date, now, context: "desk" });
  return briefOf(input, buildPlan(input), new Map());
}

describe("the day in short (Ç3g)", () => {
  it("carries the planning day: past midnight it is still the evening's", () => {
    expect(brief("21:00", rows()).date).toBe(DATE);
    expect(brief("00:20", rows(), NEXT).date).toBe(DATE);
  });

  it("says where the waking came from", () => {
    const woke = { woke_at: at("07:00").toISOString() };
    expect(brief("06:30", rows()).wokeFrom).toBeNull();
    expect(brief("08:00", rows([{ ...woke, woke_source: "outside" }])).wokeFrom).toBe("outside");
    expect(brief("08:00", rows([{ ...woke, woke_source: "screen" }])).wokeFrom).toBe("screen");
    expect(
      brief("08:00", rows([{ ...woke, woke_estimated: true, woke_source: "estimate" }])).wokeFrom,
    ).toBe("estimate");
    // Written before the source was kept: a screen's.
    expect(brief("08:00", rows([woke])).wokeFrom).toBe("screen");
  });

  it("gives tomorrow's expected waking and tonight's sleep, moved by a real bedtime", () => {
    const woke = { woke_at: at("07:00").toISOString() };
    // A light tomorrow: waking at the range's end (09:00), bed eight hours before.
    expect(brief("21:00", rows([woke])).tomorrow).toEqual({
      wake: at("09:00", NEXT),
      sleepMinutes: 480,
    });
    // Bed at 23:30: the waking comes forward to 07:30, eight hours.
    expect(brief("23:35", rows([{ ...woke, bed_at: at("23:30").toISOString() }])).tomorrow).toEqual(
      { wake: at("07:30", NEXT), sleepMinutes: 480 },
    );
    // Taken back (the bedtime is gone): the plan's values again.
    expect(brief("23:35", rows([woke])).tomorrow?.wake).toEqual(at("09:00", NEXT));
  });

  it("is null without the day's frame", () => {
    const off = brief("21:00", rows([], settingsRow({ day_frame: null })));
    expect(off.tomorrow).toBeNull();
    expect(off.wokeFrom).toBeNull();
  });
});
