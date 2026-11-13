"use client";

import { keepPreviousData, useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { facetColor, moduleColor, workColor } from "@/core/contract/colors";
import { computeFacets, findFacet, taskFacet } from "@/core/contract/facets";
import type { ModuleFacet, SceneProps } from "@/core/contract/types";
import { createModuleContext } from "@/core/data/context";
import type { Candidate } from "@/core/planner";
import type { Rhythm, Task, WorkItem } from "@/core/types";
import { MODULE, useDb, useRegistry } from "./CoreProvider";
import { type KnownModule, useModules } from "./hooks";

// A module's facets on the screens (docs/06-modul-sozlesmesi.md, "Bölümler"; Ç3e): each list
// is computed with the module's context, like its chip, and keyed under ["module", …] so every
// change in the data refreshes it (a course added, the colours changed on the other device).
// A list that fails to compute or breaks the contract is left out: the module's work then shows
// in the module's colour, and the scene is the module's default.

export type FacetLists = ReadonlyMap<string, readonly ModuleFacet[]>;

/** Facet lists by module id, for the modules that have facets and are not archived. */
export function useFacets(): FacetLists {
  const db = useDb();
  const registry = useRegistry();
  const { modules } = useModules();
  const withFacets = modules.filter(
    ({ row, definition }) => definition?.facets && row.status !== "archived",
  );
  const results = useQueries({
    queries: withFacets.map(({ row, definition }) => ({
      queryKey: [MODULE, row.slug, "facets", row.updated_at],
      queryFn: async () => {
        try {
          return await computeFacets(
            definition,
            createModuleContext({ db, registry, module: row }),
          );
        } catch (error) {
          console.error(`facets of "${row.slug}"`, error);
          throw error;
        }
      },
      retry: false,
      // A changed row (its colours) is a new key: keep the last list meanwhile, so work does
      // not flash back to the module's colour.
      placeholderData: keepPreviousData,
    })),
  });
  const signature = JSON.stringify(
    withFacets.map(({ row }, index) => [row.id, facetListOf(results[index])]),
  );
  return useMemo(() => {
    const entries = JSON.parse(signature) as [string, ModuleFacet[] | null][];
    return new Map(entries.filter((entry): entry is [string, ModuleFacet[]] => entry[1] !== null));
  }, [signature]);
}

/**
 * The list a facet query gives the screens: none while it fails, even when an earlier
 * computation succeeded (a failed refetch keeps its old data; docs/06 "Bölümler" rule 2).
 */
export function facetListOf(
  result: { data?: ModuleFacet[] | null; isError: boolean } | undefined,
): ModuleFacet[] | null {
  if (!result || result.isError) return null;
  return result.data ?? null;
}

/** The facet key of a piece of work: a sitting's own, else its work item's; a rhythm's own. */
export function facetKeyOf(
  work: { task?: Task | null; item?: WorkItem | null; rhythm?: Rhythm | null },
  workItems: readonly WorkItem[] = [],
): string | null {
  if (work.task) {
    const item =
      work.item ??
      (work.task.work_item_id ? workItems.find((row) => row.id === work.task!.work_item_id) : null);
    return taskFacet(work.task, item);
  }
  if (work.item) return work.item.facet;
  if (work.rhythm) return work.rhythm.facet;
  return null;
}

/** A planner candidate's facet key. */
export function candidateFacet(candidate: Candidate, workItems: readonly WorkItem[]) {
  return facetKeyOf(candidate, workItems);
}

export type Colors = {
  /** Module-level places: chips, shares, module lists. */
  module: (moduleId: string | null | undefined) => string;
  /** A piece of work: its facet's colour, else its module's. */
  work: (moduleId: string | null | undefined, facetKey: string | null | undefined) => string;
  /** The work's facet as a scene gets it (colour resolved); null without one in the list. */
  facet: (
    moduleId: string | null | undefined,
    facetKey: string | null | undefined,
  ) => (SceneProps["facet"] & { entry: ModuleFacet }) | null;
  lists: FacetLists;
};

/** The colour resolver with the rows and the facet lists of this screen. */
export function useColors(): Colors {
  const { modules } = useModules();
  const lists = useFacets();
  return useMemo(() => colorsOf(modules, lists), [modules, lists]);
}

/** The resolver over given modules and lists (also for screens that already hold both). */
export function colorsOf(modules: readonly KnownModule[], lists: FacetLists): Colors {
  const byId = new Map(modules.map((mod) => [mod.row.id, mod]));
  return {
    module: (moduleId) => moduleColor(moduleId ? byId.get(moduleId) : null),
    work: (moduleId, facetKey) =>
      workColor(
        moduleId ? byId.get(moduleId) : null,
        moduleId ? lists.get(moduleId) : null,
        facetKey,
      ),
    facet: (moduleId, facetKey) => {
      if (!moduleId) return null;
      const entry = findFacet(lists.get(moduleId), facetKey);
      if (!entry) return null;
      return {
        key: entry.key,
        name: entry.name,
        color: facetColor(byId.get(moduleId)?.row, entry),
        entry,
      };
    },
    lists,
  };
}
