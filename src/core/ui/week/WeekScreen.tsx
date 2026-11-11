"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type KnownModule,
  useHorizonReviews,
  useModules,
  useTodayPlan,
  useWeeklyReviews,
} from "@/core/app/hooks";
import { useRecommitWeek, useSetLifeMode } from "@/core/app/plan-actions";
import { weekInput } from "@/core/data/keep";
import { dayCapacity, lifeModeOn, loadByWeek, readShares, type WeekLoad } from "@/core/planner";
import { blocksOfDay } from "@/core/today/select";
import type { LifeMode } from "@/core/types";
import { dayKey, formatDue, formatMinutes, shiftDay, weekStart } from "@/lib/date";
import { cn } from "@/lib/utils";
import { ClientOnly } from "../ClientOnly";
import { useNotify } from "../Notices";
import { MODE_LABEL } from "../today/DayParts";
import { LoadFailed } from "../today/TodayScreen";

// The week (docs/05-arayuz.md, "Hafta"): the seven days with their blocks and usable time, the
// week's capacity against what the modules want, the week's items and module budgets, the life
// mode, and the load of the coming eight weeks.

const WEEKS_AHEAD = 8;
const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export function WeekScreen() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-5 py-6 md:px-10 md:py-8">
      <ClientOnly
        fallback={<h1 className="text-xl font-semibold tracking-tight md:text-2xl">Hafta</h1>}
      >
        <WeekBody />
      </ClientOnly>
    </div>
  );
}

function WeekBody() {
  const { modules } = useModules();
  const { input, rows, failed, retry, now } = useTodayPlan();
  const recommit = useRecommitWeek();
  const notify = useNotify();
  const moduleMap = useMemo(() => new Map(modules.map((mod) => [mod.row.id, mod])), [modules]);

  const date = input?.date;
  const loads = useMemo(() => {
    if (!rows) return null;
    return loadByWeek(weekInput(rows, now), {
      from: weekStart(date ?? dayKey(now)),
      weeks: WEEKS_AHEAD,
    });
  }, [rows, now, date]);

  if (failed) {
    return (
      <>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Hafta</h1>
        <LoadFailed onRetry={retry} />
      </>
    );
  }
  if (!input || !rows || !loads) {
    return <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Hafta</h1>;
  }

  const week = weekStart(input?.date ?? dayKey(now));
  const plan = rows.weekPlans.find((row) => row.week_start === week);
  const shares = readShares(plan?.shares);
  const budgets = (plan?.module_budgets ?? {}) as Record<string, number>;
  const [thisWeek] = loads;

  return (
    <>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Hafta</h1>
        <Button
          variant="outline"
          className="h-11 md:h-9"
          disabled={recommit.isPending}
          onClick={() =>
            recommit.mutate(new Date(), { onSuccess: () => notify("Hafta yeniden kuruldu.") })
          }
        >
          Haftayı yeniden kur
        </Button>
      </header>

      <DayStrip week={week} rows={rows} input={input} now={now} />

      <CapacityBar load={thisWeek} modules={moduleMap} />

      <section aria-label="Haftanın kalemleri" className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Haftanın kalemleri
        </h2>
        {!plan || plan.committed.length === 0 ? (
          <p className="text-muted-foreground text-sm">Bu hafta için taahhüt edilen kalem yok.</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-xl border">
            {plan.committed.map((id) => {
              const item = rows.workItems.find((row) => row.id === id);
              const share = shares[id];
              if (!item || !share) return null;
              const worked = Math.max(0, item.effort_done_minutes - share.from);
              const mod = moduleMap.get(item.module_id);
              return (
                <li key={id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: mod?.row.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="text-muted-foreground truncate text-sm tabular-nums">
                      {[
                        mod?.row.name,
                        `${formatMinutes(Math.min(worked, share.minutes))} / ${formatMinutes(share.minutes)} bu hafta`,
                        item.due_at ? formatDue(item.due_at, now) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {Object.keys(budgets).length > 0 ? (
          <p className="text-muted-foreground text-sm">
            Modül payları:{" "}
            {Object.entries(budgets)
              .map(([slug, minutes]) => {
                const mod = modules.find(({ row }) => row.slug === slug);
                return `${mod?.row.name ?? slug} ${formatMinutes(minutes)}`;
              })
              .join(" · ")}
          </p>
        ) : null}
      </section>

      <LifeModePicker rows={rows} today={input.date} />

      <Horizon loads={loads} />

      <AiNotes week={week} month={`${(date ?? dayKey(now)).slice(0, 7)}-01`} />
    </>
  );
}

/** The seven days: fixed blocks and the time left to work in each. */
function DayStrip({
  week,
  rows,
  input,
  now,
}: {
  week: string;
  rows: NonNullable<ReturnType<typeof useTodayPlan>["rows"]>;
  input: NonNullable<ReturnType<typeof useTodayPlan>["input"]>;
  now: Date;
}) {
  const today = input.date;
  return (
    <section aria-label="Haftanın günleri" className="overflow-x-auto">
      <ol className="grid min-w-[42rem] grid-cols-7 gap-2">
        {DAY_NAMES.map((name, index) => {
          const day = shiftDay(week, index);
          const blocks = blocksOfDay(rows.blocks, day).filter(
            (block) => block.status !== "cancelled",
          );
          const usable = Math.round(
            dayCapacity(
              day,
              rows.blocks,
              input.settings,
              input.stats,
              day === today ? { from: now } : {},
            ),
          );
          const past = day < today;
          return (
            <li
              key={day}
              aria-current={day === today ? "date" : undefined}
              className={cn(
                "border-border flex min-h-28 flex-col gap-1 rounded-xl border p-3 text-sm",
                day === today && "border-foreground",
                past && "text-muted-foreground",
              )}
            >
              <p className="font-medium">
                {name} {Number(day.slice(8))}
              </p>
              <p className="text-muted-foreground tabular-nums">
                {past ? "geçti" : formatMinutes(usable)}
              </p>
              {blocks.slice(0, 3).map((block) => (
                <p key={block.id} className="truncate text-xs">
                  {block.title}
                </p>
              ))}
              {blocks.length > 3 ? (
                <p className="text-muted-foreground text-xs">+{blocks.length - 3}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The week's usable time against what the modules want, stacked by module colour. */
function CapacityBar({ load, modules }: { load: WeekLoad; modules: Map<string, KnownModule> }) {
  const scale = Math.max(load.capacityMinutes, load.demandMinutes, 1);
  const parts = Object.entries(load.byModule).filter(([, minutes]) => minutes > 0);
  return (
    <section aria-label="Kapasite" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Kapasite
        </h2>
        <p className="text-sm tabular-nums">
          {formatMinutes(load.demandMinutes)} istenen · {formatMinutes(load.capacityMinutes)}{" "}
          kullanılabilir
        </p>
      </div>
      <div className="bg-muted relative h-6 overflow-hidden rounded-lg">
        <div
          className="absolute inset-y-0 left-0 flex"
          style={{ width: `${(load.demandMinutes / scale) * 100}%` }}
        >
          {parts.map(([moduleId, minutes]) => (
            <span
              key={moduleId}
              title={`${modules.get(moduleId)?.row.name ?? ""} ${formatMinutes(minutes)}`}
              className="h-full"
              style={{
                width: `${(minutes / Math.max(1, load.demandMinutes)) * 100}%`,
                backgroundColor: modules.get(moduleId)?.row.color ?? "var(--muted-foreground)",
              }}
            />
          ))}
        </div>
        <span
          aria-hidden
          className="bg-foreground absolute inset-y-0 w-0.5"
          style={{ left: `${(load.capacityMinutes / scale) * 100}%` }}
        />
      </div>
      <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts.map(([moduleId, minutes]) => (
          <li key={moduleId} className="flex items-center gap-1">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: modules.get(moduleId)?.row.color }}
            />
            {modules.get(moduleId)?.row.name ?? "Modül"} {formatMinutes(minutes)}
          </li>
        ))}
      </ul>
      {load.over ? (
        <div role="note" className="text-sm">
          <p className="health-attention">İstenen süre bu haftanın kapasitesini aşıyor.</p>
          {load.deadlines.length > 0 ? (
            <p className="text-muted-foreground">
              Tehlikedeki son tarihler:{" "}
              {load.deadlines
                .slice(0, 5)
                .map((row) => row.title)
                .join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const MODES: LifeMode[] = ["normal", "busy", "minimum", "holiday"];

/** The life mode, for a range of days. */
function LifeModePicker({
  rows,
  today,
}: {
  rows: NonNullable<ReturnType<typeof useTodayPlan>["rows"]>;
  today: string;
}) {
  const setMode = useSetLifeMode();
  const notify = useNotify();
  const current = lifeModeOn(rows.lifeModes, today);
  const [mode, setModeValue] = useState<LifeMode>(current === "normal" ? "busy" : "normal");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(shiftDay(today, 6));
  const coming = rows.lifeModes.filter((period) => period.ends_on >= today);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (to < from) return;
    setMode.mutate(
      { mode, from, to, existing: rows.lifeModes },
      { onSuccess: () => notify("Hayat modu kaydedildi.") },
    );
  };
  return (
    <section aria-label="Hayat modu" className="flex flex-col gap-3">
      <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        Hayat modu
      </h2>
      <p className="text-sm">
        Bugün: <span className="font-medium">{MODE_LABEL[current]}</span>
        {coming.length > 0
          ? ` · ${coming.map((period) => `${MODE_LABEL[period.mode]} ${period.starts_on.slice(8)}.${period.starts_on.slice(5, 7)}–${period.ends_on.slice(8)}.${period.ends_on.slice(5, 7)}`).join(", ")}`
          : ""}
      </p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Mod
          <select
            value={mode}
            onChange={(event) => setModeValue(event.target.value as LifeMode)}
            className="border-input bg-background h-11 rounded-lg border px-2 md:h-9"
          >
            {MODES.map((value) => (
              <option key={value} value={value}>
                {MODE_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Başlangıç
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="border-input bg-background h-11 rounded-lg border px-2 md:h-9"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Bitiş
          <input
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
            className="border-input bg-background h-11 rounded-lg border px-2 md:h-9"
          />
        </label>
        <Button type="submit" className="h-11 md:h-9" disabled={setMode.isPending || to < from}>
          Kaydet
        </Button>
      </form>
    </section>
  );
}

/** The coming weeks: demand against capacity, and the deadlines each week holds. */
function Horizon({ loads }: { loads: WeekLoad[] }) {
  const scale = Math.max(1, ...loads.flatMap((load) => [load.capacityMinutes, load.demandMinutes]));
  return (
    <section aria-label="Önümüzdeki haftalar" className="flex flex-col gap-3">
      <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        Önümüzdeki {loads.length} hafta
      </h2>
      <ol className="flex flex-col gap-2">
        {loads.map((load) => (
          <li
            key={load.weekStart}
            className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 text-sm"
          >
            <span className="text-muted-foreground tabular-nums">
              {load.weekStart.slice(8)}.{load.weekStart.slice(5, 7)}
            </span>
            <div className="flex flex-col gap-1">
              <div className="bg-muted relative h-3 overflow-hidden rounded">
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded",
                    load.over ? "bg-[var(--health-attention)]" : "bg-foreground/60",
                  )}
                  style={{ width: `${(load.demandMinutes / scale) * 100}%` }}
                />
                <span
                  aria-hidden
                  className="bg-foreground absolute inset-y-0 w-0.5"
                  style={{ left: `${(load.capacityMinutes / scale) * 100}%` }}
                />
              </div>
              <p className="text-muted-foreground truncate text-xs tabular-nums">
                {formatMinutes(load.demandMinutes)} / {formatMinutes(load.capacityMinutes)}
                {load.deadlines.length > 0
                  ? ` · ${load.deadlines.length} son tarih: ${load.deadlines
                      .slice(0, 3)
                      .map((row) => row.title)
                      .join(", ")}`
                  : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

type ReviewSummary = {
  summary?: string;
  suggestions?: string[];
  mode?: { mode: LifeMode; reason: string } | null;
};
type MonthProposal = { text?: string };

/**
 * What the AI said about the week behind (`review`, from Saturday) and the coming weeks
 * (`month`). Nothing without the AI: the screen above is the engine's and complete.
 */
function AiNotes({ week, month }: { week: string; month: string }) {
  const reviews = useWeeklyReviews();
  const horizons = useHorizonReviews();
  const review = reviews.data?.find((row) => row.week_start === week)?.summary as
    ReviewSummary | undefined;
  const proposals = (
    (horizons.data?.find((row) => row.period_start === month)?.proposals ?? []) as MonthProposal[]
  ).filter((row) => row.text);
  if (!review?.summary && proposals.length === 0) return null;
  return (
    <section aria-label="Yapay zekanın notları" className="flex flex-col gap-3">
      <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        Yapay zekanın notları
      </h2>
      {review?.summary ? (
        <div className="flex flex-col gap-1 text-sm">
          <p>{review.summary}</p>
          {(review.suggestions ?? []).map((suggestion) => (
            <p key={suggestion} className="text-muted-foreground">
              {suggestion}
            </p>
          ))}
          {review.mode ? (
            <p className="text-muted-foreground">
              Mod önerisi: {MODE_LABEL[review.mode.mode]}. {review.mode.reason}
            </p>
          ) : null}
        </div>
      ) : null}
      {proposals.length > 0 ? (
        <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
          {proposals.map((row) => (
            <li key={row.text}>{row.text}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
