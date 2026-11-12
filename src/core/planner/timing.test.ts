import { describe, expect, it } from "vitest";
import type { Timing } from "@/core/contract/timing";
import { block, moduleRow, rhythm, rhythmLog, task, workItem } from "@/core/testing/factories";
import type { Task } from "@/core/types";
import { formatTime, istanbulInstant } from "@/lib/date";
import { buildCandidates, rhythmState } from "./candidates";
import { buildPlan, pickForMinutes } from "./plan";
import { DEFAULT_SETTINGS } from "./slots";
import { TIME_FACTOR, timeState } from "./timing";
import type { Plan, PlanInput } from "./types";

// Time constraints in the planner (docs/04-planlayici.md, "Zaman kısıtları (Ç3b)" and the test
// list's Ç3b part). The day without blocks, 08:00–19:00, is cut into these slots:
//   deep 08:00–09:30, break –09:45, deep –11:15, break –11:30, deep –13:00, break –13:15,
//   deep –14:45, break –15:00, deep –16:30, break –16:45, deep –18:15, break –18:30, light –19:00

const DATE = "2026-11-12"; // a Thursday
const at = (time: string, day = DATE) => istanbulInstant(day, time);
const iso = (time: string, day = DATE) => at(time, day).toISOString();

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    now: at("08:00"),
    date: DATE,
    dayType: "home",
    lifeMode: "normal",
    dayStart: at("08:00"),
    finishLine: at("19:00"),
    blocks: [],
    tasks: [],
    workItems: [],
    rhythms: [],
    rhythmLogs: [],
    modules: [moduleRow()],
    context: "desk",
    settings: DEFAULT_SETTINGS,
    stats: [],
    ...overrides,
  };
}

const timed = (timing: Timing, overrides: Partial<Task> = {}) =>
  task({ timing, energy: "light", ...overrides });

/** Where a piece of work landed: "16:45–17:45", or null. */
function placement(plan: Plan, id: string): string | null {
  const slot = plan.slots.find((row) => row.assignment?.candidate.id === id);
  return slot ? `${formatTime(slot.start)}–${formatTime(slot.end)}` : null;
}
const assignmentOf = (plan: Plan, id: string) =>
  plan.slots.find((row) => row.assignment?.candidate.id === id)?.assignment ?? null;
const shape = (plan: Plan) =>
  plan.slots.map(
    (slot) =>
      `${slot.kind} ${formatTime(slot.start)}–${formatTime(slot.end)}${slot.assignment ? " *" : ""}`,
  );

describe("no timing, no change", () => {
  it("null timing and a value that does not pass the schema plan like before", () => {
    const tasks = [task({ est_minutes: 30 }), task({ est_minutes: 60, importance: 3 })];
    const before = buildPlan(input({ tasks }));
    const nulls = buildPlan(input({ tasks: tasks.map((row) => ({ ...row, timing: null })) }));
    const broken = buildPlan(
      input({ tasks: tasks.map((row) => ({ ...row, timing: { windows: [] } })) }),
    );
    const view = (plan: Plan) => ({
      slots: shape(plan),
      placed: plan.slots.map((slot) => slot.assignment?.candidate.id ?? null),
      assignments: plan.slots.map((slot) =>
        slot.assignment ? { ...slot.assignment, candidate: slot.assignment.candidate.id } : null,
      ),
      top3: plan.top3,
      overflow: plan.overflow.map((row) => row.id),
      warnings: plan.warnings,
      now: plan.now.kind,
      usable: plan.usableMinutes,
      planned: plan.plannedMinutes,
      candidates: plan.candidates.map((row) => ({ ...row, task: row.task?.id })),
    });
    expect(view(nulls)).toEqual(view(before));
    expect(view(broken)).toEqual(view(before));
  });
});

describe("the time filter (hard)", () => {
  it("never places work outside its window; it waits for the window", () => {
    const gym = timed({ windows: [{ from: "16:00", to: "18:00" }] }, { est_minutes: 60 });
    const plan = buildPlan(input({ tasks: [gym] }));
    // 15:00–16:30 holds only 30 minutes of the window; 16:45 is the first slot that holds 60.
    expect(placement(plan, gym.id)).toBe("16:45–17:45");
  });

  it("puts the work where the window opens; the pieces before and after stay slots", () => {
    const call = timed({ windows: [{ from: "15:30", to: "17:00" }] }, { est_minutes: 45 });
    const plan = buildPlan(input({ tasks: [call] }));
    expect(placement(plan, call.id)).toBe("15:30–16:15");
    expect(shape(plan)).toContain("light 15:00–15:30");
    expect(shape(plan)).toContain("light 16:15–16:30");
  });

  it("is not placed when no slot holds enough of the window", () => {
    // 16:00–17:15 is 75 minutes, but the slots hold 30 (15:00–16:30) and 30 (16:45–18:15) of it.
    const call = timed({ windows: [{ from: "16:00", to: "17:15" }] }, { est_minutes: 45 });
    const plan = buildPlan(input({ tasks: [call] }));
    expect(placement(plan, call.id)).toBeNull();
    expect(plan.overflow.map((row) => row.id)).toContain(call.id);
  });

  it("is no candidate on a day its windows do not cover", () => {
    const monday = timed({ windows: [{ days: [1], from: "09:00", to: "17:00" }] });
    const weekdays = timed({ windows: [{ days: [1, 2, 3, 4, 5], from: "09:00", to: "17:00" }] });
    const ids = buildCandidates(input({ tasks: [monday, weekdays] })).map((row) => row.id);
    expect(ids).toEqual([weekdays.id]);
  });

  it("is no candidate when what is left of today's window is too short", () => {
    const call = timed({ windows: [{ from: "09:00", to: "12:00" }] }, { est_minutes: 45 });
    expect(buildCandidates(input({ now: at("11:30"), tasks: [call] }))).toEqual([]);
    expect(buildCandidates(input({ now: at("11:00"), tasks: [call] }))).toHaveLength(1);
  });

  it("the card offers windowed work when its time comes, not before", () => {
    const gym = timed({ windows: [{ from: "16:00", to: "18:00" }] }, { est_minutes: 60 });
    const morning = buildPlan(input({ now: at("10:00"), tasks: [gym] }));
    // From 10:00 the slots are 15:15–16:45 and 17:00–18:30: the work is planned at 17:00.
    expect(morning.now).toMatchObject({ kind: "suggest", at: at("17:00") });
    const later = buildPlan(input({ now: at("16:45"), tasks: [gym] }));
    expect(later.now.kind).toBe("suggest");
    expect(later.now).not.toHaveProperty("at");
  });

  it("free work still comes first on the card while windowed work waits", () => {
    const gym = timed({ windows: [{ from: "16:00", to: "18:00" }] }, { importance: 4 });
    const free = task({ importance: 1 });
    const plan = buildPlan(input({ now: at("10:00"), tasks: [gym, free] }));
    expect(plan.now).toMatchObject({ kind: "suggest" });
    if (plan.now.kind === "suggest") expect(plan.now.assignment.candidate.id).toBe(free.id);
  });
});

describe("preferred and avoided hours (soft)", () => {
  const day = (from: string, to: string) => ({
    start: at(from).getTime(),
    end: at(to).getTime(),
  });

  it("avoided when at least half the work falls in an avoided range; avoid wins over prefer", () => {
    const evening = { avoid: [{ from: "18:30", to: "20:00" }] };
    expect(timeState(evening, day("18:00", "19:00"), DATE)).toBe("avoided");
    expect(
      timeState({ avoid: [{ from: "18:31", to: "20:00" }] }, day("18:00", "19:00"), DATE),
    ).toBe("neutral");
    expect(
      timeState({ prefer: [{ from: "17:30", to: "18:30" }] }, day("18:00", "19:00"), DATE),
    ).toBe("preferred");
    expect(
      timeState(
        { prefer: [{ from: "08:00", to: "20:00" }], avoid: [{ from: "18:30", to: "20:00" }] },
        day("18:00", "19:00"),
        DATE,
      ),
    ).toBe("avoided");
    // A range of other days does not count.
    expect(
      timeState(
        { avoid: [{ days: [1], from: "18:00", to: "20:00" }] },
        day("18:00", "19:00"),
        DATE,
      ),
    ).toBe("neutral");
    expect(TIME_FACTOR).toEqual({ preferred: 1.25, neutral: 1, avoided: 0.5 });
  });

  it("the factor changes the score in the slot: avoided work loses the slot to weaker work", () => {
    // Same age, so the scores differ by importance: 1.5 against 1. In the avoided morning the
    // first one counts 0.75.
    const avoids = timed({ avoid: [{ from: "08:00", to: "13:00" }] }, { importance: 3 });
    const plain = task({ importance: 2 });
    const plan = buildPlan(input({ tasks: [avoids, plain] }));
    expect(placement(plan, plain.id)).toBe("08:00–08:30");
    expect(placement(plan, avoids.id)).toBe("13:15–13:45");
  });

  it("filling: work waits for a better slot later today", () => {
    const prefers = timed({ prefer: [{ from: "15:00", to: "16:30" }] }, { importance: 4 });
    const plain = task({ importance: 1 });
    const plan = buildPlan(input({ tasks: [prefers, plain] }));
    expect(placement(plan, plain.id)).toBe("08:00–08:30");
    expect(placement(plan, prefers.id)).toBe("15:00–15:30");
  });

  it("filling: with no better slot left, avoided work still goes in", () => {
    const allDay = timed({ avoid: [{ from: "08:00", to: "19:00" }] });
    expect(placement(buildPlan(input({ tasks: [allDay] })), allDay.id)).toBe("08:00–08:30");
  });

  it("mandatory work takes the earliest of its best slots; an avoided one only when it must", () => {
    const due = { due_at: iso("18:00") };
    const morningAvoided = timed({ avoid: [{ from: "08:00", to: "13:00" }] }, due);
    expect(placement(buildPlan(input({ tasks: [morningAvoided] })), morningAvoided.id)).toBe(
      "13:15–13:45",
    );
    const allAvoided = timed({ avoid: [{ from: "08:00", to: "19:00" }] }, due);
    expect(placement(buildPlan(input({ tasks: [allAvoided] })), allAvoided.id)).toBe("08:00–08:30");
  });
});

describe("the footprint: travel, work, travel", () => {
  const trip = (
    minutes: number,
    travel = { before: 20, after: 20 },
    overrides: Partial<Task> = {},
  ) =>
    timed({ travel }, { est_minutes: minutes, context: "out", energy: "physical", ...overrides });

  it("takes travel + work + travel; the work is the slot, the travel is carried beside it", () => {
    const gym = trip(60);
    const plan = buildPlan(input({ tasks: [gym] }));
    // 08:00–09:40: 20 travel, 60 work, 20 travel, over the break into nothing usable.
    expect(placement(plan, gym.id)).toBe("08:20–09:20");
    expect(assignmentOf(plan, gym.id)).toMatchObject({
      minutes: 60,
      travelBefore: 20,
      travelAfter: 20,
    });
    // The travel's time is given to nothing else; 09:40–09:45 is too short to be a slot.
    expect(shape(plan)[0]).toBe("deep 08:20–09:20 *");
    expect(shape(plan)[1]).toBe("deep 09:45–11:15");
  });

  it("runs over a break into the next slot of the same free range", () => {
    const long = trip(90);
    const plan = buildPlan(input({ tasks: [long] }));
    // 08:00 + 20 → work 08:20–09:50 → travel to 10:10; the second deep slot keeps 10:10–11:15.
    expect(placement(plan, long.id)).toBe("08:20–09:50");
    expect(shape(plan)[1]).toBe("deep 10:10–11:15");
  });

  it("never runs into a block, a block's travel or past the finish line", () => {
    const gym = trip(60);
    const withBlock = buildPlan(
      input({ tasks: [gym], blocks: [block({ starts_at: iso("09:30"), ends_at: iso("10:30") })] }),
    );
    expect(placement(withBlock, gym.id)).toBe("10:50–11:50");
    const withTravel = buildPlan(
      input({
        tasks: [gym],
        blocks: [block({ starts_at: iso("10:00"), ends_at: iso("11:00"), travel_before_min: 30 })],
      }),
    );
    // Busy 09:30–11:00: 08:00–09:30 holds 90 of the 100 minutes.
    expect(placement(withTravel, gym.id)).toBe("11:20–12:20");
    expect(
      placement(buildPlan(input({ tasks: [gym], finishLine: at("09:30") })), gym.id),
    ).toBeNull();
  });

  it("never starts in a break", () => {
    const first = task({ est_minutes: 90, due_at: iso("18:00") });
    const short = trip(30, { before: 10, after: 10 });
    const plan = buildPlan(input({ tasks: [first, short] }));
    expect(placement(plan, first.id)).toBe("08:00–09:30");
    // 09:30 would hold 50 minutes over the break and the next slot, but a footprint never starts
    // in a break.
    expect(placement(plan, short.id)).toBe("09:55–10:25");
  });

  it("the energy filter looks at the slot the footprint starts in", () => {
    // 08:00–08:40 is a light slot: deep work does not start there, physical work does.
    const deep = trip(20, { before: 5, after: 5 }, { energy: "deep" });
    const physical = trip(20, { before: 5, after: 5 });
    const day = { finishLine: at("08:40") };
    expect(placement(buildPlan(input({ ...day, tasks: [deep] })), deep.id)).toBeNull();
    expect(placement(buildPlan(input({ ...day, tasks: [physical] })), physical.id)).toBe(
      "08:05–08:25",
    );
  });

  it("travel does not count against the capacity", () => {
    const gym = trip(60);
    const plan = buildPlan(input({ tasks: [gym] }));
    expect(plan.plannedMinutes).toBe(60);
  });

  it("the 90-minute limit is on the work, not the travel", () => {
    const tooLong = trip(95, { before: 5, after: 5 });
    expect(placement(buildPlan(input({ tasks: [tooLong] })), tooLong.id)).toBeNull();
  });
});

describe("context and travel", () => {
  it("work with travel passes the context filter in every context", () => {
    const gym = timed(
      { travel: { before: 20, after: 20 } },
      { context: "out", energy: "physical" },
    );
    const noTravel = task({ context: "out" });
    const plan = buildPlan(input({ tasks: [gym, noTravel] }));
    expect(placement(plan, gym.id)).not.toBeNull();
    expect(placement(plan, noTravel.id)).toBeNull();
    expect(pickForMinutes(input({ tasks: [gym, noTravel] }), 90)?.id).toBe(gym.id);
  });

  it("on the spot there is no travel: the device is in the work's context", () => {
    const gym = timed(
      { travel: { before: 20, after: 20 } },
      { context: "out", energy: "physical", est_minutes: 60 },
    );
    const plan = buildPlan(input({ tasks: [gym], context: "out" }));
    expect(placement(plan, gym.id)).toBe("08:00–09:00");
    expect(assignmentOf(plan, gym.id)?.travelBefore ?? 0).toBe(0);
    expect(assignmentOf(plan, gym.id)?.travelAfter ?? 0).toBe(0);
  });
});

describe("rest days", () => {
  const workout = (overrides = {}) =>
    rhythm({ target_count: 3, period: "week", timing: { rest_days: 1 }, ...overrides });

  it("not a candidate on the rest days after it was done; a candidate again after them", () => {
    const gym = workout();
    const yesterday = buildCandidates(
      input({ rhythms: [gym], rhythmLogs: [rhythmLog(gym.id, "2026-11-11")] }),
    );
    expect(yesterday).toEqual([]);
    const twoDaysAgo = buildCandidates(
      input({ rhythms: [gym], rhythmLogs: [rhythmLog(gym.id, "2026-11-10")] }),
    );
    expect(twoDaysAgo.map((row) => row.id)).toEqual([gym.id]);
    // A doing in the week before counts too: done Sunday, two rest days, so not on Tuesday.
    const sunday = workout({ timing: { rest_days: 2 } });
    expect(
      buildCandidates(
        input({
          date: "2026-11-10",
          now: at("08:00", "2026-11-10"),
          dayStart: at("08:00", "2026-11-10"),
          finishLine: at("19:00", "2026-11-10"),
          rhythms: [sunday],
          rhythmLogs: [rhythmLog(sunday.id, "2026-11-08")],
        }),
      ),
    ).toEqual([]);
  });

  it("the floor is in danger by the doings still reachable, not by the days left", () => {
    // Thursday: four days left in the week. Two needed, so no danger without constraints.
    const plain = rhythm({ target_count: 3, floor_count: 2 });
    expect(rhythmState(plain, [], DATE, "normal").floorInDanger).toBe(false);
    // Only on weekends: Saturday and Sunday reach two, which is all that is needed.
    const weekend = rhythm({
      target_count: 3,
      floor_count: 2,
      timing: { windows: [{ days: [6, 7], from: "09:00", to: "18:00" }] },
    });
    expect(rhythmState(weekend, [], DATE, "normal").floorInDanger).toBe(true);
    // Three needed with a day between: Thursday and Saturday reach only two.
    const rest = rhythm({ target_count: 3, floor_count: 3, timing: { rest_days: 1 } });
    expect(rhythmState(rest, [], DATE, "normal").floorInDanger).toBe(true);
    const restTwo = rhythm({ target_count: 3, floor_count: 2, timing: { rest_days: 1 } });
    expect(rhythmState(restTwo, [], DATE, "normal").floorInDanger).toBe(true);
    // Done Monday: needed one more, Wednesday on is free: Thursday to Sunday reach two. No danger.
    const doneMonday = rhythm({ target_count: 2, floor_count: 2, timing: { rest_days: 1 } });
    expect(
      rhythmState(doneMonday, [rhythmLog(doneMonday.id, "2026-11-09")], DATE, "normal")
        .floorInDanger,
    ).toBe(false);
  });
});

describe("urgency inside the window", () => {
  it("counts only the time the window leaves; the mandatory threshold follows it", () => {
    const due = { est_minutes: 90, due_at: iso("12:00", "2026-11-13"), energy: "deep" as const };
    const free = task(due);
    const windowed = timed({ windows: [{ from: "16:45", to: "18:15" }] }, due);
    const [plain] = buildCandidates(input({ tasks: [free] }));
    expect(plain.mandatory).toBeNull();
    // Today 90 minutes of slot inside the window × 0.7; tomorrow nothing before noon.
    const [tight] = buildCandidates(input({ tasks: [windowed] }));
    expect(tight.mandatory).toBe("urgent");
    // Preferred and avoided hours do not narrow it.
    const soft = timed({ avoid: [{ from: "08:00", to: "19:00" }] }, due);
    expect(buildCandidates(input({ tasks: [soft] }))[0].mandatory).toBeNull();
  });
});

describe("conflicts", () => {
  it("work due today whose window is gone is not placed outside it, and says so", () => {
    const bank = timed(
      { windows: [{ from: "09:00", to: "12:00" }] },
      { title: "Banka", due_at: iso("19:00") },
    );
    const plan = buildPlan(input({ now: at("14:00"), tasks: [bank] }));
    expect(placement(plan, bank.id)).toBeNull();
    expect(plan.warnings).toEqual([
      expect.objectContaining({ kind: "no_time_today", text: "Bugün uygun saat kalmadı: Banka." }),
    ]);
  });

  it("mandatory work whose window is open but holds no slot for it says so too", () => {
    const call = timed(
      { windows: [{ from: "16:00", to: "17:15" }] },
      { title: "Çağrı", est_minutes: 45, due_at: iso("19:00") },
    );
    const plan = buildPlan(input({ tasks: [call] }));
    expect(placement(plan, call.id)).toBeNull();
    expect(plan.warnings.map((row) => row.kind)).toEqual(["no_time_today"]);
  });

  it("mandatory windowed work goes in where its energy does not match, inside its window", () => {
    // Only the light slot 18:30–19:00 lies in the window; the work is deep.
    const deep = timed(
      { windows: [{ from: "18:30", to: "19:00" }] },
      { energy: "deep", est_minutes: 30, due_at: iso("19:00") },
    );
    expect(placement(buildPlan(input({ tasks: [deep] })), deep.id)).toBe("18:30–19:00");
    const later = timed(
      { windows: [{ from: "18:30", to: "19:00" }] },
      { energy: "deep", est_minutes: 30 },
    );
    expect(placement(buildPlan(input({ tasks: [later] })), later.id)).toBeNull();
  });

  it("only a window forbids the cut to the longest slot; preferred hours do not", () => {
    // 90 minutes × 1.2 learned = 110: longer than any slot. Due today, it is started anyway.
    const mod = moduleRow();
    const stats = [{ key: `est_multiplier:${mod.slug}:task`, value: 1.2, sample_size: 6 }];
    const due = { est_minutes: 90, due_at: iso("19:00"), energy: "deep" as const };
    const prefers = timed({ prefer: [{ from: "08:00", to: "12:00" }] }, due);
    expect(
      placement(buildPlan(input({ modules: [mod], stats, tasks: [prefers] })), prefers.id),
    ).toBe("08:00–09:30");
    const windowed = timed({ windows: [{ from: "08:00", to: "12:00" }] }, due);
    const plan = buildPlan(input({ modules: [mod], stats, tasks: [windowed] }));
    expect(placement(plan, windowed.id)).toBeNull();
    expect(plan.warnings.map((row) => row.kind)).toContain("no_time_today");
  });

  it("work its windows keep out today still warns of a deadline it cannot meet, first", () => {
    const monday = timed(
      { windows: [{ days: [1], from: "09:00", to: "17:00" }] },
      { title: "Vergi", due_at: iso("19:00", "2026-11-13") },
    );
    const plan = buildPlan(input({ tasks: [monday] }));
    expect(plan.warnings.map((row) => row.kind)).toEqual(["deadline", "no_time_today"]);
  });

  it("the no-time warning comes right after a deadline that will not be met", () => {
    const bank = timed(
      { windows: [{ from: "09:00", to: "12:00" }] },
      { title: "Banka", due_at: iso("19:00") },
    );
    const late = task({ title: "Rapor", est_minutes: 90, due_at: iso("15:00") });
    // A floor in danger that cannot be placed (no campus here) would be the next warning.
    const spare = rhythm({
      title: "Okuma",
      target_count: 7,
      floor_count: 7,
      period: "week",
      context: "campus",
    });
    const plan = buildPlan(input({ now: at("14:00"), tasks: [bank, late], rhythms: [spare] }));
    expect(plan.warnings.map((row) => row.kind)).toEqual(["deadline", "no_time_today"]);
  });

  it("the AI may not plan work outside its window: the advice is dropped and said", () => {
    const monday = timed(
      { windows: [{ days: [1], from: "09:00", to: "17:00" }] },
      { title: "Vergi" },
    );
    const evening = timed(
      { windows: [{ from: "16:00", to: "17:15" }] },
      { title: "Çağrı", est_minutes: 45 },
    );
    const other = task({ title: "Okuma" });
    const plan = buildPlan(
      input({
        tasks: [monday, evening, other],
        advice: { top3: [monday.id], prefer: [evening.id] },
      }),
    );
    expect(plan.top3).not.toContain(monday.id);
    expect(placement(plan, monday.id)).toBeNull();
    expect(plan.warnings.filter((row) => row.kind === "advice_rejected")).toEqual([
      expect.objectContaining({ subjectId: monday.id }),
      expect.objectContaining({ subjectId: evening.id }),
    ]);
  });
});

describe("X dk'm var", () => {
  it("keeps to the window and to the footprint", () => {
    const gym = timed({ windows: [{ from: "16:00", to: "18:00" }] }, { est_minutes: 30 });
    expect(pickForMinutes(input({ now: at("10:00"), tasks: [gym] }), 60)).toBeNull();
    expect(pickForMinutes(input({ now: at("16:00"), tasks: [gym] }), 60)?.id).toBe(gym.id);
    const trip = timed(
      { travel: { before: 10, after: 10 } },
      { est_minutes: 30, context: "out", energy: "physical" },
    );
    expect(pickForMinutes(input({ tasks: [trip] }), 45)).toBeNull();
    expect(pickForMinutes(input({ tasks: [trip] }), 50)?.id).toBe(trip.id);
  });
});

describe("a sitting and its item", () => {
  it("the sitting's own timing comes before its item's; without one, the item's holds", () => {
    const item = workItem({ timing: { windows: [{ from: "16:00", to: "18:00" }] } });
    const own = task({
      work_item_id: item.id,
      position: 1,
      est_minutes: 45,
      timing: { windows: [{ from: "08:00", to: "10:00" }] },
    });
    expect(placement(buildPlan(input({ workItems: [item], tasks: [own] })), own.id)).toBe(
      "08:00–08:45",
    );
    const inherits = { ...own, timing: null };
    expect(placement(buildPlan(input({ workItems: [item], tasks: [inherits] })), own.id)).toBe(
      "16:45–17:30",
    );
  });
});
