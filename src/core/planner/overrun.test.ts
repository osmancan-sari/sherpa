import { describe, expect, it } from "vitest";
import { session } from "@/core/testing/factories";
import { overrun } from "./overrun";

const START = "2026-11-12T07:00:00.000Z";
const after = (minutes: number) => new Date(Date.parse(START) + minutes * 60_000);

describe("a session past its time", () => {
  const running = session({ started_at: START });

  it("asks after twice its estimate, and is closed when nobody answers", () => {
    expect(overrun(running, 30, after(60))).toBe("none");
    expect(overrun(running, 30, after(61))).toBe("ask");
    expect(overrun(running, 30, after(90))).toBe("ask");
    expect(overrun(running, 30, after(91))).toBe("close");
  });

  it("asks again one estimate after 'devam'", () => {
    const confirmed = { ...running, confirmed_at: after(65).toISOString() };
    expect(overrun(confirmed, 30, after(80))).toBe("none");
    expect(overrun(confirmed, 30, after(96))).toBe("ask");
    expect(overrun(confirmed, 30, after(126))).toBe("close");
  });

  it("never asks without an estimate, or once it ended", () => {
    expect(overrun(running, null, after(500))).toBe("none");
    expect(overrun({ ...running, ended_at: after(10).toISOString() }, 30, after(500))).toBe("none");
  });
});
