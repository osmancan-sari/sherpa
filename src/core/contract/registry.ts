import { PART } from "./ingest";
import type { ModuleDefinition, ModuleRegistry } from "./types";

/** Path segments under /m/<slug>/ the core keeps for itself. */
export const RESERVED_SEGMENTS = ["tam"] as const;

const SLUG = /^[a-z][a-z0-9-]*$/;
const KEY = /^[a-z][a-z0-9_-]*$/;

/** Everything wrong with a definition, as plain sentences. Empty when it is fine. */
export function definitionProblems(def: ModuleDefinition): string[] {
  const problems: string[] = [];
  const say = (text: string) => problems.push(`${def.slug || "(no slug)"}: ${text}`);

  if (!SLUG.test(def.slug)) say("slug must be lower-case letters, digits and dashes");
  if (def.slug === "core") say('the slug "core" is reserved for the core\'s own events');
  if (!def.name.trim()) say("name is empty");
  if (!/^#[0-9a-f]{6}$/i.test(def.color)) say("color must be a #rrggbb value");

  if (def.ui.tabs.length === 0) say("at least one tab is needed");
  if (def.ui.scene && (typeof def.ui.scene.when !== "function" || !def.ui.scene.component)) {
    say("a scene needs `when` and a component");
  }
  const segments = new Set<string>();
  for (const tab of def.ui.tabs) {
    if (!KEY.test(tab.key)) say(`tab key "${tab.key}" is not a valid path segment`);
    if ((RESERVED_SEGMENTS as readonly string[]).includes(tab.key)) {
      say(`tab key "${tab.key}" is reserved`);
    }
    if (segments.has(tab.key)) say(`tab key "${tab.key}" is used twice`);
    if (!tab.label.trim()) say(`tab "${tab.key}" has no label`);
    segments.add(tab.key);
  }
  for (const route of def.ui.routes ?? []) {
    const first = route.path.split("/")[0];
    if (!route.path || route.path.startsWith("/")) say(`route "${route.path}" must be relative`);
    if ((RESERVED_SEGMENTS as readonly string[]).includes(first)) {
      say(`route "${route.path}" starts with a reserved segment`);
    }
    if (segments.has(route.path)) say(`route "${route.path}" collides with a tab`);
  }
  for (const group of [def.ui.fullscreen ?? [], def.ui.actions ?? [], def.intake]) {
    const seen = new Set<string>();
    for (const { key } of group) {
      if (!KEY.test(key)) say(`key "${key}" is not valid`);
      if (seen.has(key)) say(`key "${key}" is used twice`);
      seen.add(key);
    }
  }

  for (const intake of def.intake) {
    if (!intake.label.trim()) say(`intake "${intake.key}" has no label`);
  }
  for (const type of def.emits) {
    if (!type.startsWith(`${def.slug}.`)) say(`event "${type}" must start with "${def.slug}."`);
  }
  for (const mode of ["normal", "busy", "minimum", "holiday"] as const) {
    const behavior = def.modeBehavior[mode];
    if (!behavior) {
      say(`mode behaviour for "${mode}" is missing`);
    } else if (behavior.floorMultiplier < 0 || behavior.floorMultiplier > 1) {
      say(`floorMultiplier for "${mode}" must be between 0 and 1`);
    }
  }
  // Ç3d: data from outside and scheduled work.
  const kinds = new Set<string>();
  for (const type of def.ingest ?? []) {
    if (!PART.test(type.kind)) say(`ingest kind "${type.kind}" is not valid`);
    if (kinds.has(type.kind)) say(`ingest kind "${type.kind}" is used twice`);
    if (typeof type.handle !== "function") say(`ingest kind "${type.kind}" has no handler`);
    if (typeof type.schema?.safeParse !== "function") {
      say(`ingest kind "${type.kind}" has no schema`);
    }
    kinds.add(type.kind);
  }
  const jobs = new Set<string>();
  for (const job of def.jobs ?? []) {
    if (!PART.test(job.key)) say(`job key "${job.key}" is not valid`);
    if (jobs.has(job.key)) say(`job key "${job.key}" is used twice`);
    if (!["hour", "day", "week"].includes(job.every)) say(`job "${job.key}" has no valid period`);
    if (job.at !== undefined) {
      if (job.every === "hour") say(`job "${job.key}" runs every hour; "at" is for days and weeks`);
      else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(job.at)) say(`job "${job.key}": "at" is HH:mm`);
    }
    if (typeof job.run !== "function") say(`job "${job.key}" has nothing to run`);
    jobs.add(job.key);
  }
  for (const table of def.tables ?? []) {
    if (!table.startsWith(`${def.slug.replaceAll("-", "_")}_`)) {
      say(`table "${table}" must start with "${def.slug.replaceAll("-", "_")}_"`);
    }
  }
  return problems;
}

/**
 * Builds the registry the core walks. Refuses definitions that break the contract, so a broken
 * module fails at start-up and in the tests instead of somewhere in the interface.
 */
export function createRegistry(definitions: readonly ModuleDefinition[]): ModuleRegistry {
  const problems = definitions.flatMap(definitionProblems);
  const slugs = new Set<string>();
  for (const { slug } of definitions) {
    if (slugs.has(slug)) problems.push(`${slug}: registered twice`);
    slugs.add(slug);
  }
  if (problems.length > 0) {
    throw new Error(`Module contract problems:\n- ${problems.join("\n- ")}`);
  }

  const bySlug = new Map(definitions.map((def) => [def.slug, def]));
  return { list: definitions, get: (slug) => bySlug.get(slug) };
}

/** Matches a path under /m/<slug>/ against a route pattern like 'kayit/:id'. */
export function matchRoute(pattern: string, segments: string[]): Record<string, string> | null {
  const parts = pattern.split("/");
  if (parts.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith(":")) params[parts[i].slice(1)] = segments[i];
    else if (parts[i] !== segments[i]) return null;
  }
  return params;
}

export type ResolvedModulePath =
  | { kind: "tab"; tabKey: string }
  | { kind: "route"; index: number; params: Record<string, string> }
  | { kind: "missing" };

/** What /m/<slug>/<...segments> shows: a tab, a sub page, or nothing. */
export function resolveModulePath(def: ModuleDefinition, segments: string[]): ResolvedModulePath {
  if (segments.length === 0) return { kind: "tab", tabKey: def.ui.tabs[0].key };
  if (segments.length === 1 && def.ui.tabs.some((tab) => tab.key === segments[0])) {
    return { kind: "tab", tabKey: segments[0] };
  }
  const routes = def.ui.routes ?? [];
  for (let index = 0; index < routes.length; index++) {
    const params = matchRoute(routes[index].path, segments);
    if (params) return { kind: "route", index, params };
  }
  return { kind: "missing" };
}
