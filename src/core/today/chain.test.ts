import { describe, expect, it } from "vitest";
import type { Timing } from "@/core/contract/timing";
import { buildPlan, type PlanRows, planInput } from "@/core/planner";
import {
  dayRow,
  moduleRow,
  rhythm,
  rhythmLog,
  session,
  settingsRow,
  task,
} from "@/core/testing/factories";
import type { DayRow, Rhythm, Task } from "@/core/types";
import { istanbulInstant } from "@/lib/date";
import {
  type ChainLook,
  chainLine,
  chainOf,
  chainsOf,
  nextInChain,
  sceneChain,
  wakeChainStart,
} from "./chain";

// The anchored chains (docs/06-modul-sozlesmesi.md, "Diziler"; Ç3f): wake-bound and bed-bound
// work of the day, from the plan's anchored slots and the day's records. Pure.

const DATE = "2026-11-12"; // a Thursday
const NEXT = "2026-11-13";
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
  color: "#16a34a",
});

function rows(overrides: Partial<PlanRows> = {}): PlanRows {
  return {
    settings: settingsRow(),
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
    lifeModes: [],
    stats: [],
    ...overrides,
  };
}

const today = (overrides: Partial<DayRow> = {}) =>
  dayRow({ date: DATE, woke_at: iso("07:00"), ...overrides });

const anchored = (
  anchor: "wake" | "bed",
  overrides: Partial<Task> = {},
  extra: Partial<Timing> = {},
) =>
  task({
    module_id: CARE.id,
    timing: { anchor, ...extra },
    energy: "light",
    est_minutes: 10,
    ...overrides,
  });

const anchoredRhythm = (anchor: "wake" | "bed", overrides: Partial<Rhythm> = {}) =>
  rhythm({
    module_id: MOVE.id,
    period: "day",
    target_count: 1,
    est_minutes: 15,
    timing: { anchor, order: 20 },
    title: "Boyun",
    ...overrides,
  });

/** What the screens resolve: the module's slug and name, a colour, the facet. */
const look: ChainLook = {
  module: (id) => {
    const mod = [CARE, MOVE].find((row) => row.id === id);
    return mod ? { slug: mod.slug, name: mod.name } : null;
  },
  color: (row) => (row.moduleId === MOVE.id ? "#16a34a" : "#737373"),
  facet: () => null,
};

function setup(data: PlanRows, time: string, day = DATE) {
  const input = planInput(data, { date: DATE, now: at(time, day), context: "desk" });
  return { input, plan: buildPlan(input) };
}

/** The morning: teeth (care, 10), neck (move, 20), shower (care, 30). */
function morning(extra: Partial<PlanRows> = {}) {
  const teeth = anchored("wake", { title: "Diş ve su" }, { order: 10 });
  const neck = anchoredRhythm("wake");
  const shower = anchored("wake", { title: "Duş ve hazırlık", est_minutes: 20 }, { order: 30 });
  return {
    teeth,
    neck,
    shower,
    data: rows({ tasks: [shower, teeth], rhythms: [neck], days: [today()], ...extra }),
  };
}

const states = (chain: ReturnType<typeof chainOf>) =>
  chain?.rows.map((row) => `${row.title}:${row.state}`);

describe("chainOf", () => {
  it("puts two modules' wake-bound work in one chain, in the shared order", () => {
    const { teeth, data } = morning();
    const { input, plan } = setup(
      { ...data, openSession: session({ task_id: teeth.id, module_id: CARE.id }) },
      "07:02",
    );
    const chain = chainOf(input, plan, "wake");
    expect(chain?.anchor).toBe("wake");
    expect(states(chain)).toEqual(["Diş ve su:running", "Boyun:next", "Duş ve hazırlık:next"]);
    expect(chain?.rows.map((row) => row.moduleId)).toEqual([CARE.id, MOVE.id, CARE.id]);
    expect(chain?.rows.map((row) => row.minutes)).toEqual([10, 15, 20]);
  });

  it("gives a scene only the allowed fields: no source, no meta, no module data", () => {
    const { teeth, data } = morning();
    const secret = { ...data.rhythms[0], source_type: "hareket.program", meta: { reps: 12 } };
    const { input, plan } = setup(
      {
        ...data,
        rhythms: [secret],
        openSession: session({ task_id: teeth.id, module_id: CARE.id }),
      },
      "07:02",
    );
    const scene = sceneChain(chainOf(input, plan, "wake")!, CARE.id, look);
    expect(scene.items.map((item) => Object.keys(item).sort())).toEqual(
      Array(3).fill(["color", "facet", "id", "mine", "minutes", "module", "state", "title"]),
    );
    expect(scene.items[1]).toEqual({
      id: secret.id,
      title: "Boyun",
      module: { slug: "hareket", name: "Hareket" },
      facet: null,
      color: "#16a34a",
      minutes: 15,
      state: "next",
      mine: false,
    });
    expect(scene.items.map((item) => item.mine)).toEqual([true, false, true]);
    expect(JSON.stringify(scene)).not.toContain("hareket.program");
    expect(JSON.stringify(scene)).not.toContain("reps");
  });

  it("keeps what was done today in the chain as done, in its place", () => {
    const { teeth, neck, data } = morning();
    const done = { ...teeth, status: "done" as const, done_at: iso("07:10") };
    const { input, plan } = setup(
      {
        ...data,
        tasks: [done, data.tasks[0]],
        rhythmLogs: [rhythmLog(neck.id, DATE)],
        openSession: session({ task_id: data.tasks[0].id, module_id: CARE.id }),
      },
      "07:30",
    );
    expect(states(chainOf(input, plan, "wake"))).toEqual([
      "Diş ve su:done",
      "Boyun:done",
      "Duş ve hazırlık:running",
    ]);
    // Work done yesterday is not today's.
    const yesterday = { ...teeth, status: "done" as const, done_at: iso("07:10", "2026-11-11") };
    const other = setup({ ...data, tasks: [yesterday, data.tasks[0]] }, "07:30");
    expect(states(chainOf(other.input, other.plan, "wake"))).toEqual([
      "Boyun:next",
      "Duş ve hazırlık:next",
    ]);
  });

  it("marks work put off today, and work whose time went by, as passed", () => {
    const { teeth, neck, data } = morning();
    // Ertele: the task goes to tomorrow, the rhythm is skipped for today.
    const putOff = {
      ...teeth,
      planned_date: NEXT,
      defer_count: 1,
      updated_at: iso("07:05"),
    };
    const { input, plan } = setup(
      {
        ...data,
        tasks: [putOff, data.tasks[0]],
        days: [today({ plan: { version: 1, skipped: [neck.id] } })],
      },
      "07:06",
    );
    expect(states(chainOf(input, plan, "wake"))).toEqual([
      "Diş ve su:passed",
      "Boyun:passed",
      "Duş ve hazırlık:next",
    ]);
    // A task planned for tomorrow and not touched today is not this morning's.
    const planned = { ...teeth, planned_date: NEXT };
    const later = setup({ ...data, tasks: [planned, data.tasks[0]] }, "07:06");
    expect(states(chainOf(later.input, later.plan, "wake"))).toEqual([
      "Boyun:next",
      "Duş ve hazırlık:next",
    ]);
    // An hour after the line would have ended it is no longer offered: all passed.
    const missed = setup(data, "10:00");
    expect(states(chainOf(missed.input, missed.plan, "wake"))).toEqual([
      "Diş ve su:passed",
      "Boyun:passed",
      "Duş ve hazırlık:passed",
    ]);
  });

  it("holds a running wake-bound work even after the line is no longer offered", () => {
    const { shower, data } = morning();
    const { input, plan } = setup(
      { ...data, openSession: session({ task_id: shower.id, module_id: CARE.id }) },
      "08:40",
    );
    expect(chainOf(input, plan, "wake")?.rows.find((row) => row.id === shower.id)?.state).toBe(
      "running",
    );
  });

  it("builds the bed chain the same way", () => {
    const teeth = anchored("bed", { title: "Akşam diş" }, { order: 20 });
    const face = anchored("bed", { title: "Yüz" }, { order: 30 });
    const stretch = anchoredRhythm("bed", {
      title: "Esneme",
      timing: { anchor: "bed", order: 10 },
    });
    const data = rows({
      tasks: [face, teeth],
      rhythms: [stretch],
      days: [today({ expected_bed: "23:30:00" })],
    });
    const { input, plan } = setup(
      { ...data, openSession: session({ rhythm_id: stretch.id, module_id: MOVE.id }) },
      "23:00",
    );
    expect(states(chainOf(input, plan, "bed"))).toEqual([
      "Esneme:running",
      "Akşam diş:next",
      "Yüz:next",
    ]);
    // The wake chain of that day is something else.
    expect(chainOf(input, plan, "wake")).toBeNull();
  });

  it("past midnight the bed chain is still the evening's: done and put off by the planning day", () => {
    const teeth = anchored("bed", { title: "Akşam diş" }, { order: 20 });
    const face = anchored("bed", { title: "Yüz" }, { order: 30 });
    const cream = anchored("bed", { title: "Krem" }, { order: 40 });
    const stretch = anchoredRhythm("bed", {
      title: "Esneme",
      timing: { anchor: "bed", order: 10 },
    });
    // The log of 00:10 carries the calendar day (the 13th); the planning day is the 12th.
    const log = { ...rhythmLog(stretch.id, NEXT), created_at: iso("00:10", NEXT) };
    const data = rows({
      tasks: [
        { ...teeth, status: "done", done_at: iso("00:20", NEXT) },
        face,
        // "Ertele" at 00:25: tomorrow is the 13th, the day after the planning day.
        { ...cream, planned_date: NEXT, defer_count: 1, updated_at: iso("00:25", NEXT) },
      ],
      rhythms: [stretch],
      rhythmLogs: [log],
      days: [today()],
    });
    const { input, plan } = setup(data, "00:30", NEXT);
    expect(input.date).toBe(DATE);
    expect(states(chainOf(input, plan, "bed"))).toEqual([
      "Esneme:done",
      "Akşam diş:done",
      "Yüz:next",
      "Krem:passed",
    ]);
    expect(chainLine(chainOf(input, plan, "bed")!, face.id)).toBe("Akşam dizisi 3/3 · son iş");
  });

  it("shows each work with the plan's minutes, whatever its state", () => {
    const { teeth, neck, data } = morning();
    const odd = { ...neck, est_minutes: 12 };
    const learned = rows({
      ...data,
      rhythms: [odd],
      stats: [{ key: "est_multiplier:bakim:task", value: 1.5, sample_size: 20 } as never],
    });
    const before = setup(learned, "07:02");
    const planned = chainOf(before.input, before.plan, "wake")!;
    const after = setup(
      {
        ...learned,
        tasks: [{ ...teeth, status: "done", done_at: iso("07:12") }, data.tasks[0]],
        rhythmLogs: [rhythmLog(odd.id, DATE)],
      },
      "07:20",
    );
    const finished = chainOf(after.input, after.plan, "wake")!;
    const minutes = (chain: typeof planned) =>
      chain.rows.filter((row) => row.id !== data.tasks[0].id).map((row) => row.minutes);
    expect(minutes(finished)).toEqual(minutes(planned));
  });

  it("is null without the frame and without anchored work", () => {
    const { data } = morning();
    const off = setup({ ...data, settings: settingsRow({ day_frame: null }) }, "07:02");
    expect(chainsOf(off.input, off.plan)).toEqual({ wake: null, bed: null });
    const none = setup(rows({ tasks: [task({ module_id: CARE.id })], days: [today()] }), "07:02");
    expect(chainsOf(none.input, none.plan)).toEqual({ wake: null, bed: null });
  });
});

describe("the next in the chain", () => {
  it("is the first work still to do after the current one; none after the last", () => {
    const { teeth, neck, shower, data } = morning();
    const { input, plan } = setup(data, "07:02");
    const chain = chainOf(input, plan, "wake")!;
    expect(nextInChain(chain, teeth.id)?.id).toBe(neck.id);
    expect(nextInChain(chain, neck.id)?.id).toBe(shower.id);
    expect(nextInChain(chain, shower.id)).toBeNull();
    expect(nextInChain(chain, "not-in-chain")).toBeNull();
    // What to start: the planner's candidate.
    expect(nextInChain(chain, teeth.id)?.target).toEqual({ type: "rhythm", id: neck.id });
  });

  it("skips what was done or passed", () => {
    const { teeth, neck, shower, data } = morning();
    const { input, plan } = setup({ ...data, rhythmLogs: [rhythmLog(neck.id, DATE)] }, "07:02");
    expect(nextInChain(chainOf(input, plan, "wake")!, teeth.id)?.id).toBe(shower.id);
  });
});

describe("the card's line", () => {
  it("says where the work stands in the chain and what comes next", () => {
    const { teeth, neck, shower, data } = morning();
    const { input, plan } = setup(data, "07:02");
    const chain = chainOf(input, plan, "wake")!;
    expect(chainLine(chain, teeth.id)).toBe("Sabah dizisi 1/3 · sırada Boyun");
    expect(chainLine(chain, neck.id)).toBe("Sabah dizisi 2/3 · sırada Duş ve hazırlık");
    expect(chainLine(chain, shower.id)).toBe("Sabah dizisi 3/3 · son iş");
    expect(chainLine(chain, "not-in-chain")).toBeNull();
  });

  it("does not count what was passed; the bed chain is the evening's", () => {
    const { teeth, neck, shower, data } = morning();
    const { input, plan } = setup(
      { ...data, days: [today({ plan: { version: 1, skipped: [neck.id] } })] },
      "07:02",
    );
    expect(chainLine(chainOf(input, plan, "wake")!, teeth.id)).toBe(
      "Sabah dizisi 1/2 · sırada Duş ve hazırlık",
    );
    expect(chainLine(chainOf(input, plan, "wake")!, shower.id)).toBe("Sabah dizisi 2/2 · son iş");
    const bed = anchored("bed", { title: "Yüz" });
    const night = setup(rows({ tasks: [bed], days: [today()] }), "23:00");
    expect(chainLine(chainOf(night.input, night.plan, "bed")!, bed.id)).toBe(
      "Akşam dizisi 1/1 · son iş",
    );
  });
});

describe("the planner", () => {
  it("is not changed by the chain: the same input gives the same plan", () => {
    const { teeth, data } = morning();
    const { input } = setup(
      { ...data, openSession: session({ task_id: teeth.id, module_id: CARE.id }) },
      "07:02",
    );
    const copy = structuredClone(input);
    const before = buildPlan(input);
    chainsOf(input, before);
    expect(input).toEqual(copy);
    expect(buildPlan(input)).toEqual(before);
  });
});

describe("the wake chain after a waking told from outside", () => {
  const startOn = settingsRow({
    day_frame: {
      wake: ["06:00", "09:00"],
      bed: ["22:00", "01:00"],
      sleep_minutes: 480,
      start_on_wake: true,
    },
  });

  it("starts the chain's first work when the app comes to the front", () => {
    const { teeth, data } = morning({ settings: startOn });
    const { input, plan } = setup(data, "07:05");
    expect(wakeChainStart(input, chainOf(input, plan, "wake"), at("07:05"))).toEqual({
      target: { type: "task", id: teeth.id },
      since: at("07:00"),
    });
  });

  it("does nothing with the setting off, an estimated or a later waking, or something running", () => {
    const { teeth, data } = morning();
    const off = setup(data, "07:05");
    expect(wakeChainStart(off.input, chainOf(off.input, off.plan, "wake"), at("07:05"))).toBeNull();
    const on = { ...data, settings: startOn };
    // Estimated from the first touch.
    const touched = setup({ ...on, days: [today({ woke_estimated: true })] }, "07:05");
    expect(
      wakeChainStart(touched.input, chainOf(touched.input, touched.plan, "wake"), at("07:05")),
    ).toBeNull();
    // Said on this screen after it came to the front ("Uyandım"): its own start.
    const said = setup(on, "07:05");
    expect(
      wakeChainStart(said.input, chainOf(said.input, said.plan, "wake"), at("06:59")),
    ).toBeNull();
    const busy = setup(
      { ...on, openSession: session({ title: "Başka iş", started_at: iso("07:03") }) },
      "07:05",
    );
    expect(
      wakeChainStart(busy.input, chainOf(busy.input, busy.plan, "wake"), at("07:05")),
    ).toBeNull();
    expect(teeth.id).toBeTruthy();
  });

  it("does nothing when the first work was put off before the app came to the front", () => {
    const { teeth, data } = morning({ settings: startOn });
    const putOff = { ...teeth, planned_date: NEXT, defer_count: 1, updated_at: iso("07:03") };
    const { input, plan } = setup({ ...data, tasks: [putOff, data.tasks[0]] }, "07:05");
    expect(wakeChainStart(input, chainOf(input, plan, "wake"), at("07:05"))).toBeNull();
  });

  it("does nothing once the chain has begun, or when it is no longer offered", () => {
    const { teeth, data } = morning({ settings: startOn });
    const begun = setup(
      { ...data, tasks: [{ ...teeth, status: "done", done_at: iso("07:04") }, data.tasks[0]] },
      "07:05",
    );
    expect(
      wakeChainStart(begun.input, chainOf(begun.input, begun.plan, "wake"), at("07:05")),
    ).toBeNull();
    // The line ends at 07:45; an hour later it is no longer offered.
    const late = setup(data, "08:46");
    expect(
      wakeChainStart(late.input, chainOf(late.input, late.plan, "wake"), at("08:46")),
    ).toBeNull();
    const inTime = setup(data, "08:44");
    expect(
      wakeChainStart(inTime.input, chainOf(inTime.input, inTime.plan, "wake"), at("08:44")),
    ).not.toBeNull();
  });
});
