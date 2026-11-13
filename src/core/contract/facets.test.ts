import { describe, expect, it } from "vitest";
import { incomingFields, mergeProposal, parseProposal, ProposalError } from "./envelope";
import {
  checkedFacets,
  chooseScene,
  facetIssue,
  facetProblems,
  FacetError,
  findFacet,
  sceneTone,
  taskFacet,
} from "./facets";
import type { ModuleFacet, ModuleScene, WorkProposal } from "./types";

// A module's facets as pure functions (docs/06-modul-sozlesmesi.md, "Bölümler"; Ç3e).

const view = () => null;
const scene = (when: (subject: string) => boolean, tone?: "calm" | "focus" | "energy") =>
  ({ when, component: view, ...(tone ? { look: { tone } } : {}) }) as unknown as ModuleScene;

const GUNES = scene(() => true, "energy");
const GECE = scene(() => true, "calm");
const ODAK = scene((subject) => subject === "odak", "focus");

const def = {
  slug: "rutin",
  ui: { tabs: [], scene: ODAK, scenes: { gunes: GUNES, gece: GECE } },
};

const SABAH: ModuleFacet = { key: "sabah", name: "Sabah", color: "#d97706", scene: "gunes" };
const AKSAM: ModuleFacet = {
  key: "aksam",
  name: "Akşam",
  color: "#4361d8",
  scene: "gece",
  tone: "calm",
};

describe("a facet list", () => {
  it("passes when keys are unique and spelled right, colours are #rrggbb, scenes exist", () => {
    expect(
      facetProblems(def, [SABAH, AKSAM, { key: "ders-1", name: "Ders", color: "#0D9488" }]),
    ).toEqual([]);
    expect(checkedFacets(def, [])).toEqual([]);
  });

  it("names every problem", () => {
    const problems = facetProblems(def, [
      SABAH,
      { ...AKSAM, key: "sabah" },
      { key: "Öğle", name: "Öğle", color: "#d97706" },
      { key: "a".repeat(41), name: "Uzun", color: "#d97706" },
      { key: "gece", name: " ", color: "lacivert" },
      { key: "ders", name: "Ders", color: "#2563eb", scene: "ders" },
      { key: "ton", name: "Ton", color: "#2563eb", tone: "loud" as never },
    ]);
    expect(problems).toEqual([
      'rutin: facet key "sabah" is used twice',
      'rutin: facet key "Öğle" is not valid',
      `rutin: facet key "${"a".repeat(41)}" is not valid`,
      'rutin: facet "gece" has no name',
      'rutin: facet "gece": color must be a #rrggbb value',
      'rutin: facet "ders" names the scene "ders", which ui.scenes does not have',
      'rutin: facet "ton": tone must be calm, focus or energy',
    ]);
    expect(() => checkedFacets(def, [SABAH, SABAH])).toThrow(FacetError);
    expect(facetProblems(def, "sabah")).toEqual(["rutin: facets must return a list"]);
  });
});

describe("the envelope's facet", () => {
  const proposal = (facet?: string | null): WorkProposal => ({
    schema: 1,
    key: "k",
    source: { type: "rutin.kayit", id: "8f2c1d7e-3b4a-4c5d-9e6f-0a1b2c3d4e5f" },
    title: "Esneme",
    ...(facet === undefined ? {} : { facet }),
  });

  it("must be in the module's list; a module without facets gives none", () => {
    expect(parseProposal(proposal("sabah"), [SABAH, AKSAM]).facet).toBe("sabah");
    expect(parseProposal(proposal(null), [SABAH]).facet).toBeNull();
    expect(() => parseProposal(proposal("ogle"), [SABAH, AKSAM])).toThrow(
      'facet: "ogle" is not one of the module\'s facets (sabah, aksam)',
    );
    expect(() => parseProposal(proposal("sabah"))).toThrow("facet: the module has no facets");
    expect(() => parseProposal(proposal("Sabah"), [SABAH])).toThrow(ProposalError);
    expect(facetIssue("x", [])).toBe('"x" is not one of the module\'s facets (none now)');
  });

  it("is a fact only for a module with facets", () => {
    expect(incomingFields(proposal("sabah"), { withFacet: true }).facts.facet).toBe("sabah");
    expect(incomingFields(proposal(), { withFacet: true }).facts.facet).toBeNull();
    expect(incomingFields(proposal()).facts).not.toHaveProperty("facet");
  });

  it("the user's facet is kept; a module's empty facet clears its own", () => {
    const stored = {
      values: { title: "Esneme", facet: "aksam" },
      provenance: { facet: "user" as const },
    };
    const kept = mergeProposal(stored, incomingFields(proposal("sabah"), { withFacet: true }));
    expect(kept.kept).toContain("facet");
    expect(kept.patch).not.toHaveProperty("facet");

    const own = {
      values: { title: "Esneme", facet: "sabah" },
      provenance: { facet: "module" as const },
    };
    const cleared = mergeProposal(own, incomingFields(proposal(), { withFacet: true }));
    expect(cleared.patch.facet).toBeNull();
    expect(cleared.changed).toContain("facet");
  });
});

describe("which facet, scene and tone", () => {
  it("a sitting has its own facet, else its item's", () => {
    expect(taskFacet({ facet: "aksam" }, { facet: "sabah" })).toBe("aksam");
    expect(taskFacet({ facet: null }, { facet: "sabah" })).toBe("sabah");
    expect(taskFacet({ facet: null }, null)).toBeNull();
  });

  it("finds a facet only while it is in the list", () => {
    expect(findFacet([SABAH], "sabah")).toBe(SABAH);
    expect(findFacet([SABAH], "aksam")).toBeNull();
    expect(findFacet(null, "sabah")).toBeNull();
  });

  it("the facet's scene when it says yes, else the module's scene when it says yes", () => {
    expect(chooseScene(def.ui, SABAH, "kayit")).toBe(GUNES);
    expect(chooseScene(def.ui, AKSAM, "kayit")).toBe(GECE);
    // A facet without a scene, or no facet: the module's default, by its own `when`.
    expect(chooseScene(def.ui, { ...SABAH, scene: undefined }, "odak")).toBe(ODAK);
    expect(chooseScene(def.ui, null, "odak")).toBe(ODAK);
    expect(chooseScene(def.ui, null, "kayit")).toBeNull();
    // A facet scene that says no, or throws, falls back to the default.
    const no = { ...def.ui, scenes: { gunes: scene(() => false) } };
    expect(chooseScene(no, SABAH, "odak")).toBe(ODAK);
    const throws = {
      ...def.ui,
      scenes: {
        gunes: scene(() => {
          throw new Error("x");
        }),
      },
    };
    expect(chooseScene(throws, SABAH, "kayit")).toBeNull();
    // A module without scenes at all.
    expect(chooseScene({}, SABAH, "kayit")).toBeNull();
  });

  it("the tone: the facet's, else the scene's, else calm", () => {
    expect(sceneTone(GUNES, SABAH)).toBe("energy");
    expect(sceneTone(GUNES, AKSAM)).toBe("calm");
    expect(
      sceneTone(
        scene(() => true),
        null,
      ),
    ).toBe("calm");
  });
});
