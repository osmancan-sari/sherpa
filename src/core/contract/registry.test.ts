import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createRegistry, definitionProblems, matchRoute, resolveModulePath } from "./registry";
import type { ModuleDefinition } from "./types";

const View = () => null;

function definition(overrides: Partial<ModuleDefinition> = {}): ModuleDefinition {
  return {
    slug: "ornek",
    name: "Örnek",
    kind: "lifelong",
    color: "#2563eb",
    chip: async () => ({ text: "", health: "ok" }),
    intake: [{ key: "kayit", label: "Kayıt", fields: [], examples: [], handle: async () => {} }],
    emits: ["ornek.kayit_eklendi"],
    modeBehavior: {
      normal: { weightMultiplier: 1, floorMultiplier: 1 },
      busy: { weightMultiplier: 0.5, floorMultiplier: 0.5 },
      minimum: { weightMultiplier: 0.2, floorMultiplier: 0 },
      holiday: { weightMultiplier: 0, floorMultiplier: 0 },
    },
    weeklyReport: async () => ({ metrics: [], suggestions: [] }),
    tables: ["ornek_kayitlar"],
    ui: {
      tabs: [
        { key: "genel", label: "Genel", component: View },
        { key: "liste", label: "Liste", component: View },
      ],
      routes: [{ path: "kayit/:id", component: View }],
      fullscreen: [{ key: "koc", label: "Koç", component: View }],
      actions: [{ key: "ekle", label: "Ekle", run: () => {} }],
    },
    ...overrides,
  };
}

describe("createRegistry", () => {
  it("accepts a definition that follows the contract and finds it by slug", () => {
    const registry = createRegistry([
      definition(),
      definition({ slug: "ikinci", emits: [], tables: [] }),
    ]);
    expect(registry.list.map((def) => def.slug)).toEqual(["ornek", "ikinci"]);
    expect(registry.get("ornek")?.name).toBe("Örnek");
    expect(registry.get("yok")).toBeUndefined();
    expect(createRegistry([]).list).toEqual([]);
  });

  it("refuses a slug registered twice", () => {
    expect(() => createRegistry([definition(), definition()])).toThrow(/registered twice/);
  });

  it("names every way a definition breaks the contract", () => {
    const cases: [Partial<ModuleDefinition>, RegExp][] = [
      [{ slug: "Okul" }, /slug must be/],
      [{ slug: "_sablon" }, /slug must be/],
      [{ slug: "core", emits: [], tables: [] }, /reserved for the core/],
      [{ ui: { tabs: [{ key: "a", label: " ", component: View }] } }, /has no label/],
      [{ name: "  " }, /name is empty/],
      [{ color: "mavi" }, /color must be/],
      [{ ui: { tabs: [] } }, /at least one tab/],
      [{ ui: { tabs: [{ key: "tam", label: "x", component: View }] } }, /reserved/],
      [
        {
          ui: {
            tabs: [
              { key: "a", label: "x", component: View },
              { key: "a", label: "y", component: View },
            ],
          },
        },
        /used twice/,
      ],
      [{ ui: { tabs: [{ key: "Genel Bakış", label: "x", component: View }] } }, /not a valid path/],
      [
        {
          ui: {
            tabs: [{ key: "a", label: "x", component: View }],
            routes: [{ path: "tam/x", component: View }],
          },
        },
        /reserved segment/,
      ],
      [
        {
          ui: {
            tabs: [{ key: "a", label: "x", component: View }],
            routes: [{ path: "/kayit", component: View }],
          },
        },
        /must be relative/,
      ],
      [
        {
          ui: {
            tabs: [{ key: "a", label: "x", component: View }],
            routes: [{ path: "a", component: View }],
          },
        },
        /collides with a tab/,
      ],
      [{ emits: ["baska.olay"] }, /must start with "ornek\."/],
      [{ tables: ["tasks"] }, /must start with "ornek_"/],
      [
        {
          intake: [{ key: "a", label: "", fields: [], examples: [], handle: async () => {} }],
        },
        /no label/,
      ],
      [
        {
          modeBehavior: {
            ...definition().modeBehavior,
            busy: { weightMultiplier: 1, floorMultiplier: 1.5 },
          },
        },
        /between 0 and 1/,
      ],
    ];
    for (const [overrides, message] of cases) {
      expect(definitionProblems(definition(overrides)).join("\n"), String(message)).toMatch(
        message,
      );
      expect(() => createRegistry([definition(overrides)])).toThrow(/Module contract problems/);
    }
    expect(definitionProblems(definition())).toEqual([]);
  });
});

describe("data from outside and scheduled work (Ç3d)", () => {
  const schema = z.object({ title: z.string() });
  const handle = async () => {};
  const run = async () => {};

  it("accepts valid ingest kinds and jobs", () => {
    expect(
      definitionProblems(
        definition({
          ingest: [{ kind: "tarti", schema, handle }],
          jobs: [
            { key: "saatlik", every: "hour", run },
            { key: "gece", every: "day", at: "03:30", run },
            { key: "haftalik", every: "week", run },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("names every broken ingest kind and job", () => {
    const cases: [Partial<ModuleDefinition>, RegExp][] = [
      [{ ingest: [{ kind: "Tarti", schema, handle }] }, /ingest kind "Tarti" is not valid/],
      [{ ingest: [{ kind: "a/b", schema, handle }] }, /ingest kind "a\/b" is not valid/],
      [
        {
          ingest: [
            { kind: "a", schema, handle },
            { kind: "a", schema, handle },
          ],
        },
        /ingest kind "a" is used twice/,
      ],
      [{ ingest: [{ kind: "a", schema: {} as never, handle }] }, /has no schema/],
      [{ ingest: [{ kind: "a", schema, handle: undefined as never }] }, /has no handler/],
      [{ jobs: [{ key: "Gece", every: "day", run }] }, /job key "Gece" is not valid/],
      [
        {
          jobs: [
            { key: "a", every: "day", run },
            { key: "a", every: "week", run },
          ],
        },
        /job key "a" is used twice/,
      ],
      [{ jobs: [{ key: "a", every: "month" as never, run }] }, /no valid period/],
      [{ jobs: [{ key: "a", every: "hour", at: "10:00", run }] }, /"at" is for days and weeks/],
      [{ jobs: [{ key: "a", every: "day", at: "25:00", run }] }, /"at" is HH:mm/],
      [{ jobs: [{ key: "a", every: "day", run: undefined as never }] }, /nothing to run/],
    ];
    for (const [overrides, problem] of cases) {
      expect(definitionProblems(definition(overrides)).join("\n")).toMatch(problem);
    }
  });
});

describe("the scene (Ç3c)", () => {
  it("needs `when` and a component", () => {
    const view = () => null;
    expect(() =>
      createRegistry([
        definition({ ui: { ...definition().ui, scene: { when: () => true, component: view } } }),
      ]),
    ).not.toThrow();
    expect(() =>
      createRegistry([
        definition({
          ui: { ...definition().ui, scene: { when: undefined as never, component: view } },
        }),
      ]),
    ).toThrow(/scene needs/);
  });
});

describe("module paths", () => {
  const def = definition();

  it("opens the first tab at the module's root and a named tab at its key", () => {
    expect(resolveModulePath(def, [])).toEqual({ kind: "tab", tabKey: "genel" });
    expect(resolveModulePath(def, ["liste"])).toEqual({ kind: "tab", tabKey: "liste" });
  });

  it("matches sub pages with their parameters", () => {
    expect(resolveModulePath(def, ["kayit", "42"])).toEqual({
      kind: "route",
      index: 0,
      params: { id: "42" },
    });
    expect(matchRoute("ders/:code/hafta/:week", ["ders", "BBF301E", "hafta", "6"])).toEqual({
      code: "BBF301E",
      week: "6",
    });
    expect(matchRoute("kayit/:id", ["kayit"])).toBeNull();
    expect(matchRoute("kayit/:id", ["tarif", "42"])).toBeNull();
  });

  it("reports everything else as missing", () => {
    expect(resolveModulePath(def, ["yok"])).toEqual({ kind: "missing" });
    expect(resolveModulePath(def, ["kayit", "42", "fazla"])).toEqual({ kind: "missing" });
    expect(resolveModulePath(def, ["liste", "fazla"])).toEqual({ kind: "missing" });
  });
});
