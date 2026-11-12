import { describe, expect, it } from "vitest";
import type { Timing } from "@/core/contract/timing";
import { block, dayRow, moduleRow, rhythm, settingsRow, task } from "@/core/testing/factories";
import type { DayRow, Settings, Task } from "@/core/types";
import { dayKey, formatTime, istanbulInstant } from "@/lib/date";
import { type SleepArgs, sleepPlan } from "./frame";
import { type PlanRows, planInput, weekSettings } from "./input";
import { buildPlan, planningDay } from "./plan";
import { dayCapacities, recommitReason } from "./week";
import type { Plan } from "./types";

// The day's frame in the planner (docs/04-planlayici.md, "Günün çerçevesi (Ç3c)" and the test
// list's Ç3c part): the sleep plan, the day's start, anchored work, the evening, the states.

const DATE = "2026-11-12"; // a Thursday
const NEXT = "2026-11-13";
const at = (time: string, day = DATE) => istanbulInstant(day, time);
const iso = (time: string, day = DATE) => at(time, day).toISOString();

// --- The sleep plan ----------------------------------------------------------------------------

/** The plan for the night of the 12th and the morning of the 13th. */
function sleep(overrides: Partial<SleepArgs> = {}) {
  return sleepPlan({
    day: NEXT,
    wake: ["06:00", "09:00"],
    bed: ["22:00", "01:00"],
    sleepMinutes: 480,
    obligation: null,
    footprint: 0,
    load: 0,
    capacityAt: () => 10_000,
    ...overrides,
  });
}
const clock = (instant: Date) => `${dayKey(instant)} ${formatTime(instant)}`;
const view = (plan: ReturnType<typeof sleep>) => ({
  latest: clock(plan.latestWake),
  wake: clock(plan.wake),
  bed: clock(plan.bed),
  expected: clock(plan.expectedWake),
  sleep: plan.sleepMinutes,
  short: plan.short,
});
/** The 13th's capacity when work starts at `start`: minutes to 19:00. */
const untilSeven = (start: Date) => (at("19:00", NEXT).getTime() - start.getTime()) / 60_000;

describe("the sleep plan", () => {
  it("wakes as late as the first obligation allows: block minus its travel minus the morning's work", () => {
    // The document's example: class at 10:30, 45 minutes away, a 45-minute routine.
    expect(view(sleep({ obligation: at("09:45", NEXT), footprint: 45 }))).toEqual({
      latest: "2026-11-13 09:00",
      wake: "2026-11-13 09:00",
      bed: "2026-11-13 01:00",
      expected: "2026-11-13 09:00",
      sleep: 480,
      short: null,
    });
  });

  it("without an obligation, or with a late one, wakes at the end of the range", () => {
    expect(clock(sleep().wake)).toBe("2026-11-13 09:00");
    expect(clock(sleep({ obligation: at("14:00", NEXT), footprint: 30 }).wake)).toBe(
      "2026-11-13 09:00",
    );
  });

  it("pulls the waking earlier by 15 minutes until the day's load fits; bed moves with it", () => {
    const heavy = sleep({ load: 690, capacityAt: untilSeven });
    expect([clock(heavy.wake), clock(heavy.bed), heavy.sleepMinutes]).toEqual([
      "2026-11-13 07:30",
      "2026-11-12 23:30",
      480,
    ]);
    // The capacity is counted from the end of the morning's work.
    const routine = sleep({ load: 660, footprint: 30, capacityAt: untilSeven });
    expect(clock(routine.wake)).toBe("2026-11-13 07:30");
  });

  it("does not pull a light day", () => {
    expect(clock(sleep({ load: 300, capacityAt: untilSeven }).wake)).toBe("2026-11-13 09:00");
  });

  it("never gives up sleep for the load: the pull stops where bed would leave its range", () => {
    const late = sleep({ bed: ["23:00", "01:00"], load: 10_000, capacityAt: untilSeven });
    expect(view(late)).toMatchObject({
      wake: "2026-11-13 07:00",
      bed: "2026-11-12 23:00",
      sleep: 480,
      short: null,
    });
    // And never before the waking range.
    expect(clock(sleep({ load: 10_000, capacityAt: untilSeven }).wake)).toBe("2026-11-13 06:00");
  });

  it("a fixed obligation may cut sleep short, and the plan says so", () => {
    const early = sleep({ obligation: at("05:30", NEXT) });
    expect(view(early)).toMatchObject({
      latest: "2026-11-13 05:30",
      wake: "2026-11-13 05:30",
      bed: "2026-11-12 22:00",
      sleep: 450,
      short: "obligation",
    });
  });

  it("a real bedtime moves the morning: later bed, later waking; earlier bed, earlier waking", () => {
    expect(view(sleep({ bedAt: at("00:30", NEXT) }))).toMatchObject({
      expected: "2026-11-13 08:30",
      sleep: 480,
      short: null,
    });
    expect(clock(sleep({ bedAt: at("22:00") }).expectedWake)).toBe("2026-11-13 06:00");
    // Never before the range, never after the latest waking.
    expect(view(sleep({ bedAt: at("21:00") }))).toMatchObject({
      expected: "2026-11-13 06:00",
      sleep: 540,
    });
    expect(view(sleep({ bedAt: at("02:00", NEXT) }))).toMatchObject({
      expected: "2026-11-13 09:00",
      sleep: 420,
      short: "late_bed",
    });
  });

  it("the user's own waking comes first; bed is counted back from it", () => {
    expect(
      view(sleep({ expectedWake: at("07:00", NEXT), load: 10_000, capacityAt: untilSeven })),
    ).toMatchObject({
      wake: "2026-11-13 07:00",
      bed: "2026-11-12 23:00",
      expected: "2026-11-13 07:00",
      short: null,
    });
    expect(
      view(sleep({ expectedWake: at("07:00", NEXT), bedAt: at("01:00", NEXT) })),
    ).toMatchObject({ expected: "2026-11-13 07:00", sleep: 360, short: "early_wake" });
  });
});

// --- The day ----------------------------------------------------------------------------------

function rows(overrides: Partial<PlanRows> & { settings?: Settings | null } = {}): PlanRows {
  return {
    settings: settingsRow(),
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
    days: [],
    weekPlans: [],
    lifeModes: [],
    stats: [],
    ...overrides,
  };
}

const today = (overrides: Partial<DayRow> = {}) => dayRow({ date: DATE, ...overrides });
const inputAt = (time: string, data: PlanRows, day = DATE) =>
  planInput(data, { date: DATE, now: at(time, day), context: "desk" });
const planAt = (time: string, data: PlanRows, day = DATE) => buildPlan(inputAt(time, data, day));

/** Where a piece of work landed: "07:10–07:25 wake", or null. */
function placement(plan: Plan, id: string): string | null {
  const slot = plan.slots.find((row) => row.assignment?.candidate.id === id);
  return slot ? `${formatTime(slot.start)}–${formatTime(slot.end)} ${slot.part ?? "work"}` : null;
}

const anchored = (
  anchor: "wake" | "bed",
  overrides: Partial<Task> = {},
  extra: Partial<Timing> = {},
) => task({ timing: { anchor, ...extra }, energy: "light", est_minutes: 15, ...overrides });

describe("the day's start", () => {
  it("is the recorded waking plus the morning's anchored work", () => {
    const routine = anchored("wake", { est_minutes: 30 });
    const data = rows({ days: [today({ woke_at: iso("07:10") })], tasks: [routine] });
    const plan = planAt("07:15", data);
    expect(plan.frame?.wake).toEqual(at("07:10"));
    expect(plan.frame?.workStart).toEqual(at("07:40"));
    expect(placement(plan, routine.id)).toBe("07:10–07:40 wake");
    // "Uyandım" said: the first routine is offered at once.
    expect(plan.now).toMatchObject({
      kind: "suggest",
      assignment: { candidate: { id: routine.id } },
    });
  });

  it("without a record: the user's value for the day, else the sleep plan", () => {
    const own = inputAt("06:00", rows({ days: [today({ expected_wake: "07:30:00" })] }));
    expect(own.frame).toMatchObject({ wake: at("07:30"), woke: false });
    expect(own.dayStart).toEqual(at("07:30"));
    // No blocks, a light day: the end of the waking range.
    expect(inputAt("06:00", rows()).frame?.wake).toEqual(at("09:00"));
    // A class at 08:30 half an hour away: up by 08:00.
    const classDay = rows({
      blocks: [block({ starts_at: iso("08:30"), ends_at: iso("10:00"), travel_before_min: 30 })],
    });
    expect(inputAt("06:00", classDay).frame?.wake).toEqual(at("08:00"));
  });

  it("a late waking shortens the day", () => {
    const work = [task({ est_minutes: 60 }), task({ est_minutes: 60 })];
    const early = planAt("07:05", rows({ days: [today({ woke_at: iso("07:00") })], tasks: work }));
    const late = planAt("11:05", rows({ days: [today({ woke_at: iso("11:00") })], tasks: work }));
    expect(late.usableMinutes).toBeLessThan(early.usableMinutes);
  });

  it("inside the window the plan is Ç3b's plan with the same window (no record, no anchor, no after_finish)", () => {
    const work = [
      task({ est_minutes: 30 }),
      task({ est_minutes: 60, importance: 3 }),
      task({ est_minutes: 45, energy: "deep", due_at: iso("18:00", "2026-11-14") }),
      task({ est_minutes: 20, timing: { windows: [{ from: "14:00", to: "16:00" }] } }),
    ];
    const input = inputAt("10:30", rows({ tasks: work }));
    expect(input.frame).toBeDefined();
    const framed = buildPlan(input);
    const plain = buildPlan({ ...input, frame: undefined });
    const shape = (plan: Plan) => ({
      // Inside the window: the evening's free slots are the frame's own.
      slots: plan.slots
        .filter((slot) => !slot.part)
        .map((slot) => [slot.start, slot.end, slot.kind, slot.assignment?.candidate.id]),
      top3: plan.top3,
      overflow: plan.overflow.map((row) => row.id),
      warnings: plan.warnings,
      usable: plan.usableMinutes,
      planned: plan.plannedMinutes,
    });
    expect(shape(framed)).toEqual(shape(plain));
  });

  it("with the frame off the input is Ç3b's: first touch or the default start, no frame", () => {
    const off = inputAt("09:00", rows({ settings: settingsRow({ day_frame: null }) }));
    expect(off.frame).toBeUndefined();
    expect(off.dayStart).toEqual(at("08:00"));
  });
});

describe("anchored work", () => {
  it("wake-bound work follows the waking in its order, then by score; it is not spread, not in the three", () => {
    const second = anchored("wake", { est_minutes: 30, importance: 4 }, { order: 2 });
    const first = anchored("wake", { est_minutes: 15 }, { order: 1 });
    const loose = anchored("wake", { est_minutes: 10, importance: 4 });
    const work = task({ est_minutes: 30 });
    const data = rows({
      days: [today({ woke_at: iso("07:10") })],
      tasks: [second, loose, first, work],
    });
    const plan = planAt("07:12", data);
    expect(placement(plan, first.id)).toBe("07:10–07:25 wake");
    expect(placement(plan, second.id)).toBe("07:25–07:55 wake");
    expect(placement(plan, loose.id)).toBe("07:55–08:05 wake");
    expect(plan.frame?.workStart).toEqual(at("08:05"));
    expect(placement(plan, work.id)).toBe("08:05–08:35 work");
    expect(plan.top3).toEqual([work.id]);
    expect(plan.plannedMinutes).toBe(30);
  });

  it("work on one anchor without an order goes by score", () => {
    const low = anchored("wake", { est_minutes: 10, importance: 1 });
    const high = anchored("wake", { est_minutes: 10, importance: 4 });
    const plan = planAt(
      "07:01",
      rows({ days: [today({ woke_at: iso("07:00") })], tasks: [low, high] }),
    );
    expect(placement(plan, high.id)).toBe("07:00–07:10 wake");
    expect(placement(plan, low.id)).toBe("07:10–07:20 wake");
  });

  it("the user's bedtime for tonight moves tomorrow's expected waking", () => {
    const late = inputAt(
      "21:00",
      rows({ days: [today({ woke_at: iso("07:00"), expected_bed: "00:30:00" })] }),
    );
    expect(late.frame?.bed).toEqual(at("00:30", NEXT));
    expect(late.frame?.tonight.expectedWake).toEqual(at("08:30", NEXT));
    const early = inputAt(
      "21:00",
      rows({ days: [today({ woke_at: iso("07:00"), expected_bed: "22:30:00" })] }),
    );
    expect(early.frame?.tonight.expectedWake).toEqual(at("06:30", NEXT));
  });

  it("a rhythm can be anchored too", () => {
    const routine = rhythm({
      period: "day",
      target_count: 1,
      est_minutes: 20,
      timing: { anchor: "wake" },
    });
    const plan = planAt(
      "07:01",
      rows({ days: [today({ woke_at: iso("07:00") })], rhythms: [routine] }),
    );
    expect(placement(plan, routine.id)).toBe("07:00–07:20 wake");
  });

  it("bed-bound work ends at the expected bedtime; the evening ends before it", () => {
    const winddown = anchored("bed", { est_minutes: 20 });
    const plan = planAt(
      "20:00",
      rows({ tasks: [winddown], days: [today({ woke_at: iso("07:00") })] }),
    );
    // Tomorrow is light: waking 09:00, so bed at 01:00.
    expect(plan.frame?.bed).toEqual(at("01:00", NEXT));
    expect(placement(plan, winddown.id)).toBe("00:40–01:00 bed");
    expect(plan.frame?.eveningEnd).toEqual(at("00:40", NEXT));
    const own = planAt(
      "20:00",
      rows({
        tasks: [winddown],
        days: [today({ woke_at: iso("07:00"), expected_bed: "23:30:00" })],
      }),
    );
    expect(placement(own, winddown.id)).toBe("23:10–23:30 bed");
  });

  it("a morning said late ('30 dk önce') still offers its routine; an hour after the line it goes (Ç3c audit)", () => {
    const routine = anchored("wake", { est_minutes: 15 });
    const late = rows({ days: [today({ woke_at: iso("07:10") })], tasks: [routine] });
    // Said at 07:40 with "30 dk önce": the routine's place (07:10–07:25) is already behind.
    expect(planAt("07:40", late).now).toMatchObject({
      kind: "suggest",
      assignment: { candidate: { id: routine.id } },
    });
    expect(placement(planAt("08:24", late), routine.id)).toBe("07:10–07:25 wake");
    expect(placement(planAt("08:26", late), routine.id)).toBeNull();
  });

  it("a wake-bound routine that was missed is not offered all day", () => {
    const routine = anchored("wake", { est_minutes: 30 });
    const plan = planAt(
      "10:00",
      rows({ days: [today({ woke_at: iso("07:00") })], tasks: [routine] }),
    );
    expect(placement(plan, routine.id)).toBeNull();
    expect(plan.now).not.toMatchObject({ assignment: { candidate: { id: routine.id } } });
  });
});

describe("the evening", () => {
  const woke = [today({ woke_at: iso("07:00") })];

  it("takes after_finish work whose hours are in the evening; nothing else goes past the finish line", () => {
    const gym = task({
      est_minutes: 60,
      energy: "physical",
      timing: { windows: [{ from: "20:00", to: "22:00" }], after_finish: true },
    });
    const plain = task({
      est_minutes: 60,
      energy: "physical",
      timing: { windows: [{ from: "20:00", to: "22:00" }] },
    });
    const plan = planAt("10:00", rows({ days: woke, tasks: [gym, plain] }));
    // The evening is cut into slots like the day (19:00–20:30, a break, 20:45–…): the hour
    // inside 20:00–22:00 that fits one is 20:45–21:45.
    expect(placement(plan, gym.id)).toBe("20:45–21:45 evening");
    expect(placement(plan, plain.id)).toBeNull();
    expect(plan.warnings.map((warning) => warning.subjectId)).toEqual([plain.id]);
    // The evening is not capacity: the day's usable minutes are what they were.
    const without = planAt("10:00", rows({ days: woke, tasks: [plain] }));
    expect(plan.usableMinutes).toBe(without.usableMinutes);
  });

  it("an evening-only weekly floor that may go after the finish line is not 'no time this week' (Ç3c audit)", () => {
    const evening = (afterFinish: boolean) =>
      rhythm({
        period: "week",
        target_count: 2,
        floor_count: 1,
        est_minutes: 60,
        energy: "physical",
        timing: {
          windows: [{ from: "20:00", to: "22:00" }],
          ...(afterFinish ? { after_finish: true as const } : {}),
        },
      });
    const kinds = (afterFinish: boolean) =>
      planAt("10:00", rows({ days: woke, rhythms: [evening(afterFinish)] })).warnings.map(
        (warning) => warning.kind,
      );
    expect(kinds(true)).not.toContain("no_time_week");
    expect(kinds(false)).toContain("no_time_week");
  });

  it("after_finish work with room in the day is done in the day", () => {
    const loose = task({ est_minutes: 30, timing: { after_finish: true } });
    const plan = planAt("10:00", rows({ days: woke, tasks: [loose] }));
    expect(placement(plan, loose.id)).toMatch(/work$/);
  });

  it("goes to the evening when the day is full", () => {
    // 10:00–19:00 is 540 slot minutes, 378 usable: twelve half hours fit, the rest does not.
    const fill = Array.from({ length: 13 }, () => task({ est_minutes: 30 }));
    const extra = task({ est_minutes: 30, timing: { after_finish: true }, importance: 1 });
    const plan = planAt("10:00", rows({ days: woke, tasks: [...fill, extra] }));
    expect(placement(plan, extra.id)).toBe("19:00–19:30 evening");
    const latest = Math.max(
      ...plan.slots
        .filter((slot) => slot.assignment && slot.assignment.candidate.id !== extra.id)
        .map((slot) => slot.end.getTime()),
    );
    expect(latest).toBeLessThanOrEqual(at("19:00").getTime());
  });
});

describe("the states of the day", () => {
  it("morning: the day has begun and nobody said 'Uyandım'; it ends an hour after the waking range", () => {
    expect(planAt("06:30", rows()).now.kind).toBe("morning");
    expect(planAt("09:59", rows()).now.kind).toBe("morning");
    expect(planAt("10:01", rows({ tasks: [task()] })).now.kind).toBe("suggest");
    expect(
      planAt("06:30", rows({ days: [today({ woke_at: iso("06:20") })], tasks: [task()] })).now.kind,
    ).toBe("suggest");
  });

  it("the morning shows the first wake-bound work it will offer", () => {
    const routine = anchored("wake", { est_minutes: 30 });
    const plan = planAt("07:00", rows({ tasks: [routine] }));
    expect(plan.now).toMatchObject({ kind: "morning", first: { candidate: { id: routine.id } } });
  });

  it("evening: past the finish line, or closed, until bed; the evening's next work rides along", () => {
    const woke = today({ woke_at: iso("07:00") });
    const gym = task({
      est_minutes: 60,
      energy: "physical",
      timing: { after_finish: true, windows: [{ from: "20:00", to: "22:00" }] },
    });
    const evening = planAt("19:30", rows({ days: [woke], tasks: [gym] }));
    expect(evening.now).toMatchObject({
      kind: "evening",
      next: { candidate: { id: gym.id } },
      closed: false,
    });
    const closed = planAt("17:00", rows({ days: [{ ...woke, closed_at: iso("16:55") }] }));
    expect(closed.now).toMatchObject({ kind: "evening", closed: true });
  });

  it("night: bed recorded, or the bedtime range is over", () => {
    const woke = today({ woke_at: iso("07:00") });
    expect(planAt("23:05", rows({ days: [{ ...woke, bed_at: iso("23:00") }] })).now.kind).toBe(
      "night",
    );
    expect(planAt("00:59", rows({ days: [woke] }), NEXT).now.kind).toBe("evening");
    expect(planAt("01:01", rows({ days: [woke] }), NEXT).now.kind).toBe("night");
  });

  it("the night ends at 05:00 or at the start of the waking range, whichever is earlier", () => {
    expect(planningDay(at("04:30", NEXT), "06:00")).toBe(DATE);
    expect(planningDay(at("05:30", NEXT), "06:00")).toBe(NEXT);
    expect(planningDay(at("04:30", NEXT), "04:00")).toBe(NEXT);
  });
});

describe("the week's capacity with the frame", () => {
  it("counts tomorrow from its expected waking: a later bedtime shortens tomorrow and re-commits the week", () => {
    const week = "2026-11-09";
    const data = (bedAt: string) =>
      rows({ days: [today({ woke_at: iso("07:00"), bed_at: bedAt })] });
    const loadInput = (source: PlanRows, now: Date) => ({
      now,
      weekStart: week,
      items: source.workItems,
      tasks: source.tasks,
      rhythms: source.rhythms,
      modules: source.modules,
      blocks: source.blocks,
      settings: weekSettings(source, now),
      stats: [],
      lifeMode: "normal" as const,
    });
    // In bed at 22:30: up at 06:30 tomorrow. In bed at 00:30: up at 08:30, two hours less.
    const early = dayCapacities(loadInput(data(iso("22:30")), at("22:35")), week);
    const late = dayCapacities(loadInput(data(iso("00:30", NEXT)), at("00:35", NEXT)), week);
    expect(late[NEXT]).toBeLessThan(early[NEXT] - 30);
    expect(
      recommitReason(
        { committed: [], capacityMinutes: null, capacityByDay: early, lifeMode: "normal" },
        loadInput(data(iso("00:30", NEXT)), at("00:35", NEXT)),
      ),
    ).toBe("capacity_lost");
    // The load's pull is not capacity: a heavy tomorrow that pulls the waking earlier and then
    // lightens (work finished today) loses nothing.
    const heavy = rows({
      tasks: Array.from({ length: 6 }, () => task({ est_minutes: 90, due_at: iso("18:00", NEXT) })),
      days: [today({ woke_at: iso("07:00") })],
    });
    const pulled = inputAt("20:00", heavy).frame!.tonight;
    expect(pulled.wake < pulled.latestWake).toBe(true);
    const heavyDays = dayCapacities(loadInput(heavy, at("20:00")), week);
    const light = rows({ ...heavy, tasks: [] });
    const lightDays = dayCapacities(loadInput(light, at("20:00")), week);
    expect(heavyDays[NEXT]).toBe(lightDays[NEXT]);
    // The days after tomorrow start at their latest waking (09:00 here), whatever the bed.
    expect(late["2026-11-14"]).toBe(early["2026-11-14"]);
  });
});
