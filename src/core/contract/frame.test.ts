import { describe, expect, it } from "vitest";
import { checkFrame, DEFAULT_FRAME, nightOf, rangesFor, readFrame, toStoredFrame } from "./frame";

// The day's frame settings (docs/03-veri-modeli.md, `settings.day_frame`).

const STORED = { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 };

describe("the day's frame settings", () => {
  it("reads the stored default, null as off, and a broken value as the defaults", () => {
    expect(readFrame(STORED)).toEqual(DEFAULT_FRAME);
    expect(readFrame(null)).toBeNull();
    expect(readFrame(undefined)).toBeNull();
    expect(readFrame({ wake: "06:00" })).toEqual(DEFAULT_FRAME);
  });

  it("lets the bedtime range run past midnight, not the waking range", () => {
    expect(nightOf("22:00")).toBeLessThan(nightOf("01:00"));
    expect(checkFrame({ ...STORED, bed: ["23:30", "00:30"] }).issues).toEqual([]);
    expect(checkFrame({ ...STORED, bed: ["01:00", "22:00"] }).issues.map((i) => i.path)).toEqual([
      ["bed"],
    ]);
    expect(checkFrame({ ...STORED, wake: ["09:00", "06:00"] }).issues.map((i) => i.path)).toEqual([
      ["wake"],
    ]);
    expect(checkFrame({ ...STORED, wake: ["6:00", "09:00"] }).issues).toHaveLength(1);
  });

  it("keeps the sleep target between 4 and 12 hours, and refuses unknown fields", () => {
    expect(checkFrame({ ...STORED, sleep_minutes: 200 }).issues).toHaveLength(1);
    expect(checkFrame({ ...STORED, sleep_minutes: 800 }).issues).toHaveLength(1);
    expect(checkFrame({ ...STORED, nap: true }).issues).toHaveLength(1);
  });

  it("has ranges per day type, falling back to the general ones", () => {
    const { frame } = checkFrame({
      ...STORED,
      by_day_type: { office: { wake: ["06:00", "07:30"] } },
      start_on_wake: true,
    });
    expect(frame).not.toBeNull();
    expect(rangesFor(frame!, "office")).toEqual({
      wake: ["06:00", "07:30"],
      bed: ["22:00", "01:00"],
    });
    expect(rangesFor(frame!, "home")).toEqual({
      wake: ["06:00", "09:00"],
      bed: ["22:00", "01:00"],
    });
    expect(frame!.startOnWake).toBe(true);
    expect(toStoredFrame(frame!)).toEqual({
      ...STORED,
      by_day_type: { office: { wake: ["06:00", "07:30"] } },
      start_on_wake: true,
    });
    expect(toStoredFrame(DEFAULT_FRAME)).toEqual(STORED);
  });
});
