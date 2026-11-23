import { describe, expect, it } from "vitest";
import { block } from "@/core/testing/factories";
import { blockPhase, blockViewHref, blockViewOf, proposedBlock } from "./blockView";
import type { ModuleBlockView } from "./types";

// Okul çekirdek A: which fixed blocks open their module's view.

const View = () => null;
const VIEW: ModuleBlockView = { component: View };
const modules = (view: ModuleBlockView | undefined, status = "active") =>
  new Map([["m", { row: { status }, definition: { ui: { tabs: [], blockView: view } } }]]);

describe("a block's view", () => {
  it("opens for a block the module proposed, while the module is active", () => {
    const proposed = block({ module_id: "m", key: "ders:1" });
    expect(proposedBlock(proposed)).toBe(true);
    expect(blockViewOf(proposed, modules(VIEW))).toBe(VIEW);
    expect(blockViewOf(proposed, modules(VIEW, "paused"))).toBeNull();
    expect(blockViewOf(proposed, modules(undefined))).toBeNull();
    expect(blockViewOf({ ...proposed, status: "cancelled" }, modules(VIEW))).toBeNull();
  });

  it("not for a block the user added by hand, even of the module", () => {
    expect(blockViewOf(block({ module_id: "m", key: null }), modules(VIEW))).toBeNull();
    expect(blockViewOf(block({ module_id: null, key: "x" }), modules(VIEW))).toBeNull();
  });

  it("asks the module's when; one that throws means no view", () => {
    const lessons: ModuleBlockView = { component: View, when: (row) => row.title === "Ders" };
    expect(blockViewOf(block({ module_id: "m", key: "a", title: "Ders" }), modules(lessons))).toBe(
      lessons,
    );
    expect(blockViewOf(block({ module_id: "m", key: "a", title: "Sınav" }), modules(lessons))).toBe(
      null,
    );
    const broken: ModuleBlockView = {
      component: View,
      when: () => {
        throw new Error("x");
      },
    };
    expect(blockViewOf(block({ module_id: "m", key: "a" }), modules(broken))).toBeNull();
  });

  it("knows before, during and after; its address is Today's", () => {
    const row = block({ starts_at: "2026-11-23T11:30:00Z", ends_at: "2026-11-23T14:20:00Z" });
    expect(blockPhase(row, new Date("2026-11-23T11:00:00Z"))).toBe("before");
    expect(blockPhase(row, new Date("2026-11-23T12:00:00Z"))).toBe("during");
    expect(blockPhase(row, new Date("2026-11-23T14:20:00Z"))).toBe("after");
    expect(blockViewHref("a b")).toBe("/?blok=a%20b");
  });
});
