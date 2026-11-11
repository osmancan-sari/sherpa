"use client";

import { Check, Play } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  useCloseWorkItem,
  useCompleteTask,
  useLogRhythm,
  useRefreshAll,
  useStartSession,
} from "@/core/app/actions";
import {
  type KnownModule,
  useModuleQuery,
  useNow,
  useRhythmLogs,
  useRhythms,
  useSessions,
  useTasks,
  useWorkItems,
} from "@/core/app/hooks";
import type { ChipData, Health, ModuleReport } from "@/core/contract/types";
import { type Candidate, minutesPerWeek, moduleUpcoming } from "@/core/today/select";
import {
  dayKey,
  formatDue,
  formatMinutes,
  inIstanbul,
  istanbulInstant,
  shiftDay,
  weekStart,
} from "@/lib/date";
import { cn } from "@/lib/utils";
import { BarChart } from "../kit";
import { SAVE_FAILED, useNotify } from "../Notices";
import { useQuickAdd } from "../QuickAdd";
import { sessionTargetOf } from "../today/NowCard";
import { useModule } from "./ModuleProvider";

// The frame every module page shares (docs/05-arayuz.md, "Modül sayfası iskeleti"). Five
// regions, always in this order; the module fills them and is free inside the body.
//   1. status strip   2. upcoming   3. body (tabs)   4. history and trend   5. entry and settings

const HEALTH_LABEL: Record<Health, string> = {
  ok: "yolunda",
  attention: "dikkat",
  behind: "geride",
};

function shortDay(day: string): string {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(
    inIstanbul(istanbulInstant(day, "12:00")),
  );
}

export function ModulePageShell({ mod, tabKey }: { mod: KnownModule; tabKey: string | null }) {
  const { row, definition } = mod;
  const tabs = definition?.ui.tabs ?? [];
  const active = tabs.find((tab) => tab.key === tabKey) ?? tabs[0];
  const Body = active?.component;
  const History = definition?.ui.history;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-6 md:px-10 md:py-8">
      <StatusStrip mod={mod} />
      <Upcoming mod={mod} />

      <section aria-label="Gövde" className="flex flex-col gap-4">
        {tabs.length > 1 ? (
          <nav aria-label="Sekmeler" className="border-border flex gap-1 overflow-x-auto border-b">
            {tabs.map((tab) => {
              const current = tab.key === active?.key;
              return (
                <Link
                  key={tab.key}
                  href={tab.key === tabs[0].key ? `/m/${row.slug}` : `/m/${row.slug}/${tab.key}`}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring/50 -mb-px flex min-h-11 items-center border-b-2 px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-3 md:min-h-9",
                    current
                      ? "border-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground border-transparent",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
        {Body ? (
          <Body params={{}} />
        ) : (
          <p className="text-muted-foreground text-sm">Bu modülün kendi görünümü yok.</p>
        )}
      </section>

      <section aria-label="Geçmiş ve gidişat" className="flex flex-col gap-3">
        <RegionTitle>Geçmiş</RegionTitle>
        {History ? <History /> : <WeeklyMinutes mod={mod} />}
      </section>

      <EntryAndSettings mod={mod} />
    </div>
  );
}

function RegionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
      {children}
    </h2>
  );
}

/** Region 1: one sentence of status, its health, the week's numbers; quick actions beside it. */
function StatusStrip({ mod }: { mod: KnownModule }) {
  const { row, definition } = mod;
  const { ctx } = useModule();
  const now = useNow();
  const notify = useNotify();
  const refreshAll = useRefreshAll();
  const week = useMemo(() => {
    const from = weekStart(dayKey(now));
    return { from, to: shiftDay(from, 6) };
  }, [now]);

  const chip = useModuleQuery<ChipData | null>(row, ["chip"], async (context) =>
    definition ? definition.chip(context) : null,
  );
  const report = useModuleQuery<ModuleReport | null>(row, ["report", week.from], async (context) =>
    definition ? definition.weeklyReport(context, week) : null,
  );

  const run = async (
    action: NonNullable<NonNullable<typeof definition>["ui"]["actions"]>[number],
  ) => {
    try {
      await action.run(ctx);
      await refreshAll();
    } catch {
      notify(SAVE_FAILED);
    }
  };

  return (
    <section aria-label="Durum" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-3 text-xl font-semibold tracking-tight md:text-2xl">
            <span
              aria-hidden
              className="size-3 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            {row.name}
          </h1>
          <p className="text-muted-foreground min-h-5 text-sm md:text-base">
            {row.status === "paused" ? "Duraklatıldı · " : ""}
            {chip.data?.text}
            {chip.data && chip.data.health !== "ok" ? (
              <span className={cn("ml-2 text-xs", `health-${chip.data.health}`)}>
                {HEALTH_LABEL[chip.data.health]}
              </span>
            ) : null}
          </p>
        </div>

        {definition && (definition.ui.actions?.length || definition.ui.fullscreen?.length) ? (
          <div role="toolbar" aria-label="Hızlı eylemler" className="flex flex-wrap gap-2">
            {(definition.ui.actions ?? []).map((action) => (
              <Button
                key={action.key}
                variant="outline"
                className="h-11 md:h-9"
                onClick={() => void run(action)}
              >
                {action.label}
              </Button>
            ))}
            {(definition.ui.fullscreen ?? []).map((view) => (
              <Link
                key={view.key}
                href={`/m/${row.slug}/tam/${view.key}`}
                className="border-border hover:bg-muted focus-visible:ring-ring/50 flex h-11 items-center rounded-lg border px-2.5 text-sm font-medium outline-none focus-visible:ring-3 md:h-9"
              >
                {view.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {report.data && report.data.metrics.length > 0 ? (
        <dl aria-label="Bu hafta" className="flex flex-wrap gap-x-8 gap-y-2">
          {report.data.metrics.map((metric) => (
            <div key={metric.label} className="flex flex-col">
              <dt className="text-muted-foreground text-xs">{metric.label}</dt>
              <dd className="text-lg font-medium tabular-nums">{metric.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {report.data?.suggestions.slice(0, 2).map((suggestion) => (
        <p key={suggestion} className="text-muted-foreground text-sm">
          {suggestion}
        </p>
      ))}
    </section>
  );
}

/** Region 2: the module's next work, in date order. */
function Upcoming({ mod }: { mod: KnownModule }) {
  const now = useNow();
  const tasks = useTasks();
  const workItems = useWorkItems();
  const rhythms = useRhythms();
  const rhythmLogs = useRhythmLogs();

  const list = useMemo(
    () =>
      moduleUpcoming({
        moduleId: mod.row.id,
        tasks: tasks.data ?? [],
        workItems: workItems.data ?? [],
        rhythms: rhythms.data ?? [],
        rhythmLogs: rhythmLogs.data ?? [],
        now,
      }),
    [mod.row.id, tasks.data, workItems.data, rhythms.data, rhythmLogs.data, now],
  );

  return (
    <section aria-label="Yaklaşanlar" className="flex flex-col gap-3">
      <RegionTitle>Yaklaşanlar</RegionTitle>
      {list.length === 0 ? (
        <p className="text-muted-foreground text-sm">Bu modülde sırada iş yok.</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-xl border">
          {list.map((candidate) => (
            <UpcomingRow
              key={`${candidate.type}-${candidate.id}`}
              candidate={candidate}
              now={now}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function UpcomingRow({ candidate, now }: { candidate: Candidate; now: Date }) {
  const start = useStartSession();
  const complete = useCompleteTask();
  const logRhythm = useLogRhythm();
  const closeItem = useCloseWorkItem();

  const item = candidate.item;
  const parts = [
    candidate.type === "item" && item?.effort_total_minutes
      ? `${formatMinutes(item.effort_done_minutes)} / ${formatMinutes(item.effort_total_minutes)}`
      : formatMinutes(candidate.minutes),
    candidate.progress,
    candidate.dueAt ? formatDue(candidate.dueAt, now) : null,
    candidate.task?.status === "waiting" ? "bekliyor" : null,
  ].filter(Boolean);

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate font-medium">{candidate.title}</p>
        <p className="text-muted-foreground truncate text-sm tabular-nums">{parts.join(" · ")}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          className="size-11 md:size-9"
          aria-label={`Başla: ${candidate.title}`}
          title="Başla"
          onClick={() => start.mutate(sessionTargetOf(candidate))}
        >
          <Play aria-hidden />
        </Button>
        {candidate.type === "task" ? (
          <Button
            variant="ghost"
            className="size-11 md:size-9"
            aria-label={`Bitti: ${candidate.title}`}
            title="Bitti"
            onClick={() => complete.mutate(candidate.id)}
          >
            <Check aria-hidden />
          </Button>
        ) : null}
        {candidate.type === "rhythm" ? (
          <Button
            variant="ghost"
            className="size-11 md:size-9"
            aria-label={`Yapıldı: ${candidate.title}`}
            title="Yapıldı"
            onClick={() => logRhythm.mutate(candidate.id)}
          >
            <Check aria-hidden />
          </Button>
        ) : null}
        {candidate.type === "item" ? (
          <>
            <Button
              variant="outline"
              className="h-11 md:h-9"
              aria-label={`Kalemi bitir: ${candidate.title}`}
              onClick={() => closeItem.mutate({ itemId: candidate.id, result: "done" })}
            >
              Bitti
            </Button>
            <Button
              variant="ghost"
              className="h-11 md:h-9"
              aria-label={`Kalemi bırak: ${candidate.title}`}
              onClick={() => closeItem.mutate({ itemId: candidate.id, result: "dropped" })}
            >
              Bırak
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
}

/** Region 4, when the module has no view of its own: time spent per week. */
function WeeklyMinutes({ mod }: { mod: KnownModule }) {
  const now = useNow();
  const sessions = useSessions();
  const data = useMemo(
    () =>
      minutesPerWeek(sessions.data ?? [], mod.row.id, now).map((week) => ({
        label: shortDay(week.weekStart),
        value: week.minutes,
      })),
    [sessions.data, mod.row.id, now],
  );
  if (data.every((week) => week.value === 0)) {
    return <p className="text-muted-foreground text-sm">Son 8 haftada kayıtlı oturum yok.</p>;
  }
  return (
    <BarChart
      title={`${mod.row.name}: haftalık harcanan süre`}
      data={data}
      unit="dk"
      color={mod.row.color}
    />
  );
}

/** Region 5: the module's own entries, and the way to its settings. */
function EntryAndSettings({ mod }: { mod: KnownModule }) {
  const quickAdd = useQuickAdd();
  const { row, definition } = mod;
  return (
    <section aria-label="Giriş ve ayarlar" className="flex flex-col gap-3">
      <RegionTitle>Giriş ve ayarlar</RegionTitle>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="h-11 md:h-9"
          onClick={() => quickAdd.open({ moduleSlug: row.slug })}
        >
          İş ekle
        </Button>
        {(definition?.intake ?? []).map((type) => (
          <Button
            key={type.key}
            variant="outline"
            className="h-11 md:h-9"
            onClick={() => quickAdd.open({ moduleSlug: row.slug, intakeKey: type.key })}
          >
            {type.label} ekle
          </Button>
        ))}
        <Link
          href={`/ayarlar/moduller/${row.slug}`}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex h-11 items-center rounded-lg px-2.5 text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 md:h-9"
        >
          Modül ayarları
        </Link>
      </div>
    </section>
  );
}
