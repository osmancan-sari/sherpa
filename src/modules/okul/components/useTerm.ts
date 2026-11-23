"use client";

import { useRefreshAll } from "@/core/app/actions";
import { useModuleQuery } from "@/core/app/hooks";
import { type ComponentType, createContext, createElement, useContext } from "react";
import type { ModuleUiContext } from "@/core/contract/types";
import { useModule } from "@/core/ui/module/ModuleProvider";
import { SAVE_FAILED, useNotify } from "@/core/ui/Notices";
import { loadTerm } from "../queries";
import { rowsOf } from "../server/pages";

/**
 * The active term with the core's side of the module's work (efforts, sittings), read once per
 * data change and shared by the module's pages.
 */
export function useTerm() {
  const { row } = useModule();
  return useModuleQuery(row, ["term"], async (ctx) => {
    const [data, items, tasks] = await Promise.all([
      loadTerm(ctx),
      ctx.work.items(),
      ctx.work.tasks(),
    ]);
    return { data, items, tasks, rows: rowsOf(data, items) };
  });
}

/**
 * The module's context where the core gives it in props (a scene, a block view) rather than
 * through the module page's provider: the forms inside take it from here.
 */
export const OkulContext = createContext<ModuleUiContext | null>(null);

/** Runs a write of the module's, then refreshes every screen; a failure says so in one line. */
export function useWrite() {
  const given = useContext(OkulContext);
  if (!given) throw new Error("okul: a form outside the module's context");
  const ctx: ModuleUiContext = given;
  const refreshAll = useRefreshAll();
  const notify = useNotify();
  return async (write: (context: ModuleUiContext) => Promise<unknown>): Promise<boolean> => {
    try {
      await write(ctx);
      await refreshAll();
      return true;
    } catch {
      notify(SAVE_FAILED);
      return false;
    }
  };
}

/** A page of the module page: its context for the forms inside (`useWrite`). */
export function withOkul<P extends object>(Inner: ComponentType<P>): ComponentType<P> {
  function Page(props: P) {
    const { ctx } = useModule();
    return createElement(OkulContext.Provider, { value: ctx }, createElement(Inner, props));
  }
  Page.displayName = `Okul(${Inner.displayName ?? Inner.name})`;
  return Page;
}
