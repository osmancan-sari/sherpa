import { describe, expect, it } from "vitest";
import {
  BACKGROUNDS,
  contrast,
  facetColor,
  moduleColor,
  NO_COLOR,
  normalizeColor,
  PALETTE,
  readable,
  userFacetColors,
  workColor,
} from "./colors";
import type { ModuleFacet } from "./types";

// The one colour resolver (docs/06-modul-sozlesmesi.md, "Bölümler" rule 4; Ç3e).

const SABAH: ModuleFacet = { key: "sabah", name: "Sabah", color: "#d97706" };
const AKSAM: ModuleFacet = { key: "aksam", name: "Akşam", color: "#4361d8" };
const definition = { color: "#6250d6" };

describe("the colour of a piece of work", () => {
  it("the user's facet colour → the facet's default → the user's module colour → the module's default", () => {
    const row = { color: "#0d9488", facet_colors: { sabah: "#e11d48" } };
    const source = { row, definition };
    expect(workColor(source, [SABAH, AKSAM], "sabah")).toBe("#e11d48");
    expect(workColor(source, [SABAH, AKSAM], "aksam")).toBe("#4361d8");
    expect(workColor(source, [SABAH, AKSAM], null)).toBe("#0d9488");
    expect(workColor({ row: { color: null }, definition }, [SABAH], null)).toBe("#6250d6");
    expect(workColor(null, null, null)).toBe(NO_COLOR);
  });

  it("a facet that left the list, or a module whose list is unknown, has the module's colour", () => {
    const source = { row: { color: "#0d9488", facet_colors: { aksam: "#e11d48" } }, definition };
    expect(workColor(source, [SABAH], "aksam")).toBe("#0d9488");
    expect(workColor(source, null, "sabah")).toBe("#0d9488");
  });

  it("a module without facets is exactly as before: the row's colour", () => {
    expect(moduleColor({ row: { color: "#2563eb" }, definition })).toBe("#2563eb");
    expect(workColor({ row: { color: "#2563eb" }, definition }, null, null)).toBe("#2563eb");
  });

  it("skips malformed stored colours", () => {
    expect(
      userFacetColors({ color: null, facet_colors: { sabah: "sarı", aksam: "#4361D8" } }),
    ).toEqual({
      aksam: "#4361D8",
    });
    expect(userFacetColors({ color: null, facet_colors: ["#000000"] })).toEqual({});
    expect(facetColor({ color: null, facet_colors: { sabah: 3 } }, SABAH)).toBe("#d97706");
    expect(moduleColor({ row: { color: "mavi" }, definition })).toBe("#6250d6");
  });
});

describe("the palette", () => {
  it("every ready colour stays at least 3:1 against both themes' backgrounds", () => {
    expect(PALETTE).toHaveLength(12);
    for (const { name, value } of PALETTE) {
      for (const background of BACKGROUNDS) {
        expect(contrast(value, background), `${name} on ${background}`).toBeGreaterThanOrEqual(3);
      }
      expect(readable(value)).toBe(true);
    }
    expect(new Set(PALETTE.map(({ value }) => value)).size).toBe(12);
  });

  it("a colour hard to tell apart in one theme is not readable", () => {
    expect(readable("#ffeb3b")).toBe(false); // light yellow on white
    expect(readable("#1e1b4b")).toBe(false); // deep indigo on black
    expect(readable("lacivert")).toBe(false);
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21);
  });

  it("normalises what the user types", () => {
    expect(normalizeColor(" #E8A33D ")).toBe("#e8a33d");
    expect(normalizeColor("e8a33d")).toBe("#e8a33d");
    expect(normalizeColor("#e8a")).toBeNull();
    expect(normalizeColor("sarı")).toBeNull();
  });
});
