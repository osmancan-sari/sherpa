import { describe, expect, it } from "vitest";
import { block, moduleRow, rhythm, task, workItem } from "@/core/testing/factories";
import { istanbulInstant, shiftDay } from "@/lib/date";
import { DEFAULT_SETTINGS } from "./slots";
import {
  commitWeek,
  cutSittings,
  type LoadInput,
  loadByWeek,
  recommitReason,
  sittingChanges,
  type WeekInput,
  appendable,
  missingSittings,
  weekAction,
} from "./week";

// The far horizons (docs/04-planlayici.md, "Plan ufukları", "Test kapsamı").

const MONDAY = "2026-11-16";
const at = (day: string, time = "08:00") => istanbulInstant(day, time);
const due = (day: string) => istanbulInstant(day, "23:59").toISOString();

function load(overrides: Partial<LoadInput> = {}): LoadInput {
  return {
    now: at(MONDAY),
    items: [],
    tasks: [],
    rhythms: [],
    modules: [moduleRow()],
    blocks: [],
    settings: DEFAULT_SETTINGS,
    stats: [],
    lifeMode: "normal",
    ...overrides,
  };
}
const week = (overrides: Partial<WeekInput> = {}): WeekInput => ({
  ...load(overrides),
  weekStart: MONDAY,
  ...overrides,
});

/** A block that fills the working hours of a day. */
const fullDay = (day: string) =>
  block({ starts_at: at(day, "08:00").toISOString(), ends_at: at(day, "19:00").toISOString() });

describe("loadByWeek", () => {
  it("spreads an item's remaining effort over the weeks up to its deadline, by capacity", () => {
    const item = workItem({
      effort_total_minutes: 900,
      effort_done_minutes: 0,
      due_at: due(shiftDay(MONDAY, 18)),
    });
    // The second week loses three of its days to blocks.
    const blocks = [1, 2, 3].map((n) => fullDay(shiftDay(MONDAY, 7 + n)));
    const weeks = loadByWeek(load({ items: [item], blocks }), { from: MONDAY, weeks: 4 });
    const share = weeks.map((row) => row.byModule[item.module_id] ?? 0);
    expect(share[0] + share[1] + share[2]).toBeGreaterThanOrEqual(899);
    expect(share[0] + share[1] + share[2]).toBeLessThanOrEqual(901);
    expect(share[1]).toBeLessThan(share[0]);
    expect(share[3]).toBe(0);
  });

  it("counts what is already done", () => {
    const item = workItem({
      effort_total_minutes: 300,
      effort_done_minutes: 200,
      due_at: due(shiftDay(MONDAY, 4)),
    });
    const [first] = loadByWeek(load({ items: [item] }), { from: MONDAY, weeks: 1 });
    expect(first.demandMinutes).toBe(100);
  });

  it("marks a week whose demand is over its capacity, with its deadlines", () => {
    const heavy = workItem({
      title: "Tez",
      effort_total_minutes: 4000,
      due_at: due(shiftDay(MONDAY, 4)),
      importance: 4,
    });
    const light = workItem({
      title: "Ödev",
      effort_total_minutes: 60,
      due_at: due(shiftDay(MONDAY, 2)),
    });
    const [first, second] = loadByWeek(load({ items: [heavy, light] }), { from: MONDAY, weeks: 2 });
    expect(first.over).toBe(true);
    expect(first.deadlines.map((row) => row.title)).toEqual(["Tez", "Ödev"]);
    expect(second.over).toBe(false);
  });

  it("adds rhythms and floors as each week's fixed demand", () => {
    const mod = moduleRow({ kind: "lifelong", weekly_floor_minutes: 120 });
    const walk = rhythm({ module_id: mod.id, target_count: 3, est_minutes: 30, period: "week" });
    const weeks = loadByWeek(load({ modules: [mod], rhythms: [walk] }), { from: MONDAY, weeks: 2 });
    // The floor (120) is more than the rhythm (90): the floor counts.
    expect(weeks.map((row) => row.demandMinutes)).toEqual([120, 120]);
  });

  it("leaves undated items out of the weekly load", () => {
    const item = workItem({ effort_total_minutes: 600, due_at: null });
    expect(
      loadByWeek(load({ items: [item] }), { from: MONDAY, weeks: 2 }).map(
        (row) => row.demandMinutes,
      ),
    ).toEqual([0, 0]);
  });
});

describe("commitWeek", () => {
  it("cuts only this week's share of a far item into sittings", () => {
    const far = workItem({
      title: "Dönem projesi",
      effort_total_minutes: 900,
      session_minutes: 45,
      due_at: due(shiftDay(MONDAY, 41)),
    });
    const plan = commitWeek(week({ items: [far] }));
    const [row] = plan.committed;
    expect(row.itemId).toBe(far.id);
    expect(row.minutes).toBeLessThan(300);
    expect(row.minutes).toBeGreaterThan(0);
    expect(row.sittings.reduce((sum, minutes) => sum + minutes, 0)).toBeGreaterThanOrEqual(
      row.minutes,
    );
    expect(row.sittings.every((minutes) => minutes <= 90)).toBe(true);
  });

  it("does not split an item whose week has not come; when it comes, only that week's effort", () => {
    const later = workItem({
      title: "Gelecek hafta başlar",
      effort_total_minutes: 600,
      earliest_at: at(shiftDay(MONDAY, 7), "00:00").toISOString(),
      due_at: due(shiftDay(MONDAY, 27)),
    });
    expect(commitWeek(week({ items: [later] })).committed).toEqual([]);
    const next = shiftDay(MONDAY, 7);
    const plan = commitWeek({ ...week({ items: [later] }), now: at(next), weekStart: next });
    expect(plan.committed).toHaveLength(1);
    expect(plan.committed[0].minutes).toBeLessThan(600);
  });

  it("does not commit an item while what it depends on is open", () => {
    const first = workItem({ title: "Önce" });
    const second = workItem({ title: "Sonra", depends_on: [first.id], depends_on_keys: [] });
    expect(commitWeek(week({ items: [first, second] })).committed.map((row) => row.itemId)).toEqual(
      [first.id],
    );
    const done = { ...first, status: "done" as const };
    expect(commitWeek(week({ items: [done, second] })).committed.map((row) => row.itemId)).toEqual([
      second.id,
    ]);
  });

  it("always commits what is due this week, even over capacity", () => {
    const due1 = workItem({ effort_total_minutes: 5000, due_at: due(shiftDay(MONDAY, 3)) });
    const plan = commitWeek(week({ items: [due1] }));
    expect(plan.committed).toMatchObject([{ itemId: due1.id, minutes: 5000, required: true }]);
  });

  it("chooses by urgency and importance until the capacity is used up", () => {
    const blocks = [0, 1, 2, 3, 4, 5].map((n) => fullDay(shiftDay(MONDAY, n)));
    // Only Sunday is free: 660 minutes of slots × 0.7.
    const urgent = workItem({
      title: "Acil",
      effort_total_minutes: 300,
      due_at: due(shiftDay(MONDAY, 9)),
    });
    const big = workItem({
      title: "Büyük",
      effort_total_minutes: 6000,
      due_at: due(shiftDay(MONDAY, 13)),
    });
    const undated = workItem({ title: "Tarihsiz", effort_total_minutes: 600 });
    const plan = commitWeek(week({ items: [undated, big, urgent], blocks }));
    expect(plan.committed[0].itemId).toBe(urgent.id);
    const total = plan.committed.reduce((sum, row) => sum + row.minutes, 0);
    expect(total).toBeLessThanOrEqual(plan.capacityMinutes);
    expect(plan.left.length).toBeGreaterThan(0);
  });

  it("follows the AI's choice within the rules: no drop of required work, no open dependency", () => {
    const required = workItem({
      title: "Zorunlu",
      effort_total_minutes: 120,
      due_at: due(shiftDay(MONDAY, 2)),
    });
    const a = workItem({ title: "A", effort_total_minutes: 90 });
    const b = workItem({ title: "B", effort_total_minutes: 90 });
    const blocked = workItem({ title: "Bağlı", depends_on: [a.id] });
    const plan = commitWeek(week({ items: [required, a, b, blocked] }), {
      committed: [b.id, blocked.id],
      drop: [required.id, a.id],
      reasons: { [b.id]: "Bu hafta B öne çıkıyor." },
    });
    expect(plan.committed.map((row) => row.itemId)).toEqual([required.id, b.id]);
    expect(plan.source).toBe("ai");
    expect(plan.reasons[b.id]).toBe("Bu hafta B öne çıkıyor.");
  });

  it("gives each module its budget: committed shares plus rhythms and floors", () => {
    const mod = moduleRow({ slug: "okul", kind: "term" });
    const item = workItem({
      module_id: mod.id,
      effort_total_minutes: 120,
      due_at: due(shiftDay(MONDAY, 3)),
    });
    const walk = rhythm({ module_id: mod.id, target_count: 2, est_minutes: 30 });
    const plan = commitWeek(week({ modules: [mod], items: [item], rhythms: [walk] }));
    expect(plan.moduleBudgets).toEqual({ okul: 180 });
  });
});

describe("sittings", () => {
  it("cuts a share into sittings of the item's length, the last one shorter", () => {
    expect(cutSittings(200, 60)).toEqual([60, 60, 60, 20]);
    expect(cutSittings(100, null)).toEqual([45, 45, 15]);
    expect(cutSittings(180, 120)).toEqual([90, 90]);
  });

  it("opens the missing sittings and drops the ones the week no longer needs", () => {
    const item = workItem();
    const gone = workItem();
    const tasks = [
      task({ work_item_id: item.id, status: "doing", position: 1 }),
      task({ work_item_id: item.id, status: "todo", position: 2 }),
      task({ work_item_id: gone.id, status: "todo" }),
      task({ work_item_id: gone.id, status: "doing" }),
    ];
    const changes = sittingChanges(
      {
        committed: [
          { itemId: item.id, minutes: 180, sittings: [45, 45, 45, 45], required: false, from: 0 },
        ],
      },
      tasks,
    );
    expect(changes.drop).toEqual([tasks[2].id]);
    expect(changes.create).toEqual([
      { itemId: item.id, minutes: 45, position: 3 },
      { itemId: item.id, minutes: 45, position: 4 },
    ]);
  });

  it("drops open sittings beyond the new share, never a running one", () => {
    const item = workItem();
    const tasks = [1, 2, 3].map((position) =>
      task({ work_item_id: item.id, status: "todo", position }),
    );
    const changes = sittingChanges(
      { committed: [{ itemId: item.id, minutes: 45, sittings: [45], required: false, from: 0 }] },
      tasks,
    );
    expect(changes).toEqual({ create: [], drop: [tasks[1].id, tasks[2].id] });
  });
});

describe("plan stability", () => {
  const item = workItem({ effort_total_minutes: 300, due_at: due(shiftDay(MONDAY, 20)) });
  const input = week({ items: [item] });
  const plan = commitWeek(input);
  const stored = {
    committed: plan.committed.map((row) => row.itemId),
    capacityMinutes: plan.capacityMinutes,
    capacityByDay: plan.capacityByDay,
    lifeMode: plan.lifeMode,
  };

  it("does not change in the week without a trigger", () => {
    const wednesday = shiftDay(MONDAY, 2);
    const undated = workItem({ title: "Tarihsiz yeni" });
    const nextWeek = workItem({ title: "Gelecek hafta teslim", due_at: due(shiftDay(MONDAY, 10)) });
    const doneSitting = task({ work_item_id: item.id, status: "done" });
    expect(
      recommitReason(stored, {
        ...input,
        now: at(wednesday, "15:00"),
        items: [{ ...item, effort_done_minutes: 45 }, undated, nextWeek],
        tasks: [doneSitting],
      }),
    ).toBeNull();
  });

  it("re-commits for new required work, lost capacity or a new life mode", () => {
    const urgent = workItem({ title: "Yarın teslim", due_at: due(shiftDay(MONDAY, 1)) });
    expect(recommitReason(stored, { ...input, items: [item, urgent] })).toBe("new_required");
    const blocks = [fullDay(shiftDay(MONDAY, 3))];
    expect(recommitReason(stored, { ...input, blocks })).toBe("capacity_lost");
    expect(recommitReason(stored, { ...input, lifeMode: "busy" })).toBe("mode_changed");
  });

  it("sees capacity lost after a commitment made in the middle of the week", () => {
    const wednesday = shiftDay(MONDAY, 2);
    const midweek = { ...input, now: at(wednesday) };
    const made = commitWeek(midweek);
    const kept = {
      committed: made.committed.map((row) => row.itemId),
      capacityMinutes: made.capacityMinutes,
      capacityByDay: made.capacityByDay,
      lifeMode: made.lifeMode,
    };
    // Friday afternoon, nothing new: the hours gone by are not a loss.
    expect(recommitReason(kept, { ...midweek, now: at(shiftDay(MONDAY, 4), "15:00") })).toBeNull();
    // Thursday filled by a block: lost.
    const thursday = [fullDay(shiftDay(MONDAY, 3))];
    expect(recommitReason(kept, { ...midweek, blocks: thursday })).toBe("capacity_lost");
  });
});

describe("new items in the week", () => {
  const old = workItem({
    title: "Eski",
    effort_total_minutes: 120,
    created_at: at(MONDAY, "07:00").toISOString(),
  });
  const input = week({ items: [old] });
  const plan = commitWeek(input);
  const stored = {
    committed: plan.committed.map((row) => row.itemId),
    capacityMinutes: plan.capacityMinutes,
    capacityByDay: plan.capacityByDay,
    lifeMode: plan.lifeMode,
    shares: Object.fromEntries(
      plan.committed.map((row) => [row.itemId, { minutes: row.minutes, from: row.from }]),
    ),
    committedAt: at(MONDAY, "08:00").toISOString(),
  };
  const later = at(shiftDay(MONDAY, 2), "10:00");

  it("join the commitment when the week has room; what was committed stays as it was", () => {
    const fresh = workItem({
      title: "Yeni",
      key: "m:1",
      effort_total_minutes: 90,
      created_at: later.toISOString(),
    });
    const action = weekAction(stored, { ...input, now: later, items: [old, fresh] });
    expect(action).toEqual({ kind: "append", items: [fresh.id] });
    const [added] = appendable(stored, { ...input, now: later, items: [old, fresh] });
    expect(added).toMatchObject({ itemId: fresh.id, required: false });
    expect(added.sittings.length).toBeGreaterThan(0);
  });

  it("an item from a module waits when the week is full; one the user added joins anyway", () => {
    const full = { ...stored, shares: { [old.id]: { minutes: 100_000, from: 0 } } };
    const fromModule = workItem({
      key: "m:2",
      effort_total_minutes: 90,
      created_at: later.toISOString(),
    });
    const byHand = workItem({
      key: null,
      effort_total_minutes: 90,
      created_at: later.toISOString(),
    });
    const added = appendable(full, { ...input, now: later, items: [old, fromModule, byHand] });
    expect(added.map((row) => row.itemId)).toEqual([byHand.id]);
  });

  it("leaves the week alone when nothing is new", () => {
    // (The committed item has its sitting: otherwise the week would repair it.)
    const sitting = task({ work_item_id: old.id, status: "todo" });
    expect(weekAction(stored, { ...input, now: later, tasks: [sitting] })).toBeNull();
    expect(weekAction(null, input)).toEqual({ kind: "commit", reason: "none" });
  });
});

describe("the AI's module hours", () => {
  it("stand, but never below what a module's rhythms and floor need", () => {
    const school = moduleRow({ slug: "okul", kind: "term" });
    const sport = moduleRow({
      id: "33333333-3333-4333-8333-333333333333",
      slug: "spor",
      kind: "lifelong",
      weekly_floor_minutes: 120,
    });
    const plan = commitWeek(week({ modules: [school, sport] }), {
      moduleBudgets: { okul: 600, spor: 30, yok: 90 },
    });
    expect(plan.moduleBudgets).toEqual({ okul: 600, spor: 120 });
  });
});

describe("a committed item without its sittings", () => {
  const item = workItem({
    title: "Yarım kalan",
    effort_total_minutes: 180,
    effort_done_minutes: 45,
    session_minutes: 45,
  });
  const stored = {
    committed: [item.id],
    capacityMinutes: 1000,
    capacityByDay: {},
    lifeMode: "normal" as const,
    shares: { [item.id]: { minutes: 135, from: 0 } },
    committedAt: at(MONDAY, "08:00").toISOString(),
  };

  it("gets the rest of its share cut into sittings again", () => {
    const action = weekAction(stored, week({ items: [item] }));
    expect(action).toEqual({ kind: "repair", items: [item.id] });
    // 135 of the week, 45 done since the commitment: 90 left, two sittings.
    expect(missingSittings(stored, week({ items: [item] }))[0].sittings).toEqual([45, 45]);
  });

  it("is left alone with an open sitting, a worked share, or while it waits", () => {
    const open = task({ work_item_id: item.id, status: "todo" });
    expect(missingSittings(stored, week({ items: [item], tasks: [open] }))).toEqual([]);
    const worked = { ...item, effort_done_minutes: 135 };
    expect(missingSittings(stored, week({ items: [worked] }))).toEqual([]);
    const waiting = { ...item, status: "waiting" as const };
    expect(missingSittings(stored, week({ items: [waiting] }))).toEqual([]);
  });
});
