"use client";

import { useQueries } from "@tanstack/react-query";
import { MODULE, useDb, useRegistry } from "@/core/app/CoreProvider";
import type { KnownModule } from "@/core/app/hooks";
import { createModuleContext } from "@/core/data/context";

// Ç4c (docs/06-modul-sozlesmesi.md, "Akşam kapanışı"): the evening closing is the core's, opened
// inside a scene. A module says it holds it (`hostsClosing`, Rutin: its evening step "Yarının
// listesi" is on). When no active module does, the evening card offers "Kapanış" and the
// closing opens in the standard scene shell. The core knows no module: it only asks.

export function useClosingHost(modules: KnownModule[]): { hosted: boolean; known: boolean } {
  const db = useDb();
  const registry = useRegistry();
  const asking = modules.filter(
    ({ row, definition }) => row.status === "active" && definition?.hostsClosing,
  );
  const answers = useQueries({
    queries: asking.map(({ row, definition }) => ({
      queryKey: [MODULE, row.slug, "hosts-closing", row.updated_at],
      queryFn: async () => {
        try {
          return await definition!.hostsClosing!(
            createModuleContext({ db, registry, module: row }),
          );
        } catch {
          // A module that cannot answer does not hold it: the card keeps its way in.
          return false;
        }
      },
    })),
  });
  const known = answers.every((answer) => answer.isSuccess);
  // While the answers come, the card shows no button rather than one that goes away.
  return { hosted: !known || answers.some((answer) => answer.data === true), known };
}
