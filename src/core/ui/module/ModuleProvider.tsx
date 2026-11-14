"use client";

import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useDb, useRegistry } from "@/core/app/CoreProvider";
import type { KnownModule } from "@/core/app/hooks";
import { postAi } from "@/core/ai/client";
import type {
  ExtractResult,
  ModuleDefinition,
  ModuleUiContext,
  SceneChain,
} from "@/core/contract/types";
import { createModuleContext } from "@/core/data/context";
import type { ModuleRow } from "@/core/types";
import { useSay } from "@/core/voice";
import { useQuickAdd } from "../QuickAdd";
import { useDayChains } from "../today/chains";

// What a module's own screens stand in: its row, its definition and its context.
// A module component calls `useModule()` and has everything the contract gives it.

export type ModuleScope = {
  row: ModuleRow;
  definition: ModuleDefinition | undefined;
  /** The data context plus what the shell can do (open quick add, go to a sub page). */
  ctx: ModuleUiContext;
};

const ModuleScopeContext = createContext<ModuleScope | null>(null);

/**
 * Ç3g: today's wake and bed chains, read only, as this module's page sees them: every module's
 * work in the chain's order with only the fields of `SceneChain` (another module's row carries
 * its name, module, facet, colour, minutes and state, nothing else); `mine` marks this module's.
 */
export function useModuleChains(): { wake: SceneChain | null; bed: SceneChain | null } {
  const { row } = useModule();
  return useDayChains(row.id);
}

export function useModule(): ModuleScope {
  const scope = useContext(ModuleScopeContext);
  if (!scope) throw new Error("useModule() is only available inside a module's own screens.");
  return scope;
}

/** Builds the scope of one module; also used outside the module page (settings). */
export function useModuleScope(mod: KnownModule): ModuleScope {
  const db = useDb();
  const registry = useRegistry();
  const router = useRouter();
  const quickAdd = useQuickAdd();
  const say = useSay();
  const { row, definition } = mod;

  return useMemo(
    () => ({
      row,
      definition,
      ctx: {
        ...createModuleContext({ db, registry, module: row }),
        openIntake: (key: string) => quickAdd.open({ moduleSlug: row.slug, intakeKey: key }),
        navigate: (path: string) => router.push(`/m/${row.slug}/${path.replace(/^\/+/, "")}`),
        say,
        extract: async <T,>(
          extractor: string,
          text: string,
          options: { publishedAt?: string | null; context?: Record<string, unknown> } = {},
        ): Promise<ExtractResult<T>> => {
          const outcome = await postAi<ExtractResult<T>>("extract", {
            module: row.slug,
            extractor,
            text,
            ...options,
          });
          return outcome ?? { status: "failed", reason: "unreachable" };
        },
      },
    }),
    [db, registry, router, quickAdd, say, row, definition],
  );
}

export function ModuleProvider({ mod, children }: { mod: KnownModule; children: ReactNode }) {
  const scope = useModuleScope(mod);
  return <ModuleScopeContext.Provider value={scope}>{children}</ModuleScopeContext.Provider>;
}
