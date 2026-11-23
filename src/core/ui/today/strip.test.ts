import { describe, expect, it } from "vitest";
import { stripText } from "./Scene";

// Okul çekirdek A (docs/06-modul-sozlesmesi.md, "Sahne" rule 2): what the strip says after the
// work's name.

describe("the strip's minutes", () => {
  it("elapsed over allotted; the elapsed alone without an allotted time", () => {
    expect(stripText(26, 120, null)).toBe("26 dk / 2 sa");
    expect(stripText(97, 90, null)).toBe("1 sa 37 dk / 1 sa 30 dk");
    expect(stripText(26, null, null)).toBe("26 dk");
  });

  it("the scene's few words in their place; nothing without minutes", () => {
    expect(stripText(12, 45, "2 / 4")).toBe("2 / 4");
    expect(stripText(null, null, "derste")).toBe("derste");
    expect(stripText(null, 45, null)).toBeNull();
  });
});
