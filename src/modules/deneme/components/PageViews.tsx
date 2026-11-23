"use client";

import { useModuleQuery } from "@/core/app/hooks";
import type { ModuleFacetViewProps } from "@/core/contract/types";
import { EmptyState, ErrorState, ListRow, Panel } from "@/core/ui/kit";
import { useModule } from "@/core/ui/module/ModuleProvider";
import { type DenemeItem, KIND_LABEL, listItems } from "../queries";

// Okul çekirdek A: the module page's own shape (`ui.page`), switched on by the module's setting
// "Sayfa: ana sayfalı" (module.ts). Its home lists every open record by date, as a school module
// lists the term's work; a facet's page lists the records of that facet (a topic's own record).

const byDate = (a: DenemeItem, b: DenemeItem) =>
  (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999") || a.title.localeCompare(b.title);

function line(item: DenemeItem): string {
  return [KIND_LABEL[item.kind as keyof typeof KIND_LABEL] ?? item.kind, item.due_on ?? "tarih yok"]
    .filter(Boolean)
    .join(" · ");
}

/** The home entry ("Ana sayfa"): every open record, by date. */
export function DenemeHome() {
  const { row } = useModule();
  const items = useModuleQuery(row, ["items"], listItems);
  if (items.isError) return <ErrorState onRetry={() => void items.refetch()} />;
  if (items.isLoading) return null;
  const open = (items.data ?? []).filter((item) => !item.done && item.kind !== "konu").sort(byDate);
  return (
    <Panel variant="dense" label="Bütün kayıtlar" data-testid="deneme-home" className="pb-1.5">
      {open.length === 0 ? (
        <EmptyState>Açık kayıt yok.</EmptyState>
      ) : (
        <ul>
          {open.map((item) => (
            <li key={item.id} className="border-line border-t">
              <ListRow
                href={`/m/deneme/kayit/${item.id}`}
                title={item.title}
                subtitle={line(item)}
                className="border-b-0 px-4 md:px-4.5"
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** A facet's page: the records of the facet (a topic is a facet of its own record). */
export function DenemeFacetView({ facet }: ModuleFacetViewProps) {
  const { row } = useModule();
  const items = useModuleQuery(row, ["items"], listItems);
  if (items.isError) return <ErrorState onRetry={() => void items.refetch()} />;
  if (items.isLoading) return null;
  const mine = (items.data ?? [])
    .filter(
      (item) =>
        !item.done && (item.facet === facet.key || `konu-${item.id.slice(0, 8)}` === facet.key),
    )
    .sort(byDate);
  return (
    <Panel
      variant="dense"
      label={facet.name}
      data-testid="deneme-facet-view"
      data-facet={facet.key}
      className="pb-1.5"
    >
      {mine.length === 0 ? (
        <EmptyState>Bu bölümde açık kayıt yok.</EmptyState>
      ) : (
        <ul>
          {mine.map((item) => (
            <li key={item.id} className="border-line border-t">
              <ListRow
                dot={facet.color}
                href={`/m/deneme/kayit/${item.id}`}
                title={item.title}
                subtitle={line(item)}
                className="border-b-0 px-4 md:px-4.5"
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
