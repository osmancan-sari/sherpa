import { describe, expect, it } from "vitest";
import {
  block,
  MODULE_ID,
  rhythm,
  rhythmLog,
  session,
  task,
  workItem,
} from "@/core/testing/factories";
import {
  blocksOfDay,
  currentBlock,
  elapsedMinutes,
  isBlocked,
  nowState,
  periodStart,
  rhythmProgress,
  todayCandidates,
  type TodayInput,
} from "./select";

// Thursday 12 November 2026, 10:40 in Istanbul.
const NOW = new Date("2026-11-12T10:40:00+03:00");
const ACTIVE = new Set([MODULE_ID]);

function input(overrides: Partial<TodayInput>): TodayInput {
  return {
    tasks: [],
    workItems: [],
    rhythms: [],
    rhythmLogs: [],
    activeModuleIds: ACTIVE,
    now: NOW,
    ...overrides,
  };
}

describe("todayCandidates", () => {
  it("orders by deadline, then importance, then age; no deadline goes last", () => {
    const tasks = [
      task({ title: "tarihsiz önemli", importance: 4 }),
      task({ title: "cuma", due_at: "2026-11-13T20:59:00Z" }),
      task({ title: "bugün düşük", due_at: "2026-11-12T20:59:00Z", importance: 1 }),
      task({ title: "bugün yüksek", due_at: "2026-11-12T20:59:00Z", importance: 3 }),
      task({ title: "tarihsiz eski", created_at: "2026-11-01T09:00:00Z" }),
      task({ title: "tarihsiz yeni", created_at: "2026-11-09T09:00:00Z" }),
    ];
    expect(todayCandidates(input({ tasks })).map((c) => c.title)).toEqual([
      "bugün yüksek",
      "bugün düşük",
      "cuma",
      "tarihsiz önemli",
      "tarihsiz eski",
      "tarihsiz yeni",
    ]);
  });

  it("leaves out finished, dropped and waiting tasks, and tasks planned for a later day", () => {
    const tasks = [
      task({ title: "açık" }),
      task({ title: "sürüyor", status: "doing" }),
      task({ title: "bitti", status: "done" }),
      task({ title: "bırakıldı", status: "dropped" }),
      task({ title: "bekliyor", status: "waiting" }),
      task({ title: "yarına", planned_date: "2026-11-13" }),
      task({ title: "bugüne", planned_date: "2026-11-12" }),
      task({ title: "dünden kalan", planned_date: "2026-11-11" }),
    ];
    expect(
      todayCandidates(input({ tasks }))
        .map((c) => c.title)
        .sort(),
    ).toEqual(["açık", "bugüne", "dünden kalan", "sürüyor"]);
  });

  it("leaves out work of modules that are not active", () => {
    const other = "33333333-3333-4333-8333-333333333333";
    const candidates = todayCandidates(
      input({
        tasks: [task({ title: "etkin" }), task({ title: "duraklatılmış", module_id: other })],
        workItems: [workItem({ title: "kalem", module_id: other })],
        rhythms: [rhythm({ title: "ritim", module_id: other })],
      }),
    );
    expect(candidates.map((c) => c.title)).toEqual(["etkin"]);
  });

  it("offers an active work item as its next sitting, unless a sitting is already open", () => {
    const free = workItem({
      title: "hazırlık",
      effort_total_minutes: 300,
      session_minutes: 60,
      due_at: "2026-11-20T10:00:00+03:00",
    });
    const sitting = workItem({ title: "rapor", effort_total_minutes: 120 });
    const candidates = todayCandidates(
      input({
        workItems: [
          free,
          sitting,
          workItem({ title: "önerilen", status: "proposed" }),
          workItem({ title: "biten", status: "done" }),
          workItem({ title: "erken", earliest_at: "2026-11-20T09:00:00+03:00" }),
        ],
        tasks: [task({ title: "rapor: oturum", work_item_id: sitting.id })],
      }),
    );
    expect(candidates.map((c) => [c.type, c.title, c.minutes])).toEqual([
      ["item", "hazırlık", 60],
      ["task", "rapor: oturum", 30],
    ]);
  });

  it("holds back a work item until what it depends on is finished", () => {
    const first = workItem({ title: "konu çalış", key: "a" });
    const second = workItem({
      title: "soru çöz",
      key: "b",
      depends_on: [first.id],
      depends_on_keys: ["a"],
    });
    const unresolved = workItem({ title: "henüz yok", depends_on_keys: ["c"] });

    expect(isBlocked(second, [first, second])).toBe(true);
    expect(isBlocked(unresolved, [unresolved])).toBe(true);
    expect(isBlocked(second, [{ ...first, status: "done" }, second])).toBe(false);
    // A dropped dependency holds nothing back, and neither does one that is no longer loaded.
    expect(isBlocked(second, [{ ...first, status: "dropped" }, second])).toBe(false);
    expect(isBlocked(second, [second])).toBe(false);

    const open = todayCandidates(input({ workItems: [first, second, unresolved] }));
    expect(open.map((c) => c.title)).toEqual(["konu çalış"]);
    const after = todayCandidates(input({ workItems: [{ ...first, status: "done" }, second] }));
    expect(after.map((c) => c.title)).toEqual(["soru çöz"]);
  });

  it("offers a rhythm while it has debt in its period, once a day", () => {
    const weekly = rhythm({ title: "süpürme", target_count: 2, period: "week" });
    const none = todayCandidates(input({ rhythms: [weekly] }));
    expect(none[0]).toMatchObject({
      type: "rhythm",
      title: "süpürme",
      progress: "0/2",
      minutes: 15,
    });

    // Done once earlier this week: still one to go.
    const once = todayCandidates(
      input({ rhythms: [weekly], rhythmLogs: [rhythmLog(weekly.id, "2026-11-10")] }),
    );
    expect(once[0].progress).toBe("1/2");

    // Done today already: not offered again today even though one is left.
    const today = todayCandidates(
      input({ rhythms: [weekly], rhythmLogs: [rhythmLog(weekly.id, "2026-11-12")] }),
    );
    expect(today).toEqual([]);

    const full = todayCandidates(
      input({
        rhythms: [weekly],
        rhythmLogs: [rhythmLog(weekly.id, "2026-11-09"), rhythmLog(weekly.id, "2026-11-10")],
      }),
    );
    expect(full).toEqual([]);
    expect(todayCandidates(input({ rhythms: [{ ...weekly, active: false }] }))).toEqual([]);
  });
});

describe("rhythmProgress", () => {
  it("counts only the current period: debt does not carry over", () => {
    const weekly = rhythm({ target_count: 2, period: "week" });
    const logs = [
      // Last week: three times. None of it counts now.
      rhythmLog(weekly.id, "2026-11-02"),
      rhythmLog(weekly.id, "2026-11-04"),
      rhythmLog(weekly.id, "2026-11-08"),
      // This week (Monday 9 November onwards).
      rhythmLog(weekly.id, "2026-11-09"),
    ];
    expect(rhythmProgress(weekly, logs, NOW)).toMatchObject({ done: 1, target: 2, debt: 1 });

    const daily = rhythm({ target_count: 1, period: "day" });
    expect(rhythmProgress(daily, [rhythmLog(daily.id, "2026-11-11")], NOW).debt).toBe(1);
    expect(rhythmProgress(daily, [rhythmLog(daily.id, "2026-11-12")], NOW).debt).toBe(0);

    const monthly = rhythm({ target_count: 1, period: "month" });
    expect(rhythmProgress(monthly, [rhythmLog(monthly.id, "2026-10-31")], NOW).debt).toBe(1);
    expect(rhythmProgress(monthly, [rhythmLog(monthly.id, "2026-11-01")], NOW).debt).toBe(0);
  });

  it("never reports negative debt, and ignores other rhythms' logs", () => {
    const weekly = rhythm({ target_count: 1, period: "week" });
    const other = rhythm();
    const logs = [
      rhythmLog(weekly.id, "2026-11-09"),
      rhythmLog(weekly.id, "2026-11-10"),
      rhythmLog(other.id, "2026-11-11"),
    ];
    expect(rhythmProgress(weekly, logs, NOW)).toMatchObject({ done: 2, debt: 0 });
  });

  it("starts the week on Monday and the month on the first, in Istanbul time", () => {
    expect(periodStart("week", "2026-11-12")).toBe("2026-11-09");
    expect(periodStart("week", "2026-11-15")).toBe("2026-11-09");
    expect(periodStart("week", "2026-11-16")).toBe("2026-11-16");
    expect(periodStart("month", "2026-11-12")).toBe("2026-11-01");
    expect(periodStart("day", "2026-11-12")).toBe("2026-11-12");
  });
});

describe("blocks", () => {
  const morning = block({
    title: "Ders",
    starts_at: "2026-11-12T10:00:00+03:00",
    ends_at: "2026-11-12T11:00:00+03:00",
  });
  const evening = block({
    title: "Randevu",
    starts_at: "2026-11-12T18:00:00+03:00",
    ends_at: "2026-11-12T19:00:00+03:00",
  });
  // 00:30 on Friday in Istanbul is still Thursday in UTC: it belongs to Friday.
  const lateNight = block({
    title: "Gece",
    starts_at: "2026-11-12T21:30:00Z",
    ends_at: "2026-11-12T22:30:00Z",
  });
  const cancelled = block({ ...morning, id: "x", title: "İptal", status: "cancelled" });

  it("lists the day's blocks in order, by the Istanbul calendar day, without cancelled ones", () => {
    const all = [evening, cancelled, lateNight, morning];
    expect(blocksOfDay(all, "2026-11-12").map((b) => b.title)).toEqual(["Ders", "Randevu"]);
    expect(blocksOfDay(all, "2026-11-13").map((b) => b.title)).toEqual(["Gece"]);
  });

  it("finds the block that is running now", () => {
    expect(currentBlock([evening, morning], NOW)?.title).toBe("Ders");
    expect(currentBlock([evening, cancelled], NOW)).toBeNull();
    // The end is exclusive: at 11:00 the block is over.
    expect(currentBlock([morning], new Date("2026-11-12T11:00:00+03:00"))).toBeNull();
    expect(currentBlock([morning], new Date("2026-11-12T10:00:00+03:00"))?.title).toBe("Ders");
  });
});

describe("nowState", () => {
  const todo = task({ title: "HW2" });
  const candidates = todayCandidates(input({ tasks: [todo] }));
  const running = block({
    starts_at: "2026-11-12T10:00:00+03:00",
    ends_at: "2026-11-12T11:00:00+03:00",
  });

  it("shows the running session above everything else", () => {
    const open = session({ task_id: todo.id });
    const state = nowState({
      openSession: open,
      tasks: [todo],
      rhythms: [],
      blocks: [running],
      candidates,
      now: NOW,
    });
    expect(state).toMatchObject({ kind: "running", task: { title: "HW2" } });
  });

  it("shows unplanned work as a running session without a task", () => {
    const state = nowState({
      openSession: session({ title: "Telefon" }),
      tasks: [todo],
      rhythms: [],
      blocks: [],
      candidates,
      now: NOW,
    });
    expect(state).toMatchObject({ kind: "running", task: null, session: { title: "Telefon" } });
  });

  it("shows the fixed block while it runs, then the first thing in the list, then nothing", () => {
    const base = { openSession: null, tasks: [todo], rhythms: [], now: NOW };
    expect(nowState({ ...base, blocks: [running], candidates }).kind).toBe("block");
    expect(nowState({ ...base, blocks: [], candidates })).toMatchObject({
      kind: "suggest",
      candidate: { title: "HW2" },
    });
    expect(nowState({ ...base, blocks: [], candidates: [] }).kind).toBe("empty");
  });
});

describe("elapsedMinutes", () => {
  it("counts whole minutes from the server's start time", () => {
    expect(elapsedMinutes("2026-11-12T10:15:00+03:00", NOW)).toBe(25);
    expect(elapsedMinutes("2026-11-12T10:39:30+03:00", NOW)).toBe(0);
    // A device clock slightly behind the server never shows a negative time.
    expect(elapsedMinutes("2026-11-12T10:41:00+03:00", NOW)).toBe(0);
  });
});
