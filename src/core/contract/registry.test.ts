import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createRegistry,
  definitionProblems,
  matchRoute,
  modulePageOf,
  resolveModulePath,
} from "./registry";
import type { ModuleRow } from "@/core/types";
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
    ];
    for (const [overrides, message] of cases) {
      expect(definitionProblems(definition(overrides)).join("\n"), String(message)).toMatch(
        message,
      );
      expect(() => createRegistry([definition(overrides)])).toThrow(/Module contract problems/);
    }
    expect(definitionProblems(definition())).toEqual([]);
  });

  it("accepts a module that still declares its life mode behaviour, or none (Ç4a)", () => {
    // Written before the life modes went: not refused, whatever it says.
    const old = definition({
      modeBehavior: { busy: { weightMultiplier: 1, floorMultiplier: 1.5 } },
    });
    expect(definitionProblems(old)).toEqual([]);
    const none = definition();
    delete none.modeBehavior;
    expect(definitionProblems(none)).toEqual([]);
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

  it('takes the Today keys only by saying "scene" (Ç3g)', () => {
    const view = () => null;
    const scene = { when: () => true, component: view };
    expect(() =>
      createRegistry([
        definition({
          ui: {
            ...definition().ui,
            scene: { ...scene, keys: "scene" },
            scenes: { gunes: { ...scene, keys: "scene" } },
          },
        }),
      ]),
    ).not.toThrow();
    expect(() =>
      createRegistry([
        definition({ ui: { ...definition().ui, scene: { ...scene, keys: "all" as never } } }),
      ]),
    ).toThrow(/keys can only be "scene"/);
    expect(() =>
      createRegistry([
        definition({
          ui: { ...definition().ui, scenes: { gece: { ...scene, keys: true as never } } },
        }),
      ]),
    ).toThrow(/scene "gece": keys can only be "scene"/);
  });

  it("takes a welcome only as a component (Sabah açılışı)", () => {
    const view = () => null;
    const scene = { when: () => true, component: view };
    expect(() =>
      createRegistry([
        definition({
          ui: {
            ...definition().ui,
            scene: { ...scene, welcome: view },
            scenes: { gunes: { ...scene, welcome: view } },
          },
        }),
      ]),
    ).not.toThrow();
    expect(() =>
      createRegistry([
        definition({ ui: { ...definition().ui, scene: { ...scene, welcome: null as never } } }),
      ]),
    ).toThrow(/the scene: welcome must be a component/);
    expect(() =>
      createRegistry([
        definition({
          ui: { ...definition().ui, scenes: { gunes: { ...scene, welcome: undefined } } },
        }),
      ]),
    ).toThrow(/scene "gunes": welcome must be a component/);
  });
});

describe("facets and named scenes (Ç3e)", () => {
  const view = () => null;
  const gunes = { when: () => true, component: view };

  it("accepts named scenes and a facet function", () => {
    expect(() =>
      createRegistry([
        definition({
          ui: { ...definition().ui, scenes: { gunes, "gece-1": gunes } },
          facets: async () => [{ key: "sabah", name: "Sabah", color: "#d97706", scene: "gunes" }],
        }),
      ]),
    ).not.toThrow();
  });

  it("names a named scene without `when` or a component, a bad key, a facets that is not a function", () => {
    const problems = definitionProblems(
      definition({
        ui: {
          ...definition().ui,
          scenes: {
            gunes: { when: undefined as never, component: view },
            Gece: gunes,
            bos: { when: () => true, component: undefined as never },
          },
        },
        facets: [{ key: "sabah" }] as never,
      }),
    );
    expect(problems).toEqual([
      'ornek: scene "gunes" needs `when` and a component',
      'ornek: scene key "Gece" is not valid',
      'ornek: scene "bos" needs `when` and a component',
      "ornek: facets must be a function of the module's context",
    ]);
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

describe("the module page's own shape (Okul çekirdek A)", () => {
  const row = (settings: Record<string, unknown>) => ({ settings }) as unknown as ModuleRow;

  it("without a page: the first tab at the root, as before; bolum is nothing", () => {
    const def = definition();
    expect(modulePageOf(def, row({}))).toEqual({});
    expect(resolveModulePath(def, [])).toEqual({ kind: "tab", tabKey: "genel" });
    expect(resolveModulePath(def, ["bolum", "sabah"])).toEqual({ kind: "missing" });
  });

  it("a home entry at the root; tabs still at their keys; facet pages under bolum", () => {
    const page = { home: { label: "Ana sayfa", component: View }, facetView: View };
    const def = definition({ ui: { ...definition().ui, page } });
    expect(definitionProblems(def)).toEqual([]);
    expect(resolveModulePath(def, [])).toEqual({ kind: "home" });
    expect(resolveModulePath(def, ["liste"])).toEqual({ kind: "tab", tabKey: "liste" });
    expect(resolveModulePath(def, ["bolum", "yzv406e"])).toEqual({
      kind: "facet",
      facetKey: "yzv406e",
    });
    expect(resolveModulePath(def, ["bolum"])).toEqual({ kind: "missing" });
  });

  it("with a home, no tab is needed; without one, a tab still is", () => {
    const home = { label: "Ana sayfa", component: View };
    expect(definitionProblems(definition({ ui: { tabs: [], page: { home } } }))).toEqual([]);
    expect(definitionProblems(definition({ ui: { tabs: [], page: {} } }))).toEqual([
      "ornek: at least one tab is needed",
    ]);
  });

  it("a page of the row: read with the row, the plain page when it throws", () => {
    const page = (module: ModuleRow) =>
      (module.settings as { page?: string }).page === "home"
        ? { home: { label: "Ana sayfa", component: View }, status: false }
        : {};
    const def = definition({ ui: { ...definition().ui, page } });
    expect(definitionProblems(def)).toEqual([]);
    expect(modulePageOf(def, row({ page: "home" })).status).toBe(false);
    expect(modulePageOf(def, row({}))).toEqual({});
    expect(modulePageOf(def, null)).toEqual({});
    const broken = definition({
      ui: {
        ...definition().ui,
        page: () => {
          throw new Error("x");
        },
      },
    });
    expect(modulePageOf(broken, row({}))).toEqual({});
    expect(resolveModulePath(def, [], modulePageOf(def, row({ page: "home" })))).toEqual({
      kind: "home",
    });
  });

  it("names a page that breaks the contract, and keeps bolum for the core", () => {
    const problems = definitionProblems(
      definition({
        ui: {
          ...definition().ui,
          tabs: [{ key: "bolum", label: "Bölüm", component: View }],
          routes: [{ path: "bolum/:id", component: View }],
          page: {
            home: { label: " ", component: View },
            facetView: undefined,
            subtitle: "2026 Güz" as never,
          },
        },
      }),
    );
    expect(problems).toEqual([
      "ornek: the page's home needs a label and a component",
      "ornek: the page's facetView must be a component",
      "ornek: the page's subtitle must be a function of the module's context",
      'ornek: tab key "bolum" is reserved',
      'ornek: route "bolum/:id" starts with a reserved segment',
    ]);
  });
});

describe("the way out's note (Okul çekirdek A)", () => {
  const scene = { when: () => true, component: View };
  it("needs a question and a way to keep it; when is a function", () => {
    const save = async () => {};
    expect(
      definitionProblems(
        definition({
          ui: {
            ...definition().ui,
            scene: { ...scene, beforeExit: { title: "Nerede kaldın?", save } },
            scenes: {
              bos: { ...scene, beforeExit: { title: " ", save } },
              hatali: { ...scene, beforeExit: { title: "Not", save, when: "akis" as never } },
              yok: { ...scene, beforeExit: undefined },
            },
          },
        }),
      ),
    ).toEqual([
      'ornek: scene "bos": beforeExit needs a title and save',
      'ornek: scene "hatali": beforeExit\'s when must be a function',
      'ornek: scene "yok": beforeExit needs a title and save',
    ]);
  });
});

describe("the closing's host and the area page's views (Ç4c)", () => {
  const view = () => null;

  it("accepts a hostsClosing function and area views with keys and titles", () => {
    expect(() =>
      createRegistry([
        definition({
          hostsClosing: async () => true,
          ui: {
            ...definition().ui,
            areaViews: [{ key: "duzen", title: "Son 14 gün", component: view, wide: true }],
          },
        }),
      ]),
    ).not.toThrow();
  });

  it("names a hostsClosing that is not a function, a bad or doubled view key, a view without a title", () => {
    const problems = definitionProblems(
      definition({
        hostsClosing: true as never,
        ui: {
          ...definition().ui,
          areaViews: [
            { key: "Bad Key", title: "A", component: view },
            { key: "iki", title: "B", component: view },
            { key: "iki", title: "C", component: view },
            { key: "bos", title: "", component: view },
          ],
        },
      }),
    );
    expect(problems).toEqual([
      "ornek: hostsClosing must be a function of the module's context",
      'ornek: area view key "Bad Key" is not a valid key',
      'ornek: area view key "iki" is used twice',
      'ornek: area view "bos" needs a title and a component',
    ]);
  });
});
