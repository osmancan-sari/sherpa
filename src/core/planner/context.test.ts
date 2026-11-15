import { describe, expect, it } from "vitest";
import { block } from "@/core/testing/factories";
import { istanbulInstant } from "@/lib/date";
import { inferContext, placeContext, reportedOf, statedDayType } from "./context";

// Where the device is (docs/04-planlayici.md, "Bağlam tahmini", Ç4a): the second screen is at the
// desk; the phone is inferred from what was reported, a block's place, the day's type, in order.

const DATE = "2026-11-12";
const at = (time: string, day = DATE) => istanbulInstant(day, time);
const iso = (time: string, day = DATE) => at(time, day).toISOString();

const phone = (overrides: Partial<Parameters<typeof inferContext>[0]> = {}) =>
  inferContext({
    device: "phone",
    now: at("10:00"),
    date: DATE,
    reported: null,
    blocks: [],
    ...overrides,
  });

describe("inferContext", () => {
  it("the second screen is at the desk, whatever else is known", () => {
    expect(
      inferContext({
        device: "desk",
        now: at("10:00"),
        date: DATE,
        reported: { context: "campus", at: at("09:30") },
        blocks: [block({ location: "Kampüs", starts_at: iso("09:00"), ends_at: iso("12:00") })],
      }),
    ).toBe("desk");
  });

  it("with nothing known on the phone the context is unknown: the filter is off", () => {
    expect(phone()).toBeNull();
  });

  it("first: what core/context reported in the last three hours", () => {
    const office = block({ location: "Ofis", starts_at: iso("09:30"), ends_at: iso("11:00") });
    expect(phone({ reported: { context: "campus", at: at("07:01") }, blocks: [office] })).toBe(
      "campus",
    );
    // Older than three hours: the block speaks.
    expect(phone({ reported: { context: "campus", at: at("06:59") }, blocks: [office] })).toBe(
      "office",
    );
    // A value from the future (a clock off) is not taken.
    expect(phone({ reported: { context: "campus", at: at("10:30") } })).toBeNull();
  });

  it("then: a block with a place that is on now or starts within half an hour", () => {
    const later = block({ location: "Kampüs", starts_at: iso("10:30"), ends_at: iso("12:00") });
    expect(phone({ blocks: [later] })).toBe("campus");
    const tooLate = block({ location: "Kampüs", starts_at: iso("10:31"), ends_at: iso("12:00") });
    expect(phone({ blocks: [tooLate] })).toBeNull();
    const over = block({ location: "Ofis", starts_at: iso("08:00"), ends_at: iso("10:00") });
    expect(phone({ blocks: [over] })).toBeNull();
    const cancelled = { ...later, status: "cancelled" as const };
    expect(phone({ blocks: [cancelled] })).toBeNull();
    // A block without a place says nothing of where one is.
    const nowhere = block({ location: null, starts_at: iso("09:30"), ends_at: iso("11:00") });
    expect(phone({ blocks: [nowhere] })).toBeNull();
    // The one on now comes before the one that starts soon.
    const on = block({ location: "Ev", starts_at: iso("09:00"), ends_at: iso("10:15") });
    expect(phone({ blocks: [later, on] })).toBe("home");
  });

  it("then: the day's type as its blocks state it (not the default type)", () => {
    const campusDay = block({ day_type: "campus", starts_at: iso("14:00"), ends_at: iso("16:00") });
    expect(phone({ blocks: [campusDay] })).toBe("campus");
    expect(statedDayType(DATE, [campusDay])).toBe("campus");
    expect(statedDayType("2026-11-13", [campusDay])).toBeNull();
  });
});

describe("placeContext", () => {
  it("reads a known word of the place, else the block's day type, else out of home", () => {
    expect(placeContext({ location: "Ev", day_type: null })).toBe("home");
    expect(placeContext({ location: "İTÜ Kampüs, Ayazağa", day_type: null })).toBe("campus");
    expect(placeContext({ location: "kampus", day_type: null })).toBe("campus");
    expect(placeContext({ location: "Ofis 3. kat", day_type: null })).toBe("office");
    expect(placeContext({ location: "Yolda", day_type: null })).toBe("commute");
    expect(placeContext({ location: "Mühendislik binası", day_type: "campus" })).toBe("campus");
    expect(placeContext({ location: "Dişçi", day_type: null })).toBe("out");
  });
});

describe("reportedOf", () => {
  it("reads the kept report, or none", () => {
    expect(reportedOf(null)).toBeNull();
    expect(reportedOf({ reported_context: null, reported_context_at: null })).toBeNull();
    expect(reportedOf({ reported_context: "campus", reported_context_at: iso("09:00") })).toEqual({
      context: "campus",
      at: at("09:00"),
    });
  });
});
