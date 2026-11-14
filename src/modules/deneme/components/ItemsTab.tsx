"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRefreshAll } from "@/core/app/actions";
import { useModuleQuery } from "@/core/app/hooks";
import { type Column, DataTable, EmptyState, ErrorState } from "@/core/ui/kit";
import type { SceneChain } from "@/core/contract/types";
import { useModule, useModuleChains } from "@/core/ui/module/ModuleProvider";
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
      <div className="flex flex-col gap-5">
        <EmptyState
          action={
            <Button
              variant="outline"
              className="h-11 md:h-9"
              onClick={() => ctx.openIntake("kayit")}
            >
              Kayıt ekle
            </Button>
          }
        >
          Henüz kayıt yok.
        </EmptyState>
        <DayChains />
      </div>
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
    <div className="flex flex-col gap-5">
      <DataTable
        caption="Deneme kayıtları"
        columns={columns}
        rows={items.data ?? []}
        rowKey={(item) => item.id}
        filterLabel="Kayıtlarda ara"
      />
      <DayChains />
    </div>
  );
}

const STATE: Record<SceneChain["items"][number]["state"], string> = {
  done: "yapıldı",
  running: "şimdi",
  next: "sırada",
  passed: "geçildi",
};

const CHAIN_NAME = { wake: "Bugünün uyanış dizisi", bed: "Bugünün yatış dizisi" } as const;

/**
 * Ç3g: today's chains on the module's page, read only (`useModuleChains`): this module's work and
 * every other module's, each row only its name, module, minutes and state; another module's row
 * leads to that module's page.
 */
function DayChains() {
  const chains = useModuleChains();
  const list = [chains.wake, chains.bed].filter(Boolean) as SceneChain[];
  if (list.length === 0) return null;
  return (
    <div className="flex flex-col gap-3" data-testid="deneme-chains">
      {list.map((chain) => (
        <section key={chain.anchor} aria-label={CHAIN_NAME[chain.anchor]} className="text-sm">
          <h3 className="mb-1 font-medium">{CHAIN_NAME[chain.anchor]}</h3>
          <ol className="flex flex-col gap-1">
            {chain.items.map((item) => (
              <li
                key={item.id}
                data-mine={item.mine ? "true" : "false"}
                className="flex items-center gap-2"
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.mine ? (
                  <span>{item.title}</span>
                ) : (
                  <Link href={`/m/${item.module.slug}`} className="underline underline-offset-4">
                    {item.title}
                  </Link>
                )}
                <span className="text-muted-foreground">
                  {[item.mine ? null : item.module.name, `${item.minutes} dk`, STATE[item.state]]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
