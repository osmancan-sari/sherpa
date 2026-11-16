import { describe, expect, it } from "vitest";
import type { Timing } from "@/core/contract/timing";
import { buildPlan, type PlanRows, planInput } from "@/core/planner";
import {
  block,
  dayRow,
  moduleRow,
  rhythm,
  session,
  settingsRow,
  task,
} from "@/core/testing/factories";
import type { DayRow, Rhythm, Task } from "@/core/types";
import { istanbulInstant } from "@/lib/date";
import { chainOf } from "./chain";
import { welcomeOf } from "./welcome";

// Sabah açılışı (16 Nov 2026): whether the app opens on the welcome of the wake chain's scene.
// Pure, from the plan's input and the wake chain.

const DATE = "2026-11-12"; // a Thursday
const at = (time: string, day = DATE) => istanbulInstant(day, time);
const iso = (time: string, day = DATE) => at(time, day).toISOString();

const CARE = moduleRow({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  slug: "bakim",
  name: "Bakım",
});
const MOVE = moduleRow({
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  slug: "hareket",
  name: "Hareket",
});

const FRAME = { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 };

function rows(overrides: Partial<PlanRows> = {}): PlanRows {
  return {
    settings: settingsRow({ day_frame: FRAME }),
    modules: [CARE, MOVE],
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
    stats: [],
    ...overrides,
  };
}

const anchored = (overrides: Partial<Task> = {}, extra: Partial<Timing> = {}) =>
  task({
    module_id: CARE.id,
    timing: { anchor: "wake", ...extra },
    energy: "light",
    est_minutes: 10,
    ...overrides,
  });

const neck = (overrides: Partial<Rhythm> = {}) =>
  rhythm({
    module_id: MOVE.id,
    period: "day",
    target_count: 1,
    est_minutes: 15,
    timing: { anchor: "wake", order: 20 },
    title: "Boyun",
    ...overrides,
  });

/** The morning: teeth (care, 10), neck (move, 20); the day's row as given. */
function morning(day: Partial<DayRow> | null = null, extra: Partial<PlanRows> = {}) {
  const teeth = anchored({ title: "Diş ve su" }, { order: 10 });
  const data = rows({
    tasks: [teeth],
    rhythms: [neck()],
    days: day ? [dayRow({ date: DATE, ...day })] : [],
    ...extra,
  });
  return { teeth, data };
}

function welcomeAt(data: PlanRows, time: string, dismissed = false) {
  const input = planInput(data, { date: DATE, now: at(time), context: "desk" });
  const plan = buildPlan(input);
  return welcomeOf(input, chainOf(input, plan, "wake"), dismissed);
}

describe("welcomeOf", () => {
  it("comes in the morning before the waking, for the wake chain's first work", () => {
    const { teeth, data } = morning();
    const welcome = welcomeAt(data, "07:00");
    expect(welcome).toMatchObject({ woke: null, target: { type: "task", id: teeth.id } });
    expect(welcome?.row.title).toBe("Diş ve su");
  });

  it("comes from the start of the waking range to two hours after the latest waking", () => {
    // No obligation: the latest waking is the range's end, 09:00; the welcome lasts to 11:00.
    const { data } = morning();
    expect(welcomeAt(data, "05:59")).toBeNull();
    expect(welcomeAt(data, "06:00")).not.toBeNull();
    expect(welcomeAt(data, "10:30")).not.toBeNull();
    expect(welcomeAt(data, "11:00")).not.toBeNull();
    expect(welcomeAt(data, "11:01")).toBeNull();
  });

  it("ends earlier when the day's first obligation pulls the latest waking earlier", () => {
    // A block at 08:30: the latest waking is 08:30 less the morning (10 + 15 min) = 08:05.
    const { data } = morning(null, {
      blocks: [block({ title: "Ders", starts_at: iso("08:30"), ends_at: iso("10:00") })],
    });
    expect(welcomeAt(data, "10:05")).not.toBeNull();
    expect(welcomeAt(data, "10:06")).toBeNull();
  });

  it("comes from the day's expected waking when it is before the range ('Yarın erken kalkacağım')", () => {
    const { data } = morning({ expected_wake: "05:15:00" });
    expect(welcomeAt(data, "05:14")).toBeNull();
    expect(welcomeAt(data, "05:15")).not.toBeNull();
    // A later expected waking does not move the start: the range's start stands.
    expect(welcomeAt(morning({ expected_wake: "07:30:00" }).data, "06:00")).not.toBeNull();
  });

  it("follows the day type's own waking range", () => {
    const { data } = morning(null, {
      settings: settingsRow({
        day_frame: { ...FRAME, by_day_type: { home: { wake: ["07:30", "09:00"] } } },
      }),
    });
    expect(welcomeAt(data, "07:29")).toBeNull();
    expect(welcomeAt(data, "07:30")).not.toBeNull();
  });

  it("comes with a waking told from outside, which it carries", () => {
    const { teeth, data } = morning({ woke_at: iso("06:58"), woke_source: "outside" });
    expect(welcomeAt(data, "07:05")).toMatchObject({
      woke: at("06:58"),
      target: { type: "task", id: teeth.id },
    });
  });

  it("does not come after a waking said on a screen or estimated from a touch", () => {
    expect(welcomeAt(morning({ woke_at: iso("07:00") }).data, "07:05")).toBeNull();
    expect(
      welcomeAt(
        morning({ woke_at: iso("07:00"), woke_source: "screen", woke_estimated: false }).data,
        "07:05",
      ),
    ).toBeNull();
    expect(
      welcomeAt(
        morning({ woke_at: iso("07:00"), woke_source: "estimate", woke_estimated: true }).data,
        "07:05",
      ),
    ).toBeNull();
  });

  it("does not come once the chain has begun, while something runs, or after 'Şimdi değil'", () => {
    const outside = { woke_at: iso("06:58"), woke_source: "outside" } as const;
    const { teeth, data } = morning(outside);
    // The teeth were done today: the chain has begun.
    const done = { ...teeth, status: "done" as const, done_at: iso("07:03") };
    expect(welcomeAt({ ...data, tasks: [done] }, "07:05")).toBeNull();
    // Something runs.
    expect(
      welcomeAt(
        { ...data, openSession: session({ task_id: teeth.id, module_id: CARE.id }) },
        "07:05",
      ),
    ).toBeNull();
    // "Şimdi değil" said today on this device.
    expect(welcomeAt(data, "07:05", true)).toBeNull();
  });

  it("without a waking, work passed by the clock is no beginning; work put off today is", () => {
    // Past the morning (10:00) the plan reads the unwoken chain as passed; "Başla" writes the
    // waking now and offers it again: the welcome still starts its first work.
    const { teeth, data } = morning();
    expect(welcomeAt(data, "10:30")).toMatchObject({ target: { type: "task", id: teeth.id } });
    const own = neck();
    const putOff = rows({
      tasks: [teeth],
      rhythms: [own],
      days: [dayRow({ date: DATE, plan: { skipped: [own.id], putOff: [own.id] } })],
    });
    expect(welcomeAt(putOff, "07:00")).toBeNull();
    // A task moved to tomorrow today with "Ertele" stays in the chain as passed: begun.
    const deferred = {
      ...teeth,
      planned_date: "2026-11-13",
      defer_count: 1,
      updated_at: iso("06:30"),
    };
    expect(welcomeAt({ ...data, tasks: [deferred] }, "07:00")).toBeNull();
    // Put off on another day (changed yesterday): no beginning today.
    const older = { ...deferred, updated_at: iso("20:00", "2026-11-11") };
    expect(welcomeAt({ ...data, tasks: [older] }, "07:00")).not.toBeNull();
  });

  it("with a waking told from outside, its chain must still be offered", () => {
    // Woken at 06:00: the chain ran 06:00–06:25 and is offered until an hour after its end.
    const { data } = morning({ woke_at: iso("06:00"), woke_source: "outside" });
    expect(welcomeAt(data, "07:20")).not.toBeNull();
    expect(welcomeAt(data, "07:30")).toBeNull();
  });

  it("does not come with the frame off or nothing bound to the waking", () => {
    const { data } = morning();
    expect(welcomeAt({ ...data, settings: settingsRow({ day_frame: null }) }, "07:00")).toBeNull();
    expect(welcomeAt({ ...data, tasks: [], rhythms: [] }, "07:00")).toBeNull();
  });
});
