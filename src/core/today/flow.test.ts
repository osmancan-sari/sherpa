import { describe, expect, it } from "vitest";
import { buildPlan, type PlanRows, planInput } from "@/core/planner";
import { block, dayRow, moduleRow, session, settingsRow, task } from "@/core/testing/factories";
import { istanbulInstant } from "@/lib/date";
import { breakText, closedUpNext, dayFlowOf, upNextOf } from "./flow";

// Today's day flow and "Sıradakiler" (docs/tasarim/ekranlar/bugun.md, 4.2; Ç4c). Pure.

const DATE = "2026-11-12"; // a Thursday
const at = (time: string) => istanbulInstant(DATE, time);
const iso = (time: string) => at(time).toISOString();

const SCHOOL = moduleRow({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  slug: "okul",
  name: "Okul",
});

function rows(overrides: Partial<PlanRows> = {}): PlanRows {
  return {
    settings: settingsRow(),
    modules: [SCHOOL],
    tasks: [],
    workItems: [],
    rhythms: [],
    rhythmLogs: [],
    blocks: [],
    sessions: [],
    openSession: null,
    prompts: [],
    inbox: [],
    days: [dayRow({ date: DATE, woke_at: iso("07:02") })],
    weekPlans: [],
    stats: [],
    ...overrides,
  };
}

function setup(data: PlanRows, time: string) {
  const input = planInput(data, { date: DATE, now: at(time), context: "desk" });
  return { input, plan: buildPlan(input) };
}

const work = (title: string, minutes: number, extra = {}) =>
  task({ module_id: SCHOOL.id, title, est_minutes: minutes, energy: "light", ...extra });

describe("dayFlowOf", () => {
  it("runs from the waking to the expected bedtime, with the day's parts", () => {
    const { input, plan } = setup(rows({ tasks: [work("Ödev", 60)] }), "10:00");
    const flow = dayFlowOf(input, plan, []);
    expect(flow.from.getTime()).toBe(at("07:02").getTime());
    expect(flow.wake?.getTime()).toBe(at("07:02").getTime());
    expect(flow.to.getTime()).toBe(plan.frame!.bed.getTime());
    expect(flow.pieces.some((piece) => piece.label === "Ödev" && piece.kind === "work")).toBe(true);
  });

  it("draws the done sessions of the day and the running one up to now", () => {
    const done = work("Okuma", 30, { status: "done" });
    const { input, plan } = setup(
      rows({
        tasks: [done],
        sessions: [
          session({
            task_id: done.id,
            module_id: SCHOOL.id,
            started_at: iso("08:00"),
            ended_at: iso("08:30"),
          }),
          // Yesterday's session is not today's.
          session({
            task_id: done.id,
            module_id: SCHOOL.id,
            started_at: istanbulInstant("2026-11-11", "15:00").toISOString(),
            ended_at: istanbulInstant("2026-11-11", "15:30").toISOString(),
          }),
        ],
      }),
      "10:00",
    );
    // Without sessions there is nothing done to draw.
    expect(dayFlowOf(input, plan, []).pieces).toEqual([]);
    const withSessions = dayFlowOf(input, plan, [
      session({
        task_id: done.id,
        module_id: SCHOOL.id,
        started_at: iso("08:00"),
        ended_at: iso("08:30"),
      }),
      session({ title: "Plansız", started_at: iso("09:30"), ended_at: null }),
    ]);
    const sessionPieces = withSessions.pieces.filter((piece) => piece.key.startsWith("session"));
    expect(sessionPieces.map((piece) => piece.label)).toEqual(["Okuma", "Plansız"]);
    expect(sessionPieces[0].work.task?.id).toBe(done.id);
    expect(sessionPieces[1].end.getTime()).toBe(at("10:00").getTime());
  });

  it("hatches the travel around work and lays the fixed blocks over the strip", () => {
    const trip = work("Kütüphane", 60, {
      context: "out",
      timing: { place: "Kütüphane", travelBefore: 20, travelAfter: 15 },
    });
    const lecture = block({
      title: "Ders",
      starts_at: iso("13:00"),
      ends_at: iso("14:00"),
    });
    const { input, plan } = setup(rows({ tasks: [trip], blocks: [lecture] }), "09:00");
    const flow = dayFlowOf(input, plan, []);
    const blockPiece = flow.pieces.find((piece) => piece.kind === "block");
    expect(blockPiece?.label).toBe("Ders");
    const travel = flow.pieces.filter((piece) => piece.kind === "travel");
    if (plan.slots.some((slot) => slot.assignment?.travelBefore)) {
      expect(travel.map((piece) => piece.label)).toContain("yol 20 dk");
    }
    // In time order.
    const times = flow.pieces.map((piece) => piece.start.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("has no waking and no parts without the day's frame", () => {
    const { input, plan } = setup(
      rows({ settings: settingsRow({ day_frame: null }), days: [] }),
      "10:00",
    );
    const flow = dayFlowOf(input, plan, []);
    expect(flow.wake).toBeNull();
    expect(flow.parts).toEqual([]);
    expect(flow.to.getTime()).toBe(input.bedtime.getTime());
  });
});

describe("upNextOf", () => {
  it("is the day's rest in time order without the card's work; blocks to come are in it", () => {
    const first = work("Birinci", 30, { importance: 3 });
    const second = work("İkinci", 30);
    const third = work("Üçüncü", 30);
    const later = block({ title: "Diş hekimi", starts_at: iso("18:30"), ends_at: iso("19:15") });
    const gone = block({ title: "Sabah dersi", starts_at: iso("08:00"), ends_at: iso("09:00") });
    const { input, plan } = setup(
      rows({ tasks: [first, second, third], blocks: [later, gone] }),
      "10:00",
    );
    const currentId = plan.now.kind === "suggest" ? plan.now.assignment.candidate.id : null;
    const list = upNextOf(input, plan, currentId);
    const titles = list.map((row) =>
      row.kind === "work"
        ? row.assignment.candidate.title
        : row.kind === "block"
          ? row.block.title
          : breakText(row.minutes),
    );
    expect(titles).toContain("Diş hekimi");
    expect(titles).not.toContain("Sabah dersi");
    expect(
      list.some((row) => row.kind === "work" && row.assignment.candidate.id === currentId),
    ).toBe(false);
    const times = list.map((row) => row.start.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    // Closed: only work rows, at most the count.
    const closed = closedUpNext(list, 2);
    expect(closed.length).toBeLessThanOrEqual(2);
    expect(closed.every((row) => row.kind === "work")).toBe(true);
  });

  it("keeps a break only between two pieces of work", () => {
    const tasks = Array.from({ length: 6 }, (_, index) => work(`İş ${index + 1}`, 90));
    const { input, plan } = setup(rows({ tasks }), "09:00");
    const list = upNextOf(input, plan, null);
    list.forEach((row, index) => {
      if (row.kind !== "break") return;
      expect(list.slice(0, index).some((other) => other.kind === "work")).toBe(true);
      expect(list.slice(index + 1).some((other) => other.kind === "work")).toBe(true);
    });
    expect(list[0]?.kind).not.toBe("break");
    expect(list[list.length - 1]?.kind).not.toBe("break");
  });

  it("is empty when nothing is left", () => {
    const { input, plan } = setup(rows(), "10:00");
    expect(upNextOf(input, plan, null)).toEqual([]);
  });
});

describe("breakText", () => {
  it("says the break's minutes", () => {
    expect(breakText(15)).toBe("mola · 15 dk");
  });
});
