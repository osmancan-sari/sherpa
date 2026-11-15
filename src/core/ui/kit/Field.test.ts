import { describe, expect, it } from "vitest";
import { turkishDate } from "./Field";

// The date field writes the date as Turkish does (docs/tasarim/parcalar.md, "Tarih alanı").
describe("turkishDate", () => {
  it("writes day, month and year with dots", () => {
    expect(turkishDate("2026-11-20")).toBe("20.11.2026");
    expect(turkishDate("2027-01-05")).toBe("05.01.2027");
  });

  it("writes nothing for an empty or half-typed value", () => {
    expect(turkishDate("")).toBe("");
    expect(turkishDate("2026-11")).toBe("");
  });
});
