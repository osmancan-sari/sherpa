import { describe, expect, it } from "vitest";
import type { TodayBrief } from "@/core/contract/types";
import { istanbulInstant } from "@/lib/date";
import { atTime, briefLines, briefText, nextOfDay } from "./brief";

// The morning's summary (docs/moduller/rutin.md, 8.3): a pattern over the scene's `today`.

const at = (time: string) => istanbulInstant("2026-11-13", time);

const today: TodayBrief = {
  top: [
    { title: "Proje önerisi taslağı", module: "Okul", reason: null },
    { title: "İstatistik ödevi", module: "Okul", reason: null },
    { title: "Rapor: yöntem bölümü", module: "İş", reason: null },
  ],
  blocks: [{ title: "Derin Öğrenme dersi", startsAt: at("10:30"), endsAt: at("12:30") }],
  finishLine: at("19:00"),
  wokeAt: at("07:00"),
  closed: false,
};

describe("the morning's summary", () => {
  it("says the first block, the three, the finish line and tonight's bedtime", () => {
    expect(briefText(today, at("07:02"), "23:00")).toBe(
      "Günaydın. 10:30'da Derin Öğrenme dersi var. Bugünün üç işi: Proje önerisi taslağı, " +
        "İstatistik ödevi ve Rapor: yöntem bölümü. Gün 19:00'da bitiyor. Bu gece yatış 23:00.",
    );
  });

  it("leaves out what the day does not have", () => {
    expect(briefText({ ...today, top: [], blocks: [] }, at("07:02"), null)).toBe(
      "Günaydın. Gün 19:00'da bitiyor.",
    );
    expect(briefText({ ...today, top: today.top.slice(0, 1) }, at("13:00"), null)).toBe(
      "Günaydın. Bugünün işi: Proje önerisi taslağı. Gün 19:00'da bitiyor.",
    );
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
      { left: "3 iş", right: "Proje önerisi taslağı · İstatistik ödevi · Rapor: yöntem bölümü" },
      { left: "19:00", right: "Gün biter" },
    ]);
    expect(nextOfDay(today, at("07:52"))).toBe("10:30 Derin Öğrenme dersi");
    expect(nextOfDay(today, at("11:00"))).toBe("Proje önerisi taslağı");
  });
});
