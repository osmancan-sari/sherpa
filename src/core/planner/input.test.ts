import { describe, expect, it } from "vitest";
import {
  block,
  dayRow,
  lifeModePeriod,
  moduleRow,
  prompt,
  rhythmLog,
  session,
  task,
  workItem,
} from "@/core/testing/factories";
import { istanbulInstant } from "@/lib/date";
import { lifeModeOn, type PlanRows, planInput, tomorrowInput } from "./input";
import { buildPlan } from "./plan";

// The planner's input put together from the rows (src/core/planner/input.ts).

const DATE = "2026-11-12";
const at = (time: string, day = DATE) => istanbulInstant(day, time);

function rows(overrides: Partial<PlanRows> = {}): PlanRows {
  return {
    settings: null,
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

describe("planInput", () => {
  it("starts the day at its first touch, else at the default; ends it at the finish line", () => {
    const plain = planInput(rows(), { date: DATE, now: at("09:00"), context: "desk" });
    expect(plain.dayStart).toEqual(at("08:00"));
    expect(plain.finishLine).toEqual(at("19:00"));
    const touched = planInput(
      rows({ days: [dayRow({ started_at: at("06:30").toISOString(), finish_line: "17:30:00" })] }),
      { date: DATE, now: at("09:00"), context: "desk" },
    );
    expect(touched.dayStart).toEqual(at("06:30"));
    expect(touched.finishLine).toEqual(at("17:30"));
  });

  it("takes the day's three, its skips and the AI's advice from the day's record", () => {
    const day = dayRow({
      top3: ["a", "b"],
      plan: { version: 1, skipped: ["c"], advice: { prefer: ["d"] } },
      closed_at: at("21:00").toISOString(),
    });
    const input = planInput(rows({ days: [day] }), {
      date: DATE,
      now: at("09:00"),
      context: "desk",
    });
    expect(input).toMatchObject({
      top3: ["a", "b"],
      skipped: ["c"],
      advice: { prefer: ["d"] },
      closed: true,
    });
  });

  it("reads the day type from the blocks and the life mode from the periods", () => {
    const office = block({ day_type: "office" });
    const input = planInput(rows({ blocks: [office], lifeModes: [lifeModePeriod()] }), {
      date: DATE,
      now: at("09:00"),
      context: "desk",
    });
    expect(input).toMatchObject({ dayType: "office", lifeMode: "busy" });
    expect(lifeModeOn([lifeModePeriod()], "2026-11-16")).toBe("normal");
  });

  it("sees the last use before today: sessions, rhythm logs, entries, finished work", () => {
    const old = session({ started_at: at("10:00", "2026-11-08").toISOString() });
    const log = {
      ...rhythmLog("r", "2026-11-09"),
      created_at: at("20:00", "2026-11-09").toISOString(),
    };
    const todays = session({ started_at: at("08:30").toISOString() });
    const input = planInput(rows({ sessions: [old, todays], rhythmLogs: [log] }), {
      date: DATE,
      now: at("09:00"),
      context: "desk",
    });
    expect(input.lastSeenAt).toEqual(at("20:00", "2026-11-09"));
    expect(input.startedToday).toBe(true);
  });

  it("counts a day's first touch and its closing as use", () => {
    const touched = dayRow({
      date: "2026-11-11",
      started_at: at("07:30", "2026-11-11").toISOString(),
    });
    const closed = dayRow({
      date: "2026-11-10",
      closed_at: at("22:00", "2026-11-10").toISOString(),
    });
    const input = planInput(rows({ days: [closed, touched] }), {
      date: DATE,
      now: at("09:00"),
      context: "desk",
    });
    expect(input.lastSeenAt).toEqual(at("07:30", "2026-11-11"));
  });

  it("counts a recorded waking and bedtime as use, even when they came from outside (Ç3d)", () => {
    // The phone's automation wrote them; nobody touched a screen those days.
    const woke = dayRow({ date: "2026-11-11", woke_at: at("06:50", "2026-11-11").toISOString() });
    const slept = dayRow({ date: "2026-11-10", bed_at: at("23:40", "2026-11-10").toISOString() });
    const input = planInput(rows({ days: [slept, woke] }), {
      date: DATE,
      now: at("09:00"),
      context: "desk",
    });
    expect(input.lastSeenAt).toEqual(at("06:50", "2026-11-11"));
    const asleep = planInput(rows({ days: [slept] }), {
      date: DATE,
      now: at("09:00"),
      context: "desk",
    });
    expect(asleep.lastSeenAt).toEqual(at("23:40", "2026-11-10"));
  });

  it("adds up this week's minutes per module", () => {
    const mod = moduleRow();
    const monday = session({
      module_id: mod.id,
      started_at: at("10:00", "2026-11-09").toISOString(),
      ended_at: at("10:40", "2026-11-09").toISOString(),
    });
    const lastWeek = session({
      module_id: mod.id,
      started_at: at("10:00", "2026-11-06").toISOString(),
      ended_at: at("12:00", "2026-11-06").toISOString(),
    });
    const input = planInput(rows({ modules: [mod], sessions: [monday, lastWeek] }), {
      date: DATE,
      now: at("09:00"),
      context: "desk",
    });
    expect(input.spentThisWeek).toEqual({ [mod.id]: 40 });
  });

  it("plans tomorrow without today's session or question", () => {
    const input = tomorrowInput(rows({ tasks: [task()] }), { now: at("21:00"), context: "desk" });
    expect(input).toMatchObject({
      date: "2026-11-13",
      openSession: null,
      prompt: null,
      startedToday: false,
    });
  });

  it("after midnight plans the day that is starting, not the one after it", () => {
    const input = tomorrowInput(rows(), { now: at("00:30", "2026-11-13"), context: "desk" });
    expect(input.date).toBe("2026-11-13");
  });

  it("asks only a question that is due and still waiting", () => {
    const later = prompt({ ask_after: at("12:00").toISOString() });
    const answered = prompt({ status: "answered" });
    const due = prompt({ ask_after: at("08:00").toISOString() });
    const input = planInput(rows({ prompts: [later, answered, due] }), {
      date: DATE,
      now: at("09:00"),
      context: "desk",
    });
    expect(input.prompt?.id).toBe(due.id);
  });
});

describe("the automatic plan, from the rows", () => {
  it("is the same as the plan made at the evening closing", () => {
    const day = "2026-11-13";
    const startsTomorrow = workItem({
      title: "Yarın başlar",
      earliest_at: istanbulInstant(day, "00:00").toISOString(),
      effort_total_minutes: 120,
    });
    const data = rows({
      tasks: [
        task({ title: "Rapor", energy: "deep", est_minutes: 60, importance: 3 }),
        task({ title: "Fatura", est_minutes: 15, due_at: at("17:00", day).toISOString() }),
      ],
      workItems: [startsTomorrow],
      blocks: [
        block({
          starts_at: at("12:00", day).toISOString(),
          ends_at: at("13:00", day).toISOString(),
        }),
      ],
    });
    const closing = buildPlan(tomorrowInput(data, { now: at("21:30"), context: "desk" }));
    // The first touch comes at the day's start: the record has it.
    const touched = {
      ...data,
      days: [dayRow({ date: day, started_at: at("08:00", day).toISOString() })],
    };
    const auto = buildPlan(
      planInput(touched, { date: day, now: at("08:00", day), context: "desk" }),
    );
    expect(auto.top3).toEqual(closing.top3);
    expect(auto.top3).toContain(startsTomorrow.id);
    const ids = (plan: typeof auto) =>
      plan.slots.flatMap((slot) => (slot.assignment ? [slot.assignment.candidate.id] : []));
    expect(ids(auto)).toEqual(ids(closing));
  });
});
