import "server-only";
import { sizeRequestFor } from "@/core/ai/flows/scope";
import type { AiConfig } from "@/core/ai/types";
import { sizeWorkItem } from "@/core/ai/flows/size";
import type {
  ModuleContext,
  ModuleDefinition,
  ModuleRegistry,
  ProposalResult,
} from "@/core/contract/types";
import { createModuleContext } from "@/core/data/context";
import type { Told } from "@/core/data/session-events";
import type { Db, ModuleRow } from "@/core/types";

// The module context on the server (docs/06-modul-sozlesmesi.md, "Sunucu zemini"): the same
// contract the browser hands a module, with a database client that works in one user's name
// (src/core/server/db.ts, `actAs`). Events published here reach their listeners here, with the
// same kind of context. A proposal is sized at once (`size`), when the AI answers: on the
// server there is no screen to ask it afterwards.

export type ServerDeps = {
  /** A client in the user's name (`actAs`): their rows only. */
  db: Db;
  registry: ModuleRegistry;
  now: () => Date;
  /** The AI's wiring; the gateway decides whether it answers. */
  ai: AiConfig;
};

/** After a proposal: a new or rescoped work item is estimated now. Never fails the proposal. */
function sizer(deps: ServerDeps) {
  return async (result: ProposalResult) => {
    const request = sizeRequestFor(result);
    if (!request) return;
    try {
      await sizeWorkItem({ db: deps.db, config: deps.ai }, deps.registry, request, deps.now());
    } catch (error) {
      // The work is saved; it keeps its bounds until a screen or a later proposal asks again.
      console.error("server size failed", error instanceof Error ? error.message : "unknown");
    }
  };
}

/** What the core's own events need on the server (session-events `tell…`). */
export function serverTold(deps: ServerDeps): Told {
  return { db: deps.db, registry: deps.registry, now: deps.now, onProposed: sizer(deps) };
}

export function serverContext(deps: ServerDeps, row: ModuleRow): ModuleContext {
  return createModuleContext({
    db: deps.db,
    registry: deps.registry,
    module: row,
    now: deps.now,
    onProposed: sizer(deps),
  });
}

/**
 * The module's definition, its row and its server context: only for a module that is
 * registered and switched on for this user. Null otherwise.
 */
export async function activeModule(
  deps: ServerDeps,
  slug: string,
): Promise<{ definition: ModuleDefinition; row: ModuleRow; ctx: ModuleContext } | null> {
  const definition = deps.registry.get(slug);
  if (!definition) return null;
  const { data, error } = await deps.db
    .from("modules")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { definition, row: data, ctx: serverContext(deps, data) };
}
