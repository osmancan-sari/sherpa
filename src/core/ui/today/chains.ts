"use client";

import { useMemo } from "react";
import { type Colors, useColors } from "@/core/app/facets";
import { type KnownModule, useModules, useTodayPlan } from "@/core/app/hooks";
import type { SceneChain } from "@/core/contract/types";
import { type ChainLook, chainsOf, sceneChain } from "@/core/today/chain";

// The day's chains as screens show them (Ç3f, Ç3g): each row's module, resolved colour and facet;
// for a scene (the running work's chain) and for a module's own page (both chains, read only).

/** How a chain's rows look on this screen: the module, the resolved colour, the facet (Ç3f). */
export function chainLook(modules: Map<string, KnownModule>, colors: Colors): ChainLook {
  return {
    module: (moduleId) => {
      const mod = modules.get(moduleId);
      return mod ? { slug: mod.row.slug, name: mod.row.name } : null;
    },
    color: (row) => colors.of(row.moduleId, row.work),
    facet: (row) => {
      const facet = colors.facetOf(row.moduleId, row.work);
      return facet ? { key: facet.key, name: facet.name } : null;
    },
  };
}

/**
 * Ç3g: today's wake and bed chains as a module's page reads them (docs/06-modul-sozlesmesi.md,
 * "Modül sayfasında dizi"): the fields of `SceneChain` only, `mine` for this module's work. Null
 * where the day has no such chain (the frame off, nothing bound to it).
 */
export function useDayChains(moduleId: string): {
  wake: SceneChain | null;
  bed: SceneChain | null;
} {
  const { input, plan } = useTodayPlan();
  const { modules } = useModules();
  const colors = useColors();
  return useMemo(() => {
    if (!input || !plan) return { wake: null, bed: null };
    const look = chainLook(new Map(modules.map((mod) => [mod.row.id, mod])), colors);
    const chains = chainsOf(input, plan);
    return {
      wake: chains.wake ? sceneChain(chains.wake, moduleId, look) : null,
      bed: chains.bed ? sceneChain(chains.bed, moduleId, look) : null,
    };
  }, [input, plan, modules, colors, moduleId]);
}
