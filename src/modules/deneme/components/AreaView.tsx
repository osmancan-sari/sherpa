"use client";

import { useModuleQuery } from "@/core/app/hooks";
import type { AreaViewProps } from "@/core/contract/types";
import { useModule } from "@/core/ui/module/ModuleProvider";
import { listItems } from "../queries";

/** The record title that makes this view fail on purpose (the area page's error boundary). */
export const BREAKS_THE_VIEW = "Görünümü boz";

// The test module's view on its area's page (Ç4c; docs/06-modul-sozlesmesi.md, "Alan sayfası"):
// its open and done records as two numbers. While a record named "Görünümü boz" is open it
// throws, so the page's rule shows: only its own panel says "Bu görünüm açılamadı.".
export function RecordsView({ device }: AreaViewProps) {
  const { row } = useModule();
  const items = useModuleQuery(row, ["area", "records"], (ctx) => listItems(ctx));
  if (!items.data) return <div className="min-h-12" />;
  if (items.data.some((item) => !item.done && item.title === BREAKS_THE_VIEW)) {
    throw new Error("Deneme: the area view fails on purpose.");
  }
  const open = items.data.filter((item) => !item.done).length;
  return (
    <dl className={device === "pano" ? "flex gap-8" : "flex gap-6"}>
      <div className="flex flex-col">
        <dt className="text-ink-2 text-sm">Açık kayıt</dt>
        <dd className="text-lg font-bold tabular-nums">{open}</dd>
      </div>
      <div className="flex flex-col">
        <dt className="text-ink-2 text-sm">Biten kayıt</dt>
        <dd className="text-lg font-bold tabular-nums">{items.data.length - open}</dd>
      </div>
    </dl>
  );
}
