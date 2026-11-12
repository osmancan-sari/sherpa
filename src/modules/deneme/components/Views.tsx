"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRefreshAll } from "@/core/app/actions";
import { useModuleQuery } from "@/core/app/hooks";
import type { ModuleViewProps } from "@/core/contract/types";
import { BarChart, EmptyState, NumberStepper, Timer } from "@/core/ui/kit";
import { useModule } from "@/core/ui/module/ModuleProvider";
import { SAVE_FAILED, useNotify } from "@/core/ui/Notices";
import { dayKey, formatMinutes, shiftDay } from "@/lib/date";
import { type DenemeKind, getItem, KIND_LABEL, listItems } from "../queries";
import { settingsOf } from "../rules";

/** Sub page /m/deneme/kayit/:id: one record, and the work the core holds for it. */
export function ItemPage({ params }: ModuleViewProps) {
  const { row } = useModule();
  const detail = useModuleQuery(row, ["item", params.id], async (ctx) => {
    const item = await getItem(ctx, params.id);
    if (!item) return null;
    const work = (await ctx.work.items()).find((candidate) => candidate.key === `item:${item.id}`);
    return { item, work: work ?? null };
  });

  if (detail.isLoading) return null;
  if (!detail.data) return <EmptyState>Bu kayıt yok.</EmptyState>;
  const { item, work } = detail.data;

  const rows: [string, string][] = [
    ["Tür", KIND_LABEL[item.kind as DenemeKind]],
    ["Tarih", item.due_on ?? "—"],
    ["Süre", item.minutes ? formatMinutes(item.minutes) : "belirtilmedi"],
    ["Durum", item.done ? "bitti" : "açık"],
  ];
  if (work) {
    const source = (work.provenance as Record<string, string>).effort_total_minutes;
    rows.push([
      "Çekirdekteki efor",
      work.effort_total_minutes
        ? `${formatMinutes(work.effort_total_minutes)}${source === "default" ? " (varsayılan: sınırın ortası)" : ""}`
        : "—",
    ]);
    rows.push(["Harcanan", formatMinutes(work.effort_done_minutes)]);
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{item.title}</h2>
      <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Region 4 of the module page ("history"): what the finished records cost. */
export function HistoryView() {
  const { row } = useModule();
  const items = useModuleQuery(row, ["items"], listItems);
  // Ç3c: the days' waking and bedtime, read through the context (`ctx.days`).
  const days = useModuleQuery(row, ["days"], (ctx) => ctx.days(shiftDay(dayKey(ctx.now()), -7)));
  const finished = (items.data ?? []).filter((item) => item.done && item.spent_minutes !== null);
  if (items.isLoading) return null;
  const woke = (days.data ?? []).filter((day) => day.wokeAt !== null);
  const dayLine =
    woke.length > 0 ? (
      <p data-testid="deneme-days" className="text-muted-foreground text-sm">
        Son 7 günde uyanış kaydı: {woke.length} gün
      </p>
    ) : null;
  if (finished.length === 0) {
    return (
      <>
        {dayLine}
        <EmptyState>Biten kayıt yok.</EmptyState>
      </>
    );
  }
  return (
    <>
      {dayLine}
      <BarChart
        title="Biten kayıtlara harcanan süre"
        data={finished.slice(-8).map((item) => ({
          label: item.title.slice(0, 10),
          value: item.spent_minutes!,
        }))}
        unit="dk"
        color={row.color}
      />
    </>
  );
}

/** Full-screen view /m/deneme/tam/odak: a countdown, nothing else on the screen. */
export function FocusView() {
  const { ctx } = useModule();
  const [minutes, setMinutes] = useState(settingsOf(ctx).default_minutes ?? 25);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10">
      <Timer label="Odak süresi" startedAt={startedAt} durationSeconds={minutes * 60} />
      {startedAt === null ? (
        <div className="flex flex-col items-center gap-6">
          <NumberStepper
            label="Dakika"
            value={minutes}
            onChange={setMinutes}
            min={5}
            max={90}
            step={5}
            unit="dk"
          />
          <Button
            className="h-12 px-8 text-base"
            onClick={() => setStartedAt(new Date().toISOString())}
          >
            Başlat
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="h-12 px-8 text-base"
          onClick={() => setStartedAt(null)}
        >
          Sıfırla
        </Button>
      )}
    </div>
  );
}

/** The module's own settings form, shown at /ayarlar/moduller/deneme. */
export function SettingsForm() {
  const { ctx } = useModule();
  const notify = useNotify();
  const refreshAll = useRefreshAll();
  const settings = settingsOf(ctx);
  const [minutes, setMinutes] = useState(settings.default_minutes ?? 15);

  const save = async () => {
    try {
      await ctx.saveSettings({ ...settings, default_minutes: minutes });
      await refreshAll();
      notify("Kaydedildi.");
    } catch {
      notify(SAVE_FAILED);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Süresi yazılmayan alışkanlık kayıtlarının oturum uzunluğu.
      </p>
      <NumberStepper
        label="Varsayılan süre"
        value={minutes}
        onChange={setMinutes}
        min={5}
        max={90}
        step={5}
        unit="dk"
      />
      <div>
        <Button className="h-11 md:h-9" onClick={() => void save()}>
          Kaydet
        </Button>
      </div>
    </div>
  );
}
