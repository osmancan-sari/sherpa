import { describe, expect, it } from "vitest";
import { blockSeries } from "@/core/testing/factories";
import {
  daysBetween,
  formatDue,
  formatMinutes,
  istanbulInstant,
  monthStart,
  shiftDay,
  weekdayOf,
  weekStart,
} from "@/lib/date";
import { expandSeries } from "./series";

describe("expandSeries", () => {
  // Mondays 09:00 to 11:00, from 1 November 2026.
  const mondays = blockSeries({ weekday: 1, valid_from: "2026-11-01" });

  it("produces the coming weeks' blocks of a weekly series", () => {
    const blocks = expandSeries(mondays, "2026-11-12", "2026-12-10");
    expect(blocks.map((block) => block.occurrence_on)).toEqual([
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
      "2026-12-07",
    ]);
    // 09:00 in Istanbul is 06:00 UTC, all year round.
    expect(blocks[0]).toEqual({
      occurrence_on: "2026-11-16",
      starts_at: "2026-11-16T06:00:00.000Z",
      ends_at: "2026-11-16T08:00:00.000Z",
    });
  });

  it("includes both ends of the range", () => {
    const blocks = expandSeries(mondays, "2026-11-16", "2026-11-23");
    expect(blocks.map((block) => block.occurrence_on)).toEqual(["2026-11-16", "2026-11-23"]);
  });

  it("stays inside the series' own validity", () => {
    const term = blockSeries({ weekday: 1, valid_from: "2026-11-17", valid_to: "2026-11-30" });
    const blocks = expandSeries(term, "2026-11-01", "2026-12-31");
    expect(blocks.map((block) => block.occurrence_on)).toEqual(["2026-11-23", "2026-11-30"]);

    expect(expandSeries({ ...term, valid_to: "2026-11-10" }, "2026-11-12", "2026-12-31")).toEqual(
      [],
    );
    expect(expandSeries(mondays, "2026-12-01", "2026-11-01")).toEqual([]);
  });

  it("puts a late-evening series on the right calendar day", () => {
    // Sunday 22:30 to 23:45 in Istanbul is still Sunday there, 19:30 UTC.
    const late = blockSeries({ weekday: 7, start_time: "22:30:00", end_time: "23:45:00" });
    expect(expandSeries(late, "2026-11-12", "2026-11-16")).toEqual([
      {
        occurrence_on: "2026-11-15",
        starts_at: "2026-11-15T19:30:00.000Z",
        ends_at: "2026-11-15T20:45:00.000Z",
      },
    ]);
  });

  it("covers every weekday number, Monday being 1", () => {
    for (let weekday = 1; weekday <= 7; weekday++) {
      const blocks = expandSeries(blockSeries({ weekday }), "2026-11-09", "2026-11-15");
      expect(blocks.map((block) => block.occurrence_on)).toEqual([
        shiftDay("2026-11-09", weekday - 1),
      ]);
    }
  });
});

describe("date helpers", () => {
  it("moves day keys across month and year ends", () => {
    expect(shiftDay("2026-11-30", 1)).toBe("2026-12-01");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-11-29", "2026-12-02")).toEqual([
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
  });

  it("knows weekdays, week starts and month starts", () => {
    expect(weekdayOf("2026-11-12")).toBe(4);
    expect(weekdayOf("2026-11-15")).toBe(7);
    expect(weekStart("2026-11-15")).toBe("2026-11-09");
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
    expect(monthStart("2026-11-30")).toBe("2026-11-01");
  });

  it("turns an Istanbul wall-clock time into an instant", () => {
    expect(istanbulInstant("2026-11-12", "10:40").toISOString()).toBe("2026-11-12T07:40:00.000Z");
    expect(istanbulInstant("2026-11-12").toISOString()).toBe("2026-11-11T21:00:00.000Z");
  });

  it("writes deadlines the way people say them", () => {
    const now = new Date("2026-11-12T10:40:00+03:00");
    expect(formatDue("2026-11-12T20:59:00Z", now)).toBe("bugün");
    expect(formatDue("2026-11-12T15:00:00+03:00", now)).toBe("bugün 15:00");
    expect(formatDue("2026-11-13T20:59:00Z", now)).toBe("yarın");
    expect(formatDue("2026-11-11T20:59:00Z", now)).toBe("dün");
    expect(formatDue("2026-11-16T20:59:00Z", now)).toBe("Pazartesi");
    expect(formatDue("2026-11-25T10:00:00+03:00", now)).toBe("25 Kas 10:00");
    expect(formatDue("2026-11-01T20:59:00Z", now)).toBe("1 Kas");
  });

  it("writes durations the way people say them", () => {
    expect(formatMinutes(45)).toBe("45 dk");
    expect(formatMinutes(60)).toBe("1 sa");
    expect(formatMinutes(90)).toBe("1 sa 30 dk");
    expect(formatMinutes(360)).toBe("6 sa");
  });
});
