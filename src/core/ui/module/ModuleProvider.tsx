"use client";

import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useDb, useRegistry } from "@/core/app/CoreProvider";
import type { KnownModule } from "@/core/app/hooks";
import type { ModuleDefinition, ModuleUiContext } from "@/core/contract/types";
import { createModuleContext } from "@/core/data/context";
import type { ModuleRow } from "@/core/types";
import { useQuickAdd } from "../QuickAdd";

// What a module's own screens stand in: its row, its definition and its context.
// A module component calls `useModule()` and has everything the contract gives it.

export type ModuleScope = {
  row: ModuleRow;
  definition: ModuleDefinition | undefined;
  /** The data context plus what the shell can do (open quick add, go to a sub page). */
  ctx: ModuleUiContext;
};

const ModuleScopeContext = createContext<ModuleScope | null>(null);

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
  const { row, definition } = mod;

  return useMemo(
    () => ({
      row,
      definition,
      ctx: {
        ...createModuleContext({ db, registry, module: row }),
        openIntake: (key: string) => quickAdd.open({ moduleSlug: row.slug, intakeKey: key }),
        navigate: (path: string) => router.push(`/m/${row.slug}/${path.replace(/^\/+/, "")}`),
      },
    }),
    [db, registry, router, quickAdd, row, definition],
  );
}

export function ModuleProvider({ mod, children }: { mod: KnownModule; children: ReactNode }) {
  const scope = useModuleScope(mod);
  return <ModuleScopeContext.Provider value={scope}>{children}</ModuleScopeContext.Provider>;
}
