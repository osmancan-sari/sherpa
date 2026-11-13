import { describe, expect, it } from "vitest";
import type { ModuleFacet } from "@/core/contract/types";
import { moduleRow, task, workItem } from "@/core/testing/factories";
import { colorsOf, facetKeyOf, facetListOf } from "./facets";

// The screens' side of facets (docs/06-modul-sozlesmesi.md, "Bölümler"; Ç3e): which list a
// screen uses, which facet a piece of work is in, and the colour it is drawn with.

const SABAH: ModuleFacet = { key: "sabah", name: "Sabah", color: "#d97706", scene: "gunes" };

describe("the list a screen uses", () => {
  it("is the computed list; none while the computation fails, even with an older list", () => {
    expect(facetListOf({ data: [SABAH], isError: false })).toEqual([SABAH]);
    // A failed refetch keeps its old data in the query: the screens must not use it.
    expect(facetListOf({ data: [SABAH], isError: true })).toBeNull();
    expect(facetListOf({ data: undefined, isError: false })).toBeNull();
    expect(facetListOf(undefined)).toBeNull();
  });
});

describe("the facet of a piece of work", () => {
  it("a sitting's own, else its item's (given or found); a rhythm's or an item's own", () => {
    const item = workItem({ facet: "sabah" });
    const sitting = task({ work_item_id: item.id, facet: null });
    expect(facetKeyOf({ task: sitting }, [item])).toBe("sabah");
    expect(facetKeyOf({ task: sitting, item })).toBe("sabah");
    expect(facetKeyOf({ task: { ...sitting, facet: "aksam" } }, [item])).toBe("aksam");
    expect(facetKeyOf({ task: sitting }, [])).toBeNull();
    expect(facetKeyOf({ item })).toBe("sabah");
    expect(facetKeyOf({})).toBeNull();
  });
});

describe("the colours of a screen", () => {
  const row = moduleRow({ color: "#0d9488", facet_colors: { sabah: "#e11d48" } });
  const mod = { row, definition: undefined };

  it("work in a facet has the facet's colour; the module keeps its own", () => {
    const colors = colorsOf([mod], new Map([[row.id, [SABAH]]]));
    expect(colors.work(row.id, "sabah")).toBe("#e11d48");
    expect(colors.work(row.id, null)).toBe("#0d9488");
    expect(colors.module(row.id)).toBe("#0d9488");
    expect(colors.facet(row.id, "sabah")).toMatchObject({
      key: "sabah",
      name: "Sabah",
      color: "#e11d48",
    });
  });

  it("without the module's list (failed, or no facets) everything has the module's colour", () => {
    const colors = colorsOf([mod], new Map());
    expect(colors.work(row.id, "sabah")).toBe("#0d9488");
    expect(colors.facet(row.id, "sabah")).toBeNull();
    expect(colors.work("yok", null)).toBe("#64748b");
  });
});
