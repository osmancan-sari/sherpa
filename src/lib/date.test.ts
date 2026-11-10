import { describe, expect, it } from "vitest";
import { dayKey, formatDayLabel } from "./date";

describe("Istanbul time", () => {
  it("labels the day in Turkish", () => {
    // 12 Nov 2026 07:40 UTC = 10:40 in Istanbul
    expect(formatDayLabel(new Date("2026-11-12T07:40:00Z"))).toBe("Perşembe 12 Kasım");
  });

  it("uses the Istanbul calendar day, not the UTC one", () => {
    // 21:30 UTC is already 00:30 the next day in Istanbul (UTC+3)
    const lateEvening = new Date("2026-11-12T21:30:00Z");
    expect(dayKey(lateEvening)).toBe("2026-11-13");
    expect(formatDayLabel(lateEvening)).toBe("Cuma 13 Kasım");
  });
});
