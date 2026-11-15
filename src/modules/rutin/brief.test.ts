import { describe, expect, it } from "vitest";
import type { TodayBrief } from "@/core/contract/types";
import { istanbulInstant } from "@/lib/date";
import { atTime, briefLines, briefText, countWord, nextOfDay } from "./brief";

// The morning's summary (docs/moduller/rutin.md, 8.3): a pattern over the scene's `today`.

const at = (time: string) => istanbulInstant("2026-11-13", time);

const today: TodayBrief = {
  date: "2026-11-13",
  work: { count: 4, first: { title: "proje önerisi", module: "Okul" } },
  blocks: [{ title: "Derin Öğrenme dersi", startsAt: at("10:30"), endsAt: at("12:30") }],
  bedtime: at("23:00"),
  wokeAt: at("07:00"),
  wokeFrom: "screen",
  closed: false,
  tomorrow: null,
};

describe("the morning's summary (Ç4a)", () => {
  it("says the first block, how much work the day has and the first of it, tonight's bedtime", () => {
    expect(briefText(today, at("07:02"))).toBe(
      "Günaydın. 10:30'da Derin Öğrenme dersi var. Bugün dört iş var; ilki proje önerisi. " +
        "Yatış 23:00.",
    );
  });

  it("leaves out what the day does not have; one work is said by itself", () => {
    expect(
      briefText(
        { ...today, work: { count: 0, first: null }, blocks: [], bedtime: null },
        at("07:02"),
      ),
    ).toBe("Günaydın.");
    expect(briefText({ ...today, work: { count: 1, first: today.work.first } }, at("13:00"))).toBe(
      "Günaydın. Bugün bir iş var: proje önerisi. Yatış 23:00.",
    );
    expect(briefText({ ...today, work: { count: 12, first: today.work.first } }, at("13:00"))).toBe(
      "Günaydın. Bugün on iki iş var; ilki proje önerisi. Yatış 23:00.",
    );
  });

  it("says counts as words", () => {
    expect([1, 4, 10, 12, 20, 37, 99, 100].map(countWord)).toEqual([
      "bir",
      "dört",
      "on",
      "on iki",
      "yirmi",
      "otuz yedi",
      "doksan dokuz",
      "100",
    ]);
  });

  it("reads a clock time with the right ending", () => {
    expect(
      ["10:30", "08:00", "13:15", "19:00", "12:00", "16:40", "23:00", "00:00"].map(atTime),
    ).toEqual([
      "10:30'da",
      "08:00'de",
      "13:15'te",
      "19:00'da",
      "12:00'de",
      "16:40'ta",
      "23:00'te",
      "00:00'da",
    ]);
  });

  it("gives the board's rows and the morning's next thing", () => {
    expect(briefLines(today, at("07:02"))).toEqual([
      { left: "10:30", right: "Derin Öğrenme dersi" },
      { left: "4 iş", right: "İlki proje önerisi" },
      { left: "23:00", right: "Yatış" },
    ]);
    expect(nextOfDay(today, at("07:52"))).toBe("10:30 Derin Öğrenme dersi");
    expect(nextOfDay(today, at("11:00"))).toBe("proje önerisi");
  });
});
