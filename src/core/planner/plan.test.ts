import { describe, expect, it } from "vitest";
import {
  block,
  moduleRow,
  prompt,
  rhythm,
  rhythmLog,
  session,
  task,
  testId,
  workItem,
} from "@/core/testing/factories";
import type { ModuleRow } from "@/core/types";
import { istanbulInstant, shiftDay } from "@/lib/date";
import { buildCandidates } from "./candidates";
import { buildPlan, fits, pickForMinutes } from "./plan";
import { buildSlots, DEFAULT_SETTINGS } from "./slots";
import type { Candidate, PlanInput, Slot } from "./types";

// The day planner, rule by rule (docs/04-planlayici.md, "Test kapsamı").

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

const window = (from: string, to: string) => ({ start: at(from), end: at(to) });
const shape = (slots: Slot[]) =>
  slots.map((slot) => [
    slot.kind,
    slot.start.toISOString().slice(11, 16),
    slot.end.toISOString().slice(11, 16),
  ]);
const placedIds = (plan: ReturnType<typeof buildPlan>) =>
  plan.slots.flatMap((slot) => (slot.assignment ? [slot.assignment.candidate.id] : []));

describe("slots", () => {
  it("takes out the blocks with their travel time and drops gaps under 15 minutes", () => {
    const slots = buildSlots(
      window("08:00", "12:00"),
      [
        // 09:00–10:00 with 20 minutes before and 10 after: busy 08:40–10:10.
        block({
          starts_at: iso("09:00"),
          ends_at: iso("10:00"),
          travel_before_min: 20,
          travel_after_min: 10,
        }),
        // Leaves a 10-minute gap after it: no slot there.
        block({ starts_at: iso("11:50"), ends_at: iso("12:30") }),
        block({ starts_at: iso("10:20"), ends_at: iso("11:40"), status: "cancelled" }),
      ],
      DEFAULT_SETTINGS,
    );
    // Times in UTC (Istanbul is UTC+3).
    expect(shape(slots)).toEqual([
      ["light", "05:00", "05:40"],
      // 10:10–11:50 is 100 minutes: one deep slot of 90; the 10 left are too short for a break.
      ["deep", "07:10", "08:40"],
    ]);
  });

  it("cuts a long gap into deep slots with a break between them", () => {
    const slots = buildSlots(window("08:00", "12:00"), [], DEFAULT_SETTINGS);
    expect(shape(slots)).toEqual([
      ["deep", "05:00", "06:30"],
      ["break", "06:30", "06:45"],
      ["deep", "06:45", "08:15"],
      ["break", "08:15", "08:30"],
      ["light", "08:30", "09:00"],
    ]);
  });

  it("opens no slot after the finish line", () => {
    const plan = buildPlan(input({ now: at("18:30"), tasks: [task({ est_minutes: 20 })] }));
    expect(plan.slots.every((slot) => slot.end <= at("19:00"))).toBe(true);
    expect(buildPlan(input({ now: at("19:05"), tasks: [task()] })).slots).toEqual([]);
  });
});

describe("filters", () => {
  const slot = (kind: Slot["kind"], minutes: number): Slot => ({
    kind,
    minutes,
    start: at("10:00"),
    end: new Date(at("10:00").getTime() + minutes * 60_000),
    assignment: null,
  });
  const candidate = (overrides: Partial<Candidate>): Candidate => ({
    type: "task",
    id: testId(),
    title: "İş",
    moduleId: "m",
    minutes: 30,
    energy: "light",
    context: "any",
    dueAt: null,
    importance: 2,
    createdAt: iso("08:00"),
    score: 1,
    mandatory: null,
    ...overrides,
  });

  it("length: the work must fit in the slot", () => {
    expect(fits(candidate({ minutes: 60 }), slot("deep", 45), "desk")).toBe(false);
    expect(fits(candidate({ minutes: 45 }), slot("deep", 45), "desk")).toBe(true);
  });

  it("length counts the learned estimate multiplier", () => {
    const mod = moduleRow();
    const plan = buildPlan(
      input({
        modules: [mod],
        // 40 minutes × 1.5 = 60: too long for the only slot (45 minutes).
        tasks: [task({ est_minutes: 40, kind: "prep" })],
        stats: [{ key: `est_multiplier:${mod.slug}:prep`, value: 1.5, sample_size: 6 }],
        finishLine: at("08:45"),
      }),
    );
    expect(plan.candidates[0].minutes).toBe(60);
    expect(placedIds(plan)).toEqual([]);
  });

  it("energy: deep slots take deep and light work, light slots light, breaks physical or short light", () => {
    expect(fits(candidate({ energy: "deep" }), slot("deep", 60), "desk")).toBe(true);
    expect(fits(candidate({ energy: "light" }), slot("deep", 60), "desk")).toBe(true);
    expect(fits(candidate({ energy: "physical" }), slot("deep", 60), "desk")).toBe(false);
    expect(fits(candidate({ energy: "deep" }), slot("light", 30), "desk")).toBe(false);
    expect(fits(candidate({ energy: "light" }), slot("light", 30), "desk")).toBe(true);
    expect(fits(candidate({ energy: "physical", minutes: 15 }), slot("break", 15), "desk")).toBe(
      true,
    );
    expect(fits(candidate({ energy: "light", minutes: 15 }), slot("break", 15), "desk")).toBe(true);
    expect(fits(candidate({ energy: "deep", minutes: 15 }), slot("break", 15), "desk")).toBe(false);
  });

  it("context: the second screen sees desk, home and any; the phone what the user chose", () => {
    const deep = slot("deep", 60);
    expect(fits(candidate({ context: "desk" }), deep, "desk")).toBe(true);
    expect(fits(candidate({ context: "home" }), deep, "desk")).toBe(true);
    expect(fits(candidate({ context: "office" }), deep, "desk")).toBe(false);
    expect(fits(candidate({ context: "campus" }), deep, "campus")).toBe(true);
    expect(fits(candidate({ context: "home" }), deep, "campus")).toBe(false);
  });

  it("puts deep work only where a deep slot is", () => {
    const deep = task({ title: "Derin", energy: "deep", est_minutes: 30 });
    // 08:00–08:40 is a light slot (40 minutes), then a block, then 45 minutes of deep time.
    const plan = buildPlan(
      input({
        tasks: [deep],
        blocks: [block({ starts_at: iso("08:40"), ends_at: iso("09:00") })],
        finishLine: at("09:45"),
      }),
    );
    const slotOf = plan.slots.find((row) => row.assignment?.candidate.id === deep.id)!;
    expect(slotOf.start.getTime()).toBe(at("09:00").getTime());
  });
});

describe("mandatory work", () => {
  it("goes first whatever the score", () => {
    const old = task({
      title: "Eski ve önemli",
      importance: 4,
      created_at: iso("09:00", "2026-09-01"),
    });
    const due = task({ title: "Bugün teslim", importance: 1, due_at: iso("17:00") });
    // One 45-minute slot; the capacity factor leaves room for one of the two.
    const plan = buildPlan(input({ tasks: [old, due], finishLine: at("08:45") }));
    expect(plan.candidates[0]).toMatchObject({ id: due.id, mandatory: "due_today" });
    expect(placedIds(plan)).toEqual([due.id]);
    expect(plan.overflow.map((row) => row.id)).toEqual([old.id]);
    expect(plan.top3[0]).toBe(due.id);
  });

  it("includes work that would not make its deadline if not started today", () => {
    // 1,200 minutes left, due the day after tomorrow: three days of about 460 usable minutes.
    const item = workItem({
      effort_total_minutes: 1200,
      effort_done_minutes: 0,
      due_at: iso("19:00", shiftDay(DATE, 2)),
    });
    const sitting = task({ work_item_id: item.id, est_minutes: 45, due_at: item.due_at });
    const [first] = buildCandidates(input({ workItems: [item], tasks: [sitting] }));
    expect(first.mandatory).toBe("urgent");
  });

  it("does not pile a passed deadline onto today", () => {
    const late = task({ title: "Kaçan", due_at: iso("17:00", shiftDay(DATE, -2)) });
    const [candidate] = buildCandidates(input({ tasks: [late] }));
    expect(candidate.mandatory).toBeNull();
  });
});

describe("floors", () => {
  const SUNDAY = "2026-11-15";
  const sport: ModuleRow = moduleRow({
    id: "33333333-3333-4333-8333-333333333333",
    slug: "spor",
    kind: "lifelong",
    weight: 1,
    weekly_floor_minutes: 90,
    mode_behavior: { busy: { weightMultiplier: 0.2, floorMultiplier: 0 } },
  });
  const school: ModuleRow = moduleRow({ slug: "okul", kind: "term", weight: 2 });

  it("keeps a lifelong module's weekly floor in busy mode", () => {
    const run = task({ module_id: sport.id, title: "Koşu", energy: "light", est_minutes: 45 });
    const exams = [1, 2, 3].map((n) =>
      task({
        module_id: school.id,
        title: `Sınav ${n}`,
        importance: 4,
        est_minutes: 45,
        due_at: iso("19:00", "2026-11-20"),
      }),
    );
    const plan = buildPlan(
      input({
        date: SUNDAY,
        now: at("08:00", SUNDAY),
        dayStart: at("08:00", SUNDAY),
        finishLine: at("10:00", SUNDAY),
        lifeMode: "busy",
        modules: [sport, school],
        tasks: [run, ...exams],
        spentThisWeek: { [sport.id]: 0 },
      }),
    );
    const runCandidate = plan.candidates.find((row) => row.id === run.id)!;
    expect(runCandidate.mandatory).toBe("floor");
    expect(placedIds(plan)).toContain(run.id);
  });

  it("does not raise the floor once the week's minutes are worked", () => {
    const run = task({ module_id: sport.id, est_minutes: 45 });
    const [candidate] = buildCandidates(
      input({
        date: SUNDAY,
        lifeMode: "busy",
        modules: [sport],
        tasks: [run],
        spentThisWeek: { [sport.id]: 60 },
      }),
    );
    expect(candidate.mandatory).toBeNull();
  });

  it("keeps a rhythm's floor in busy mode, below its busy target", () => {
    const stretch = rhythm({ target_count: 4, floor_count: 2, mode_targets: { busy: 1 } });
    // Saturday: two days left, two still needed for the floor.
    const saturday = "2026-11-14";
    const [candidate] = buildCandidates(
      input({ date: saturday, lifeMode: "busy", rhythms: [stretch] }),
    );
    expect(candidate).toMatchObject({ id: stretch.id, mandatory: "floor", progress: "0/2" });
    // On Thursday there is still time: not mandatory.
    const [thursday] = buildCandidates(input({ lifeMode: "busy", rhythms: [stretch] }));
    expect(thursday.mandatory).toBeNull();
  });

  it("offers nothing of a module the life mode switches off, except what is due today", () => {
    const off = moduleRow({
      mode_behavior: { holiday: { weightMultiplier: 0, floorMultiplier: 0 } },
    });
    const idle = task({ module_id: off.id });
    const due = task({ module_id: off.id, due_at: iso("18:00") });
    const ids = buildCandidates(
      input({ lifeMode: "holiday", modules: [off], tasks: [idle, due] }),
    ).map((row) => row.id);
    expect(ids).toEqual([due.id]);
  });
});

describe("the end of the day", () => {
  it("says the day is done once the three and the mandatory work are finished", () => {
    const [a, b, c] = [1, 2, 3].map((n) =>
      task({ title: `İş ${n}`, status: "done", done_at: iso("10:00") }),
    );
    const extra = task({ title: "Vakit kalırsa" });
    const plan = buildPlan(
      input({ now: at("11:00"), tasks: [a, b, c, extra], top3: [a.id, b.id, c.id] }),
    );
    expect(plan.top3Done).toBe(3);
    expect(plan.now).toMatchObject({ kind: "done", finished: 3 });
  });

  it("is not done while mandatory work is left", () => {
    const [a, b, c] = [1, 2, 3].map(() => task({ status: "done", done_at: iso("10:00") }));
    const due = task({ due_at: iso("18:00") });
    const plan = buildPlan(
      input({ now: at("11:00"), tasks: [a, b, c, due], top3: [a.id, b.id, c.id] }),
    );
    expect(plan.now.kind).toBe("suggest");
  });

  it("is night after the finish line and after the evening closing", () => {
    expect(buildPlan(input({ now: at("19:30"), tasks: [task()] })).now.kind).toBe("night");
    expect(buildPlan(input({ now: at("15:00"), closed: true, tasks: [task()] })).now.kind).toBe(
      "night",
    );
    expect(buildPlan(input({ now: at("02:00"), tasks: [task()] })).now.kind).toBe("night");
  });

  it("an open session wins over everything", () => {
    const work = task();
    const open = session({ task_id: work.id, started_at: iso("19:10") });
    const plan = buildPlan(input({ now: at("19:30"), tasks: [work], openSession: open }));
    expect(plan.now).toMatchObject({ kind: "running", task: { id: work.id } });
  });

  it("shows a block while it runs, and a question when one is due", () => {
    const now = block({ starts_at: iso("09:00"), ends_at: iso("10:00") });
    expect(buildPlan(input({ now: at("09:30"), blocks: [now] })).now.kind).toBe("block");
    const question = prompt();
    expect(
      buildPlan(input({ now: at("10:30"), blocks: [now], prompt: question, tasks: [task()] })).now,
    ).toMatchObject({
      kind: "prompt",
      prompt: { id: question.id },
    });
  });
});

describe("the automatic plan", () => {
  it("is the same as the plan made at the evening closing", () => {
    const mod = moduleRow();
    const tasks = [
      task({ title: "Rapor", energy: "deep", est_minutes: 60, importance: 3 }),
      task({ title: "Fatura", est_minutes: 15, due_at: iso("17:00") }),
      task({ title: "Okuma", est_minutes: 45, created_at: iso("09:00", "2026-10-20") }),
    ];
    const blocks = [block({ starts_at: iso("12:00"), ends_at: iso("13:00") })];
    const rhythms = [rhythm({ title: "Esneme", target_count: 3 })];
    const base = { modules: [mod], tasks, blocks, rhythms };
    // The evening before, for tomorrow…
    const closing = buildPlan(input({ ...base, now: at("21:30", shiftDay(DATE, -1)) }));
    // …and on the day's first touch, from the same data.
    const auto = buildPlan(input({ ...base, now: at("08:00") }));
    expect(auto.top3).toEqual(closing.top3);
    expect(shape(auto.slots)).toEqual(shape(closing.slots));
    expect(placedIds(auto)).toEqual(placedIds(closing));
  });
});

describe("the return state", () => {
  const away = { lastSeenAt: at("21:00", shiftDay(DATE, -4)) };

  it("opens after three days away and does not pile up what was missed", () => {
    const missed = task({
      title: "Kaçan",
      due_at: iso("17:00", shiftDay(DATE, -2)),
      importance: 3,
    });
    const planned = task({ title: "Planlanmıştı", planned_date: shiftDay(DATE, -3) });
    const fresh = task({ title: "Yeni", due_at: iso("17:00", shiftDay(DATE, 5)), importance: 3 });
    const plan = buildPlan(input({ ...away, tasks: [missed, planned, fresh] }));
    expect(plan.now.kind).toBe("return");
    expect(plan.candidates.every((row) => row.mandatory === null)).toBe(true);
    expect(plan.top3.length).toBeLessThanOrEqual(3);
    if (plan.now.kind === "return") expect(plan.now.top3.length).toBe(plan.top3.length);
  });

  it("forgets the days planned during the absence", () => {
    const later = task({ planned_date: shiftDay(DATE, 1) });
    expect(buildCandidates(input({ ...away, tasks: [later] })).map((row) => row.id)).toEqual([
      later.id,
    ]);
    expect(buildCandidates(input({ tasks: [later] }))).toEqual([]);
  });

  it("ends once something is started", () => {
    const plan = buildPlan(input({ ...away, startedToday: true, tasks: [task()] }));
    expect(plan.now.kind).toBe("suggest");
  });

  it("does not open after two days", () => {
    const plan = buildPlan(input({ lastSeenAt: at("21:00", shiftDay(DATE, -2)), tasks: [task()] }));
    expect(plan.now.kind).toBe("suggest");
  });
});

describe("waiting work", () => {
  it("is never a candidate; on its follow-up day a short reminder is", () => {
    const waiting = task({
      status: "waiting",
      waiting_on: "Hoca",
      follow_up_on: shiftDay(DATE, 1),
    });
    expect(buildCandidates(input({ tasks: [waiting] }))).toEqual([]);
    const due = { ...waiting, follow_up_on: DATE };
    expect(buildCandidates(input({ tasks: [due] }))).toMatchObject([
      { type: "follow_up", id: waiting.id, minutes: 5, energy: "light" },
    ]);
  });
});

describe("the AI's advice", () => {
  it("cannot put off mandatory work; the engine keeps it and says so", () => {
    const due = task({ title: "Bugün teslim", due_at: iso("17:00") });
    const plain = task({ title: "Sıradan" });
    const plan = buildPlan(input({ tasks: [due, plain], advice: { defer: [due.id, plain.id] } }));
    expect(placedIds(plan)).toEqual([due.id]);
    expect(plan.warnings).toMatchObject([{ kind: "advice_rejected", subjectId: due.id }]);
  });

  it("puts its three after the mandatory work, cut at the capacity", () => {
    const tasks = [1, 2, 3, 4].map((n) => task({ title: `İş ${n}`, est_minutes: 30 }));
    const ai = [tasks[3].id, tasks[2].id, tasks[1].id];
    // 90 minutes of slots × 0.7: room for two of the three.
    const plan = buildPlan(input({ tasks, advice: { top3: ai }, finishLine: at("09:30") }));
    expect(placedIds(plan)).toEqual([tasks[3].id, tasks[2].id]);
    expect(plan.top3).toEqual([tasks[3].id, tasks[2].id]);
  });

  it("raises what it prefers", () => {
    const [a, b] = [task({ title: "A" }), task({ title: "B" })];
    const plain = buildCandidates(input({ tasks: [a, b] }));
    const preferred = buildCandidates(input({ tasks: [a, b], advice: { prefer: [b.id] } }));
    expect(preferred.find((row) => row.id === b.id)!.score).toBeCloseTo(
      plain.find((row) => row.id === b.id)!.score * 1.5,
    );
  });

  it("carries its reasons behind 'neden?'", () => {
    const work = task();
    const plan = buildPlan(
      input({ tasks: [work], advice: { reasons: { [work.id]: "Sabah daha verimli." } } }),
    );
    expect(plan.slots.find((slot) => slot.assignment)!.assignment!.reasons).toContain(
      "Sabah daha verimli.",
    );
  });

  it("is not needed: without it the plan is whole", () => {
    const tasks = [task({ est_minutes: 30 }), task({ est_minutes: 45, energy: "deep" })];
    const plan = buildPlan(input({ tasks }));
    expect(placedIds(plan).sort()).toEqual(tasks.map((row) => row.id).sort());
    expect(plan.top3.length).toBe(2);
    expect(plan.now.kind).toBe("suggest");
    expect(plan.plannedMinutes).toBeLessThanOrEqual(plan.usableMinutes);
  });
});

describe("capacity", () => {
  it("never plans more than the slots times the day's factor; the rest is overflow", () => {
    const tasks = Array.from({ length: 12 }, (_, n) =>
      task({ title: `İş ${n}`, est_minutes: 60, energy: "deep" }),
    );
    const plan = buildPlan(input({ tasks }));
    // 08:00–19:00 is 660 minutes, minus breaks it is still more than 400; × 0.7.
    expect(plan.plannedMinutes).toBeLessThanOrEqual(plan.usableMinutes);
    expect(plan.overflow.length).toBeGreaterThan(0);
  });

  it("uses the learned factor once five days stand behind it", () => {
    const base = input({ tasks: [task()] });
    const learnedPlan = buildPlan({
      ...base,
      stats: [{ key: "capacity:home", value: 0.35, sample_size: 5 }],
    });
    const early = buildPlan({
      ...base,
      stats: [{ key: "capacity:home", value: 0.35, sample_size: 4 }],
    });
    expect(learnedPlan.usableMinutes).toBe(Math.round(early.usableMinutes / 2));
  });
});

describe("warnings", () => {
  it("are two at most, a missed deadline first", () => {
    const item = workItem({
      title: "Tez",
      effort_total_minutes: 3000,
      due_at: iso("19:00", shiftDay(DATE, 1)),
    });
    const sitting = task({ work_item_id: item.id, due_at: item.due_at, est_minutes: 60 });
    const nagged = task({ title: "Hep ertelenen", defer_count: 3 });
    const committed = workItem({ title: "Adımsız", effort_total_minutes: 120 });
    const plan = buildPlan(
      input({
        workItems: [item, committed],
        tasks: [sitting, nagged],
        committed: [item.id, committed.id],
      }),
    );
    expect(plan.warnings.map((row) => row.kind)).toEqual(["deadline", "next_step"]);
  });

  it("asks to split, drop or date a task put off three times", () => {
    const plan = buildPlan(input({ tasks: [task({ title: "Hep ertelenen", defer_count: 3 })] }));
    expect(plan.warnings).toMatchObject([{ kind: "deferred_often" }]);
  });
});

describe("work items and the week", () => {
  it("offers only the committed items once the week has a plan", () => {
    const inWeek = workItem({ title: "Bu hafta" });
    const later = workItem({ title: "Sonra" });
    const ids = buildCandidates(input({ workItems: [inWeek, later], committed: [inWeek.id] })).map(
      (row) => row.id,
    );
    expect(ids).toEqual([inWeek.id]);
  });

  it("knows a member of the day's three by its sitting", () => {
    const item = workItem({ title: "Kalem" });
    const done = task({ work_item_id: item.id, status: "done", done_at: iso("10:00") });
    const plan = buildPlan(
      input({ now: at("11:00"), workItems: [item], tasks: [done], top3: [item.id] }),
    );
    expect(plan.top3Done).toBe(1);
  });
});

describe("pickForMinutes", () => {
  it("gives the best work that fits in the minutes", () => {
    const long = task({ title: "Uzun", est_minutes: 45, importance: 4 });
    const short = task({ title: "Kısa", est_minutes: 15, importance: 2 });
    expect(pickForMinutes(input({ tasks: [long, short] }), 20)?.id).toBe(short.id);
    expect(pickForMinutes(input({ tasks: [long, short] }), 60)?.id).toBe(long.id);
    expect(pickForMinutes(input({ tasks: [long] }), 20)).toBeNull();
  });

  it("does not offer deep work for a few minutes", () => {
    const deep = task({ energy: "deep", est_minutes: 20 });
    expect(pickForMinutes(input({ tasks: [deep] }), 30)).toBeNull();
  });
});

describe("rhythms", () => {
  it("are offered while their period has a debt, once a day", () => {
    const water = rhythm({ title: "Su", target_count: 3, period: "week" });
    const logs = [rhythmLog(water.id, DATE)];
    expect(buildCandidates(input({ rhythms: [water], rhythmLogs: logs }))).toEqual([]);
    const yesterday = [rhythmLog(water.id, shiftDay(DATE, -1))];
    expect(buildCandidates(input({ rhythms: [water], rhythmLogs: yesterday }))).toMatchObject([
      { id: water.id, progress: "1/3" },
    ]);
  });

  it("do not see earlier periods", () => {
    const weekly = rhythm({ target_count: 1 });
    const lastWeek = [rhythmLog(weekly.id, shiftDay(DATE, -7))];
    expect(buildCandidates(input({ rhythms: [weekly], rhythmLogs: lastWeek }))).toMatchObject([
      { progress: "0/1" },
    ]);
  });
});
