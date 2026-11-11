"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { sizeAfterProposal } from "@/core/ai/client";
import type { ModuleRegistry } from "@/core/contract/types";
import { ensureBlocksAhead } from "@/core/data/blocks";
import { onProposal } from "@/core/data/propose";
import type { Db } from "@/core/types";
import { createClient } from "@/lib/supabase/client";
import { touchClock } from "./clock";

// Everything the signed-in screens share: the browser's Supabase client, the query cache, the
// module registry and the live connection that keeps the cache fresh on every device.
//
// The registry is handed in from outside (src/app), because the core never imports modules.

type CoreValue = { db: Db; registry: ModuleRegistry };

const CoreContext = createContext<CoreValue | null>(null);

function useCore(): CoreValue {
  const value = useContext(CoreContext);
  if (!value) throw new Error("CoreProvider is missing above this component.");
  return value;
}

/** The browser's Supabase client; row level security makes it see only the user's rows. */
export function useDb(): Db {
  return useCore().db;
}

/** The registered modules. */
export function useRegistry(): ModuleRegistry {
  return useCore().registry;
}

/** Root of every query key the core owns; `["core", <table>]` holds that table's rows. */
export const CORE = "core";
/** Root of every query a module computes (chips, module screens). Any change refreshes them. */
export const MODULE = "module";

/**
 * Safety net next to the live connection (docs/11-yayin-ve-cihazlar.md, "Eşitleme"): queries
 * refresh when the window comes back, when the network returns, and once a minute anyway.
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        // The Supabase client already retries a failed read three times (after 1, 2 and 4
        // seconds). Retrying on top of that would only keep an empty frame on screen for twice
        // as long before the screen says that the data could not be read.
        retry: false,
      },
    },
  });
}

export function CoreProvider({
  registry,
  children,
}: {
  registry: ModuleRegistry;
  children: ReactNode;
}) {
  const [queryClient] = useState(createQueryClient);
  const [db] = useState(() => createClient());
  const value = useMemo(() => ({ db, registry }), [db, registry]);

  return (
    <QueryClientProvider client={queryClient}>
      <CoreContext.Provider value={value}>
        <LiveSync />
        {children}
      </CoreContext.Provider>
    </QueryClientProvider>
  );
}

/**
 * Listens to changes in the database and refreshes the queries they touch. A change made on the
 * phone reaches the second screen through here, without a reload.
 */
function LiveSync() {
  const db = useDb();
  const queryClient = useQueryClient();

  useEffect(() => {
    let subscribedOnce = false;
    const channel = db
      .channel("sherpa-changes")
      .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
        void queryClient.invalidateQueries({ queryKey: [CORE, payload.table] });
        // Chips and module screens are computed from several tables; refresh them all.
        void queryClient.invalidateQueries({ queryKey: [MODULE] });
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // Events may have been missed while the connection was down: refresh everything.
        if (subscribedOnce) void queryClient.invalidateQueries();
        subscribedOnce = true;
      });

    return () => {
      void db.removeChannel(channel);
    };
  }, [db, queryClient]);

  // Fresh data means a fresh "now": elapsed times and "today" are recomputed with every change.
  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") touchClock();
    });
  }, [queryClient]);

  // Keep the coming weeks of every block series filled in. Nothing depends on the user doing
  // anything: opening the app is enough.
  useEffect(() => {
    ensureBlocksAhead(db, new Date())
      .then((created) => {
        if (created > 0) void queryClient.invalidateQueries({ queryKey: [CORE, "blocks"] });
      })
      .catch(() => {
        // Not being able to top up is not worth interrupting anyone; the next visit tries again.
      });
  }, [db, queryClient]);

  // A module's proposal may leave judgement fields empty: the server estimates them (`size`).
  // The answer is written to the work item and arrives through the live connection above; when
  // the request comes back with an estimate the screens re-read as well, in case a change
  // message was lost.
  useEffect(
    () =>
      onProposal((result) => {
        void sizeAfterProposal(result)?.then((outcome) => {
          if ((outcome as { status?: string } | null)?.status !== "applied") return;
          void queryClient.invalidateQueries({ queryKey: [CORE] });
          void queryClient.invalidateQueries({ queryKey: [MODULE] });
        });
      }),
    [queryClient],
  );

  return null;
}
