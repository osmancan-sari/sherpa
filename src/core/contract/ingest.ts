import type { ModuleDefinition } from "./types";

// What can be written from outside (docs/02-mimari.md, "Cihaz anahtarları ve giriş ucu"): the
// core's own kinds and the modules' `ingest` lists. A scope is written like the address:
// "<source>/<kind>", the source being "core" or a module's slug.

/** The core's own kinds (the handlers are in src/core/server/core-ingest.ts). */
export const CORE_INGEST = [
  { kind: "wake", label: "Uyanış" },
  { kind: "bed", label: "Yatış" },
  { kind: "context", label: "Bağlam" },
] as const;

export const CORE_SOURCE = "core";

/** Lower-case letters, digits and dashes: a module's ingest kind and job key. */
export const PART = /^[a-z0-9-]+$/;

export function scopeOf(source: string, kind: string): string {
  return `${source}/${kind}`;
}

export type ScopeChoice = { scope: string; label: string; source: string };

/**
 * The scopes a new token may be given: the core's kinds, then each listed module's (the screens
 * pass the modules that are switched on).
 */
export function scopeChoices(
  modules: readonly Pick<ModuleDefinition, "slug" | "name" | "ingest">[],
): ScopeChoice[] {
  const core = CORE_INGEST.map(({ kind, label }) => ({
    scope: scopeOf(CORE_SOURCE, kind),
    label,
    source: CORE_SOURCE,
  }));
  const own = modules.flatMap((def) =>
    (def.ingest ?? []).map((type) => ({
      scope: scopeOf(def.slug, type.kind),
      label: `${def.name}: ${type.label ?? type.kind}`,
      source: def.slug,
    })),
  );
  return [...core, ...own];
}
