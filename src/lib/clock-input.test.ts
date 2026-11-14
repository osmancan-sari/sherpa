import { describe, expect, it } from "vitest";
import { normalizeClock, typingClock } from "./clock-input";

// A clock time typed on the phone's number pad (no ":" key): the field puts the colon itself.

describe("a typed clock time", () => {
  it("reads digits alone as hours and minutes", () => {
    expect(normalizeClock("0800")).toBe("08:00");
    expect(normalizeClock("800")).toBe("08:00");
    expect(normalizeClock("8")).toBe("08:00");
    expect(normalizeClock("08")).toBe("08:00");
    expect(normalizeClock("930")).toBe("09:30");
    expect(normalizeClock("2230")).toBe("22:30");
    expect(normalizeClock("0")).toBe("00:00");
  });

  it("takes 24 and 2400 as 24:00, nothing later", () => {
    expect(normalizeClock("24")).toBe("24:00");
    expect(normalizeClock("2400")).toBe("24:00");
    expect(normalizeClock("2430")).toBe("2430");
    expect(normalizeClock("25")).toBe("25");
  });

  it("still takes a colon typed by hand, or a dot or a comma", () => {
    expect(normalizeClock("8:30")).toBe("08:30");
    expect(normalizeClock("08:30")).toBe("08:30");
    expect(normalizeClock("8.30")).toBe("08:30");
    expect(normalizeClock("8,5")).toBe("08:05");
    expect(normalizeClock("8:")).toBe("08:00");
    expect(normalizeClock(" 07:00 ")).toBe("07:00");
  });

  it("leaves what is not a time as it was, for the form's check to name", () => {
    expect(normalizeClock("")).toBe("");
    expect(normalizeClock("0860")).toBe("0860");
    expect(normalizeClock("12345")).toBe("12345");
    expect(normalizeClock("öğle")).toBe("öğle");
  });

  it("puts the colon in as soon as four digits are typed, and keeps only digits and one colon", () => {
    expect(["0", "08", "080", "0800"].map(typingClock)).toEqual(["0", "08", "080", "08:00"]);
    expect(typingClock("2400")).toBe("24:00");
    expect(typingClock("8:3")).toBe("8:3");
    expect(typingClock("8.30")).toBe("8:30");
    expect(typingClock("08:00x")).toBe("08:00");
    expect(typingClock("8::30")).toBe("8:30");
    expect(typingClock("123456")).toBe("12345");
    // Deleting back from "08:00" keeps what is left.
    expect(typingClock("08:0")).toBe("08:0");
  });
});
