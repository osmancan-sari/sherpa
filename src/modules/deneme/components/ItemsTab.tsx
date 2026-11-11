"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRefreshAll } from "@/core/app/actions";
import { useModuleQuery } from "@/core/app/hooks";
import { type Column, DataTable, EmptyState, ErrorState } from "@/core/ui/kit";
import { useModule } from "@/core/ui/module/ModuleProvider";
import { SAVE_FAILED, useNotify } from "@/core/ui/Notices";
import { type DenemeItem, type DenemeKind, KIND_LABEL, listItems } from "../queries";
import { changeItem, removeItem } from "../rules";

/** First tab: the module's records in a table that is edited in place. */
export function ItemsTab() {
  const { row, ctx } = useModule();
  const notify = useNotify();
  const refreshAll = useRefreshAll();
  const items = useModuleQuery(row, ["items"], listItems);

  const run = async (work: () => Promise<unknown>) => {
    try {
      await work();
    } catch {
      notify(SAVE_FAILED);
    } finally {
      await refreshAll();
    }
  };

  if (items.isError) return <ErrorState onRetry={() => void items.refetch()} />;
  if (items.isLoading) return null;
  if ((items.data ?? []).length === 0) {
    return (
      <EmptyState
        action={
          <Button variant="outline" className="h-11 md:h-9" onClick={() => ctx.openIntake("kayit")}>
            Kayıt ekle
          </Button>
        }
      >
        Henüz kayıt yok.
      </EmptyState>
    );
  }

  const columns: Column<DenemeItem>[] = [
    {
      key: "title",
      header: "Kayıt",
      cell: (item) => item.title,
      text: (item) => item.title,
      edit: {
        value: (item) => item.title,
        label: (item) => `Ad: ${item.title}`,
        onCommit: (item, value) => {
          if (value.trim()) void run(() => changeItem(ctx, item.id, { title: value.trim() }));
        },
      },
    },
    {
      key: "kind",
      header: "Tür",
      cell: (item) => KIND_LABEL[item.kind as DenemeKind],
      text: (item) => KIND_LABEL[item.kind as DenemeKind],
    },
    { key: "due", header: "Tarih", cell: (item) => item.due_on ?? "—" },
    {
      key: "minutes",
      header: "Süre (dk)",
      align: "right",
      cell: (item) => item.minutes ?? "—",
      edit: {
        type: "number",
        value: (item) => (item.minutes === null ? "" : String(item.minutes)),
        label: (item) => `Süre: ${item.title}`,
        onCommit: (item, value) =>
          void run(() =>
            changeItem(ctx, item.id, { minutes: value === "" ? null : Number(value) }),
          ),
      },
    },
    {
      key: "state",
      header: "Durum",
      cell: (item) =>
        item.done
          ? `bitti${item.spent_minutes !== null ? ` · ${item.spent_minutes} dk` : ""}${item.feedback ? ` · ${item.feedback}` : ""}`
          : "açık",
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (item) => (
        <span className="flex justify-end gap-1">
          <Link
            href={`/m/${row.slug}/kayit/${item.id}`}
            className="hover:bg-muted flex h-11 items-center rounded-lg px-2.5 text-sm md:h-8"
            aria-label={`Ayrıntı: ${item.title}`}
          >
            Ayrıntı
          </Link>
          <Button
            variant="ghost"
            className="h-11 md:h-8"
            aria-label={`Sil: ${item.title}`}
            onClick={() => void run(() => removeItem(ctx, item.id))}
          >
            Sil
          </Button>
        </span>
      ),
    },
  ];

  return (
    <DataTable
      caption="Deneme kayıtları"
      columns={columns}
      rows={items.data ?? []}
      rowKey={(item) => item.id}
      filterLabel="Kayıtlarda ara"
    />
  );
}
