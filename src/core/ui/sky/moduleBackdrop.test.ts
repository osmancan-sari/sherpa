import { describe, expect, it } from "vitest";
import type { KnownModule } from "@/core/app/hooks";
import type { ModuleDefinition } from "@/core/contract/types";
import { moduleRow } from "@/core/testing/factories";
import { modulePageBackdrop, sceneBackdrop } from "./moduleBackdrop";

const Own = () => null;
const known = (backdrop?: typeof Own): KnownModule =>
  ({
    row: moduleRow({ slug: "ornek", color: "#5b8cff" }),
    definition: { ui: { backdrop } } as unknown as ModuleDefinition,
  }) as KnownModule;

describe("what a module's screens stand on (decision 4)", () => {
  it("the module page: the module's own backdrop, else the shell's calm one", () => {
    expect(modulePageBackdrop(known())).toBeNull();
    expect(modulePageBackdrop(known(Own))).toMatchObject({ kind: "module", id: "ornek" });
  });

  it("a scene: its tone, unless the module gives a backdrop of its own", () => {
    expect(sceneBackdrop(known(), "calm", "#7fe0a2")).toEqual({ kind: "full" });
    expect(sceneBackdrop(known(), "focus", "#7fe0a2")).toEqual({ kind: "focus" });
    expect(sceneBackdrop(known(), "energy", "#7fe0a2")).toEqual({
      kind: "energy",
      color: "#7fe0a2",
    });
    expect(sceneBackdrop(known(Own), "energy", "#7fe0a2")).toMatchObject({
      kind: "module",
      color: "#7fe0a2",
    });
  });
});
