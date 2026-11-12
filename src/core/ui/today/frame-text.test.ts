import { describe, expect, it } from "vitest";
import type { DayFrame, SleepPlan } from "@/core/planner";
import { istanbulInstant } from "@/lib/date";
import { shortLine, sleepLine, sleepSummary, wakeText } from "./frame-text";

// The day's frame in words (docs/05-arayuz.md, "Günün çerçevesi").

const at = (time: string, day = "2026-11-12") => istanbulInstant(day, time);
const iso = (time: string, day = "2026-11-12") => at(time, day).toISOString();

const plan = (overrides: Partial<SleepPlan> = {}): SleepPlan => ({
  latestWake: at("09:00", "2026-11-13"),
  wake: at("09:00", "2026-11-13"),
  bed: at("01:00", "2026-11-13"),
  expectedWake: at("09:00", "2026-11-13"),
  sleepMinutes: 480,
  short: null,
  ...overrides,
});

const frame = (overrides: Partial<DayFrame> = {}): DayFrame => ({
  wake: at("07:40"),
  woke: true,
  estimated: false,
  bed: at("01:00", "2026-11-13"),
  bedAt: null,
  bedEnd: at("01:00", "2026-11-13"),
  morningUntil: at("10:00"),
  lastNight: plan(),
  tonight: plan(),
  ...overrides,
});

describe("the frame's sentences", () => {
  it("tonight's bed, tomorrow's waking and the sleep between them", () => {
    expect(sleepLine(frame())).toBe("Bu gece yatış 01:00 · yarın uyanış 09:00 · uyku 8 sa");
    expect(
      sleepLine(
        frame({
          bedAt: at("23:20"),
          tonight: plan({ expectedWake: at("07:20", "2026-11-13"), sleepMinutes: 480 }),
        }),
      ),
    ).toBe("Bu gece yatış 23:20 · yarın uyanış 07:20 · uyku 8 sa");
  });

  it("says a short night once, as a fact, and nothing when the night is whole", () => {
    expect(shortLine(plan())).toBeNull();
    expect(
      shortLine(
        plan({ short: "obligation", sleepMinutes: 420, latestWake: at("06:00", "2026-11-13") }),
      ),
    ).toBe("Yarın erken bir yükümlülük var (en geç 06:00 kalkış); bu gece en çok 7 sa uyku.");
    expect(shortLine(plan({ short: "late_bed", sleepMinutes: 450 }))).toBe(
      "Yarın en geç 09:00 kalkış; bu gece uyku 7 sa 30 dk.",
    );
    expect(shortLine(plan({ short: "early_wake", sleepMinutes: 390 }))).toBe(
      "Erken kalkışla bu gece uyku 6 sa 30 dk.",
    );
  });

  it("the waking on the top bar: recorded, estimated, expected", () => {
    expect(wakeText(frame())).toBe("uyanış 07:40");
    expect(wakeText(frame({ estimated: true }))).toBe("uyanış ~07:40");
    expect(wakeText(frame({ woke: false, wake: at("08:00") }))).toBe("beklenen uyanış 08:00");
  });

  it("Hafta's line: the last week's averages, a bedtime past midnight counted as late", () => {
    const days = [
      {
        date: "2026-11-10",
        woke_at: iso("07:00", "2026-11-10"),
        bed_at: iso("23:30", "2026-11-10"),
      },
      {
        date: "2026-11-11",
        woke_at: iso("08:00", "2026-11-11"),
        bed_at: iso("00:30", "2026-11-12"),
      },
      { date: "2026-11-12", woke_at: iso("08:30", "2026-11-12"), bed_at: null },
    ];
    expect(sleepSummary(days, "2026-11-12")).toBe(
      "Son 7 gün ortalaması: uyanış 07:50 · yatış 00:00 · uyku 8 sa 15 dk",
    );
    expect(sleepSummary([], "2026-11-12")).toBeNull();
  });
});
