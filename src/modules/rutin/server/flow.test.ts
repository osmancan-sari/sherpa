import { describe, expect, it } from "vitest";
import { istanbulInstant, shiftDay } from "@/lib/date";
import {
  dayStepsOf,
  isDue,
  lastDoneDays,
  minimumDone,
  partsOf,
  proposalMinutes,
  routineSeconds,
  runDay,
  type Step,
} from "./flow";

// The routine's pure rules (docs/moduller/rutin.md, "Kurallar"). The current day is a parameter.

let next = 0;
function step(extra: Partial<Step> = {}): Step {
  next += 1;
  return {
    id: `s${next}`,
    user_id: "u",
    routine_id: "r",
    parent_id: null,
    position: next,
    title: `Adım ${next}`,
    kind: "tap",
    seconds: 60,
    seconds_auto: true,
    hint: null,
    parts: null,
    minimum: false,
    active: true,
    phase: 1,
    every_days: null,
    evidence: null,
    ref: null,
    created_at: "",
    updated_at: "",
    ...extra,
  };
}

describe("every_days (criterion 6)", () => {
  const shower = step({ title: "Duş" });
  const dercos = step({ title: "Dercos", parent_id: shower.id, every_days: 3, seconds: 0 });
  const steps = [shower, dercos];
  const done = (day: string) => lastDoneDays([{ step_id: dercos.id, result: "done", day }]);
  const shows = (day: string, last: Map<string, string>) =>
    dayStepsOf(steps, "r", day, last)[0].addOns.map((row) => row.id);

  it("shows the add-on on the shower's screen three days after it was last done", () => {
    const last = done("2026-11-10");
    expect(shows("2026-11-11", last)).toEqual([]);
    expect(shows("2026-11-12", last)).toEqual([]);
    expect(shows("2026-11-13", last)).toEqual([dercos.id]);
    // A line of its own after the shower's.
    expect(dayStepsOf(steps, "r", "2026-11-13", last)[0].lines.map((line) => line.kind)).toEqual([
      "part",
      "addon",
    ]);
  });

  it("after a five-day break, once: its counter runs from the last time, not the calendar", () => {
    const last = done("2026-11-10");
    expect(shows("2026-11-15", last)).toEqual([dercos.id]);
    // Done on the day it came back: next due three days later, not again the day after.
    const after = lastDoneDays([
      { step_id: dercos.id, result: "done", day: "2026-11-10" },
      { step_id: dercos.id, result: "done", day: "2026-11-15" },
    ]);
    expect(shows("2026-11-16", after)).toEqual([]);
    expect(shows("2026-11-17", after)).toEqual([]);
    expect(shows("2026-11-18", after)).toEqual([dercos.id]);
  });

  it("comes again the next day when it was missed or skipped", () => {
    const skipped = lastDoneDays([
      { step_id: dercos.id, result: "done", day: "2026-11-10" },
      { step_id: dercos.id, result: "skipped", day: "2026-11-13" },
    ]);
    expect(shows("2026-11-14", skipped)).toEqual([dercos.id]);
  });

  it("stays on the day it was done (the run keeps its lines), and never-done is due", () => {
    expect(shows("2026-11-13", done("2026-11-13"))).toEqual([dercos.id]);
    expect(isDue(dercos, null, "2026-11-13")).toBe(true);
    expect(isDue(step(), "2026-11-13", "2026-11-13")).toBe(true);
  });

  it("works across a month and a year", () => {
    expect(isDue({ every_days: 3 }, "2026-12-30", "2027-01-02")).toBe(true);
    expect(isDue({ every_days: 3 }, "2026-12-31", "2027-01-02")).toBe(false);
    expect(isDue({ every_days: 2 }, "2026-10-31", shiftDay("2026-10-31", 2))).toBe(true);
  });
});

describe("the day's steps", () => {
  it("are the open steps of the routine in order, add-ons and the closing step left out", () => {
    const a = step({ position: 2, title: "B" });
    const b = step({ position: 1, title: "A" });
    const off = step({ position: 3, active: false });
    const closing = step({ position: 4, kind: "closing" });
    const other = step({ routine_id: "x" });
    const addOn = step({ parent_id: a.id });
    const offAddOn = step({ parent_id: a.id, active: false });
    const list = dayStepsOf(
      [a, b, off, closing, other, addOn, offAddOn],
      "r",
      "2026-11-14",
      new Map(),
    );
    expect(list.map((row) => row.title)).toEqual(["A", "B"]);
    expect(list[1].addOns.map((row) => row.id)).toEqual([addOn.id]);
  });

  it("have their sub-steps as lines, or themselves as one", () => {
    const plain = step({ title: "Giyin" });
    const parted = step({
      parts: [
        { title: "Fırçala", seconds: 120, timer: true },
        { title: "Dil", seconds: 25, hold: false },
        { title: "" },
        "nonsense",
      ],
    });
    const list = dayStepsOf([plain, parted], "r", "2026-11-14", new Map());
    expect(list[0].lines).toEqual([
      { kind: "part", index: 0, part: { title: "Giyin", note: null } },
    ]);
    expect(partsOf(parted)).toEqual([
      { title: "Fırçala", note: null, seconds: 120, timer: true, hold: true },
      { title: "Dil", note: null, seconds: 25, timer: false, hold: false },
    ]);
  });

  it("are all done for the day when every open basic step is done", () => {
    const a = step({ minimum: true });
    const b = step({ minimum: false });
    const list = dayStepsOf([a, b], "r", "2026-11-14", new Map());
    expect(minimumDone(list, new Map([[a.id, "done"]]))).toBe(true);
    expect(
      minimumDone(
        list,
        new Map([
          [a.id, "skipped"],
          [b.id, "done"],
        ]),
      ),
    ).toBe(false);
  });
});

describe("lengths", () => {
  it("are the open steps' seconds, add-ons left out; proposed in whole minutes from 5 to 90", () => {
    const steps = [
      step({ seconds: 180 }),
      step({ seconds: 60 }),
      step({ seconds: 600, active: false }),
      step({ seconds: 60, parent_id: "s1" }),
    ];
    expect(routineSeconds(steps, "r")).toBe(240);
    expect(proposalMinutes(240)).toBe(5);
    expect(proposalMinutes(2400)).toBe(40);
    expect(proposalMinutes(150)).toBe(5);
    expect(proposalMinutes(9000)).toBe(90);
  });
});

describe("the day a run belongs to (B3)", () => {
  const at = (day: string, time: string) => istanbulInstant(day, time);

  it("is the night before for the evening's run before noon", () => {
    expect(runDay(at("2026-11-14", "00:20"), "aksam", [])).toBe("2026-11-13");
    expect(runDay(at("2026-11-14", "22:20"), "aksam", [])).toBe("2026-11-14");
  });

  it("is the waking's day for the morning, even an early one", () => {
    expect(runDay(at("2026-11-14", "07:00"), "sabah", [])).toBe("2026-11-14");
    const early = [
      {
        date: "2026-11-14",
        wokeAt: at("2026-11-14", "04:30").toISOString(),
        wokeEstimated: false,
        bedAt: null,
        plannedWake: null,
        plannedBed: null,
      },
    ];
    expect(runDay(at("2026-11-14", "04:35"), "hazirlik", early)).toBe("2026-11-14");
    expect(runDay(at("2026-11-14", "04:35"), "sabah", [])).toBe("2026-11-13");
  });
});
