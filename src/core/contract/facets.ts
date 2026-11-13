import type { ModuleContext, ModuleDefinition, ModuleFacet, ModuleScene } from "./types";

// A module's facets (docs/06-modul-sozlesmesi.md, "Bölümler"; Ç3e), as pure functions: the
// spelling of a key, the checks of a computed list, which facet a piece of work is in, and which
// scene and tone it runs with. No database and no React here.

/** Lower-case letters, digits and dashes, at most 40; the database checks the same. */
export const FACET_KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const TONES = ["calm", "focus", "energy"] as const;

/** Everything wrong with a computed facet list, as plain sentences. Empty when it is fine. */
export function facetProblems(def: Pick<ModuleDefinition, "slug" | "ui">, list: unknown): string[] {
  const problems: string[] = [];
  const say = (text: string) => problems.push(`${def.slug}: ${text}`);
  if (!Array.isArray(list)) {
    say("facets must return a list");
    return problems;
  }
  const seen = new Set<string>();
  for (const facet of list as Partial<ModuleFacet>[]) {
    const key = typeof facet?.key === "string" ? facet.key : "";
    if (!FACET_KEY.test(key)) say(`facet key "${key}" is not valid`);
    if (seen.has(key)) say(`facet key "${key}" is used twice`);
    seen.add(key);
    if (typeof facet?.name !== "string" || !facet.name.trim()) say(`facet "${key}" has no name`);
    if (typeof facet?.color !== "string" || !HEX_COLOR.test(facet.color)) {
      say(`facet "${key}": color must be a #rrggbb value`);
    }
    if (facet?.scene !== undefined && !def.ui.scenes?.[facet.scene]) {
      say(`facet "${key}" names the scene "${facet.scene}", which ui.scenes does not have`);
    }
    if (facet?.tone !== undefined && !(TONES as readonly string[]).includes(facet.tone)) {
      say(`facet "${key}": tone must be calm, focus or energy`);
    }
  }
  return problems;
}

export class FacetError extends Error {
  constructor(readonly problems: string[]) {
    super(`Facet problems:\n- ${problems.join("\n- ")}`);
    this.name = "FacetError";
  }
}

/** Throws FacetError when the list is not a valid facet list; returns it typed otherwise. */
export function checkedFacets(
  def: Pick<ModuleDefinition, "slug" | "ui">,
  list: unknown,
): ModuleFacet[] {
  const problems = facetProblems(def, list);
  if (problems.length > 0) throw new FacetError(problems);
  return list as ModuleFacet[];
}

/**
 * The module's facet list now, checked; null for a module without facets. Throws FacetError for
 * a list that breaks the contract, and whatever the module's own function throws.
 */
export async function computeFacets(
  def: Pick<ModuleDefinition, "slug" | "ui" | "facets"> | undefined,
  ctx: ModuleContext,
): Promise<ModuleFacet[] | null> {
  if (!def?.facets) return null;
  return checkedFacets(def, await def.facets(ctx));
}

/**
 * The issue with a proposal's facet against the module's list, or null when it is fine.
 * `facets` is null for a module that has none.
 */
export function facetIssue(
  facet: string | null | undefined,
  facets: readonly ModuleFacet[] | null,
): string | null {
  if (facet === null || facet === undefined) return null;
  if (!facets) return "the module has no facets";
  if (facets.some((row) => row.key === facet)) return null;
  const known = facets.map((row) => row.key).join(", ");
  return `"${facet}" is not one of the module's facets (${known || "none now"})`;
}

/** The facet a sitting is in: its own, else its work item's. */
export function taskFacet(
  task: { facet?: string | null },
  item: { facet?: string | null } | null | undefined,
): string | null {
  return task.facet ?? item?.facet ?? null;
}

/** A facet key's entry in the module's current list; null when it is not (or no longer) there. */
export function findFacet(
  facets: readonly ModuleFacet[] | null | undefined,
  key: string | null | undefined,
): ModuleFacet | null {
  if (!key || !facets) return null;
  return facets.find((facet) => facet.key === key) ?? null;
}

/**
 * The scene the running work gets (docs/06, "Bölümler" rule 5): its facet's scene when it has
 * one and that scene says yes; otherwise the module's default scene when it says yes. A `when`
 * that throws counts as no.
 */
export function chooseScene<S>(
  ui: { scene?: ModuleScene; scenes?: Record<string, ModuleScene> },
  facet: ModuleFacet | null,
  subject: S,
): ModuleScene | null {
  const says = (scene: ModuleScene | undefined) => {
    if (!scene) return false;
    try {
      return (scene.when as (subject: S) => boolean)(subject) === true;
    } catch {
      return false;
    }
  };
  const named = facet?.scene ? ui.scenes?.[facet.scene] : undefined;
  if (says(named)) return named!;
  if (says(ui.scene)) return ui.scene!;
  return null;
}

/** The scene frame's tone: the facet's, else the scene's, else calm. */
export function sceneTone(
  scene: ModuleScene,
  facet: ModuleFacet | null,
): "calm" | "focus" | "energy" {
  return facet?.tone ?? scene.look?.tone ?? "calm";
}
