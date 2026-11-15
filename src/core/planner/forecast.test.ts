import { describe, expect, it } from "vitest";
import { block, moduleRow, rhythm, rhythmLog, task, workItem } from "@/core/testing/factories";
import { istanbulInstant, shiftDay } from "@/lib/date";
import { forecastDays, FORECAST_WEEKS } from "./forecast";
import { DAYS_AHEAD } from "./frame";
import { buildPlan } from "./plan";
import { DEFAULT_SETTINGS } from "./slots";
import type { PlanInput } from "./types";

// The plan of the days ahead (docs/04-planlayici.md, "Gelecek günlerin tahmini", Ç4a): the same
// rules day after day, what was put on a day before counted as done; never stored, today's plan
// untouched.

const DATE = "2026-11-12"; // a Thursday
const NEXT = shiftDay(DATE, 1);
const at = (time: string, day = DATE) => istanbulInstant(day, time);
const iso = (time: string, day = DATE) => at(time, day).toISOString();

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    now: at("08:00"),
    date: DATE,
    dayType: "home",
    dayStart: at("08:00"),
    bedtime: at("19:00"),
    blocks: [],
    tasks: [],
    workItems: [],
    rhythms: [],
    rhythmLogs: [],
    modules: [moduleRow()],
    context: "desk",
    settings: { ...DEFAULT_SETTINGS, bedtime: "19:00" },
    stats: [],
    ...overrides,
  };
}

/** Settings whose days end at 09:30 (as a frame would set them): 63 minutes of work a day. */
const shortDays = {
  ...DEFAULT_SETTINGS,
  dayEnds: Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => {
      const day = shiftDay(DATE, index);
      return [day, at("09:30", day).getTime()];
    }),
  ),
};

const ids = (day: { work: { assignment: { candidate: { id: string } } }[] }) =>
  day.work.map((row) => row.assignment.candidate.id);

const forecast = (base: PlanInput, to = shiftDay(DATE, 6), from = NEXT) =>
  forecastDays(base, buildPlan(base), { from, to });

describe("forecastDays", () => {
  it("puts work today cannot hold on the days after, and what today holds is not planned again", () => {
    // Today 08:00–09:30: room for one 45-minute task (90 × 0.7 = 63).
    const tasks = [1, 2, 3].map((n) => task({ title: `İş ${n}`, est_minutes: 45 }));
    const base = input({ tasks, bedtime: at("09:30") });
    const today = buildPlan(base);
    const todays = today.slots.flatMap((slot) =>
      slot.assignment ? [slot.assignment.candidate.id] : [],
    );
    expect(todays.length).toBe(1);
    const [tomorrow] = forecastDays(base, today, { from: NEXT, to: NEXT });
    expect(tomorrow.date).toBe(NEXT);
    // Tomorrow runs to 19:00 (the settings' bedtime): the other two fit; today's is not there.
    expect(ids(tomorrow).sort()).toEqual(
      tasks
        .map((row) => row.id)
        .filter((id) => !todays.includes(id))
        .sort(),
    );
  });

  it("counts what it put on a day as done for the days after", () => {
    // Each day holds 63 minutes (08:00–09:30 × 0.7): one 45-minute task a day.
    const settings = shortDays;
    const tasks = [1, 2, 3, 4].map((n) =>
      task({ title: `İş ${n}`, est_minutes: 45, importance: 5 - n }),
    );
    const base = input({ tasks, settings, bedtime: at("09:30") });
    const days = forecast(base, shiftDay(DATE, 3));
    const placed = days.map(ids);
    expect(placed.map((row) => row.length)).toEqual([1, 1, 1]);
    expect(new Set(placed.flat()).size).toBe(3);
    expect(days.map((day) => day.plannedMinutes)).toEqual([45, 45, 45]);
  });

  it("works a work item's sittings off one after another, and its share for the week", () => {
    const item = workItem({ title: "Tez", effort_total_minutes: 180, session_minutes: 45 });
    const sittings = [1, 2, 3, 4].map((position) =>
      task({ work_item_id: item.id, est_minutes: 45, position }),
    );
    const settings = shortDays;
    const base = input({ workItems: [item], tasks: sittings, settings, bedtime: at("09:30") });
    const days = forecast(base, shiftDay(DATE, 3));
    // Today has the first sitting; the days after, the next ones in their order.
    expect(days.map(ids)).toEqual([[sittings[1].id], [sittings[2].id], [sittings[3].id]]);
    // This week's share is 90 minutes: two sittings. Once both are worked the item waits; the
    // next week has no commitment yet, so the item itself is offered then.
    const shared = input({
      ...base,
      tasks: sittings.slice(0, 2),
      committed: [item.id],
      shares: { [item.id]: { minutes: 90, from: 0 } },
    });
    const week = forecast(shared, shiftDay(DATE, 4));
    expect(week.map(ids)).toEqual([[sittings[1].id], [], [], [item.id]]);
  });

  it("does a rhythm as its period asks, counting the doings it planned", () => {
    const walk = rhythm({ title: "Yürüyüş", target_count: 2, period: "week", est_minutes: 30 });
    const base = input({ rhythms: [walk], rhythmLogs: [rhythmLog(walk.id, "2026-11-10")] });
    // One left this week: today's plan takes it; nothing until Monday's week.
    const days = forecast(base, shiftDay(DATE, 4));
    expect(days.map(ids)).toEqual([[], [], [], [walk.id]]);
  });

  it("keeps to the days' blocks and the work's windows", () => {
    const friday = NEXT;
    const busy = block({ starts_at: iso("08:00", friday), ends_at: iso("19:00", friday) });
    const gym = task({
      title: "Salon",
      est_minutes: 45,
      timing: { windows: [{ days: [6], from: "10:00", to: "12:00" }] },
    });
    const days = forecast(input({ tasks: [gym], blocks: [busy] }), shiftDay(DATE, 3));
    expect(days.map((day) => [day.date, ids(day)])).toEqual([
      [friday, []],
      ["2026-11-14", [gym.id]],
      ["2026-11-15", []],
    ]);
    expect(days[0].usableMinutes).toBe(0);
  });

  it("does not forecast routines bound to the waking or the bedtime", () => {
    const morning = rhythm({ period: "day", target_count: 1, timing: { anchor: "wake" } });
    expect(forecast(input({ rhythms: [morning] }), NEXT).map(ids)).toEqual([[]]);
  });

  it("gives the same forecast for the same input and leaves today's plan as it was", () => {
    const item = workItem({ effort_total_minutes: 300, due_at: iso("18:00", shiftDay(DATE, 5)) });
    const tasks = [
      task({ title: "Rapor", est_minutes: 60, energy: "deep" }),
      task({ title: "Fatura", est_minutes: 15, due_at: iso("17:00", NEXT) }),
      task({ work_item_id: item.id, est_minutes: 45, position: 1 }),
    ];
    const base = input({ tasks, workItems: [item], rhythms: [rhythm({ target_count: 3 })] });
    const before = JSON.stringify(buildPlan(base));
    const rows = JSON.stringify(base);
    const first = forecast(base);
    const second = forecast(base);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(buildPlan(base))).toBe(before);
    expect(JSON.stringify(base)).toBe(rows);
  });

  it("returns the days asked for, and none past its reach", () => {
    const base = input({ tasks: [task()] });
    const week = forecast(base, "2026-11-22", "2026-11-16");
    expect(week.map((day) => day.date)).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
    const far = shiftDay(DATE, FORECAST_WEEKS * 7);
    const beyond = forecast(base, shiftDay(far, 7), far);
    expect(beyond.map((day) => day.date)).toEqual([far]);
  });

  it("does not carry the device's context to the days ahead: they are planned with the filter off", () => {
    const office = task({ title: "Ofis işi", context: "office" });
    const desk = input({ tasks: [office] });
    // On the second screen today the office work is not a candidate…
    expect(buildPlan(desk).slots.some((slot) => slot.assignment)).toBe(false);
    // …but where one will be tomorrow is not known: it is forecast.
    expect(forecast(desk, NEXT).map(ids)).toEqual([[office.id]]);
    const campus = input({ tasks: [office], context: "campus" });
    expect(JSON.stringify(forecast(campus, NEXT))).toBe(JSON.stringify(forecast(desk, NEXT)));
  });

  it("counts the weekly floor's minutes week by week", () => {
    const sport = moduleRow({ kind: "lifelong", weekly_floor_minutes: 45 });
    // Each day holds one 45-minute run (shortDays): Thursday, Friday, Saturday, Sunday.
    const runs = [1, 2, 3, 4].map((n) =>
      task({ module_id: sport.id, title: `Koşu ${n}`, est_minutes: 45, importance: 1 }),
    );
    const base = input({
      modules: [sport],
      tasks: runs,
      settings: shortDays,
      bedtime: at("09:30"),
      spentThisWeek: {},
    });
    const sunday = "2026-11-15";
    const [day] = forecastDays(base, buildPlan(base), { from: sunday, to: sunday });
    // Sunday has its run; the minutes the forecast put on the days before count for the floor,
    // so it is no floor work there.
    expect(day.work).toHaveLength(1);
    expect(day.work[0].assignment.candidate.mandatory).toBeNull();
    // Planned on its own with nothing worked this week, Sunday's run would keep the floor.
    const alone = buildPlan(
      input({
        ...base,
        date: sunday,
        now: at("08:00", sunday),
        dayStart: at("08:00", sunday),
        bedtime: at("09:30", sunday),
      }),
    );
    expect(alone.candidates.some((row) => row.mandatory === "floor")).toBe(true);
  });

  it("gives a follow-up once", () => {
    const waiting = task({ status: "waiting", follow_up_on: NEXT, title: "Hocadan cevap" });
    const days = forecast(input({ tasks: [waiting] }), shiftDay(DATE, 3));
    expect(days.map(ids)).toEqual([[waiting.id], [], []]);
  });

  it("reaches no further than the frame works out each day's start and end", () => {
    // Every forecast day has its routines left out of its start and end (frame.ts, DAYS_AHEAD).
    expect(DAYS_AHEAD).toBeGreaterThanOrEqual(FORECAST_WEEKS * 7 + 1);
  });
});
