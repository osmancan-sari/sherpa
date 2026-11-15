import { describe, expect, it } from "vitest";
import { buildPlan, type Plan, type PlanRows, planInput, type Slot } from "@/core/planner";
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

/** The planner's own plan with its slots replaced: the cases are written out, not hoped for. */
function withSlots(plan: Plan, slots: Slot[]): Plan {
  return { ...plan, slots };
}

describe("dayFlowOf", () => {
  it("runs from the waking to the expected bedtime, with the day's parts", () => {
    const { input, plan } = setup(rows({ tasks: [work("Ödev", 60)] }), "10:00");
    const flow = dayFlowOf(input, plan, []);
    expect(flow.from.getTime()).toBe(at("07:02").getTime());
    expect(flow.wake?.getTime()).toBe(at("07:02").getTime());
    expect(flow.to.getTime()).toBe(plan.frame!.bed.getTime());
    expect(flow.pieces.some((piece) => piece.label === "Ödev" && piece.kind === "work")).toBe(true);
  });

  it("draws the day's sessions, the running one up to now; another day's are left out", () => {
    const done = work("Okuma", 30, { status: "done" });
    const { input, plan } = setup(rows({ tasks: [done] }), "10:00");
    expect(dayFlowOf(input, plan, []).pieces).toEqual([]);
    const flow = dayFlowOf(input, plan, [
      session({
        task_id: done.id,
        module_id: SCHOOL.id,
        started_at: iso("08:00"),
        ended_at: iso("08:30"),
      }),
      session({ title: "Plansız", started_at: iso("09:30"), ended_at: null }),
      session({
        task_id: done.id,
        module_id: SCHOOL.id,
        started_at: istanbulInstant("2026-11-11", "15:00").toISOString(),
        ended_at: istanbulInstant("2026-11-11", "15:30").toISOString(),
      }),
    ]);
    const pieces = flow.pieces.filter((piece) => piece.key.startsWith("session"));
    expect(pieces.map((piece) => piece.label)).toEqual(["Okuma", "Plansız"]);
    expect(pieces[0].work.task?.id).toBe(done.id);
    expect(pieces[1].end.getTime()).toBe(at("10:00").getTime());
  });

  it("hatches the travel around work and lays the fixed blocks over the strip, in time order", () => {
    const trip = work("Kütüphane", 60);
    const lecture = block({ title: "Ders", starts_at: iso("13:00"), ends_at: iso("14:00") });
    const gone = block({
      title: "İptal",
      status: "cancelled",
      starts_at: iso("15:00"),
      ends_at: iso("16:00"),
    });
    const { input, plan } = setup(rows({ tasks: [trip], blocks: [lecture, gone] }), "09:00");
    const candidate = plan.candidates.find((row) => row.id === trip.id)!;
    const flow = dayFlowOf(
      input,
      withSlots(plan, [
        {
          start: at("10:00"),
          end: at("11:00"),
          minutes: 60,
          kind: "deep",
          assignment: { candidate, minutes: 60, travelBefore: 20, travelAfter: 15, reasons: [] },
        },
      ]),
      [],
    );
    expect(flow.pieces.map((piece) => [piece.kind, piece.label])).toEqual([
      ["travel", "yol 20 dk"],
      ["work", "Kütüphane"],
      ["travel", "yol 15 dk"],
      ["block", "Ders"],
    ]);
    const [before, , after] = flow.pieces;
    expect(before.start.getTime()).toBe(at("09:40").getTime());
    expect(after.end.getTime()).toBe(at("11:15").getTime());
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
    expect(currentId).not.toBeNull();
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
    expect(list.filter((row) => row.kind === "work")).toHaveLength(2);
    expect(
      list.some((row) => row.kind === "work" && row.assignment.candidate.id === currentId),
    ).toBe(false);
    const times = list.map((row) => row.start.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    // Closed: only work rows, at most the count.
    expect(closedUpNext(list, 1).map((row) => row.kind)).toEqual(["work"]);
  });

  it("keeps a break only between two pieces of work", () => {
    const a = work("A", 60);
    const b = work("B", 60);
    const { input, plan } = setup(rows({ tasks: [a, b] }), "09:00");
    const assign = (id: string) => ({
      candidate: plan.candidates.find((row) => row.id === id)!,
      minutes: 60,
      reasons: [],
    });
    const slot = (start: string, end: string, assignment: Slot["assignment"]): Slot => ({
      start: at(start),
      end: at(end),
      minutes: assignment ? 60 : 15,
      kind: assignment ? "deep" : "break",
      assignment,
    });
    const list = upNextOf(
      input,
      withSlots(plan, [
        slot("09:00", "09:15", null),
        slot("09:15", "10:15", assign(a.id)),
        slot("10:15", "10:30", null),
        slot("10:30", "11:30", assign(b.id)),
        slot("11:30", "11:45", null),
      ]),
      null,
    );
    expect(list.map((row) => (row.kind === "break" ? breakText(row.minutes) : row.kind))).toEqual([
      "work",
      "mola · 15 dk",
      "work",
    ]);
  });

  it("is empty when nothing is left", () => {
    const { input, plan } = setup(rows(), "10:00");
    expect(upNextOf(input, plan, null)).toEqual([]);
  });
});
