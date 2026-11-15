"use client";

import { useColors } from "@/core/app/facets";
import { moduleColor } from "@/core/contract/colors";
import { Check, ChevronLeft, Play, X } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
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
import type { ChipData, ModuleReport } from "@/core/contract/types";
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
import { BarChart } from "../kit";
import { Button, buttonVariants, IconButton } from "../kit/Button";
import { Status } from "../kit/Choice";
import { ListRow } from "../kit/ListRow";
import { Panel } from "../kit/Panel";
import { HistoryLink, TabBar, TabLink } from "../kit/Tabs";
import { SAVE_FAILED, useNotify } from "../Notices";
import { useQuickAdd } from "../QuickAdd";
import { sessionTargetOf } from "../today/NowCard";
import { AiBadge } from "../ai/AiMarks";
import { SplitSuggestions } from "../ai/Splits";
import { AddRhythmButton, EditWorkButton } from "../work/EditWork";
import { useModule } from "./ModuleProvider";

// The frame every module page shares (docs/05-arayuz.md, "Modül sayfası iskeleti"). Five
// regions, always in this order; the module fills them and is free inside the body.
//   1. status strip   2. upcoming   3. body (tabs)   4. history and trend   5. entry and settings

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

  // The five regions (docs/tasarim/ekranlar/moduller.md). The phone reads them in the order
  // 1, 2, 3, 5, 4; the board puts the tab row across, the body and the entries on the left, the
  // upcoming work and the history on the right.
  return (
    <div className="flex w-full flex-1 flex-col gap-3.5 px-4 pt-3.5 pb-6 md:gap-4 md:px-10 md:pt-6">
      <StatusStrip mod={mod} />
      <div className="flex flex-col gap-3.5 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] md:items-start md:gap-x-5 md:gap-y-4">
        <div className="md:col-start-2 md:row-start-2">
          <Upcoming mod={mod} />
        </div>
        {tabs.length > 1 ? (
          <div className="flex items-center gap-2.5 md:col-span-2 md:row-start-1">
            <TabBar label="Sekmeler" className="min-w-0">
              {tabs.map((tab) => (
                <TabLink
                  key={tab.key}
                  href={tab.key === tabs[0].key ? `/m/${row.slug}` : `/m/${row.slug}/${tab.key}`}
                  selected={tab.key === active?.key}
                >
                  {tab.label}
                </TabLink>
              ))}
            </TabBar>
            <HistoryLink href="#gecmis" className="ml-auto">
              Geçmiş
            </HistoryLink>
          </div>
        ) : null}
        <section
          aria-label="Gövde"
          className="flex min-w-0 flex-col gap-4 md:col-start-1 md:row-start-2"
        >
          {Body ? (
            <Body params={{}} />
          ) : (
            <p className="text-ink-2 text-base">Bu modülün kendi görünümü yok.</p>
          )}
        </section>
        <div className="md:col-start-1 md:row-start-3">
          <EntryAndSettings mod={mod} />
        </div>
        <Panel
          id="gecmis"
          variant="dense"
          label="Geçmiş · son 8 hafta"
          aria-label="Geçmiş ve gidişat"
          className="scroll-mt-6 pb-4 md:col-start-2 md:row-start-3"
        >
          <div className="px-4 md:px-4.5">
            {History ? <History /> : <WeeklyMinutes mod={mod} />}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** Region 1: the name and one line of status, its health, the week's numbers; quick actions. */
function StatusStrip({ mod }: { mod: KnownModule }) {
  const { row, definition } = mod;
  const { ctx } = useModule();
  const now = useNow();
  const notify = useNotify();
  const refreshAll = useRefreshAll();
  const quickAdd = useQuickAdd();
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

  const health = chip.data && chip.data.health !== "ok" ? chip.data.health : null;
  const line = [
    definition?.area?.name,
    row.status === "paused" ? "Duraklatıldı" : null,
    chip.data?.text,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section aria-label="Durum" className="flex flex-col gap-3.5 md:gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link
            href="/m"
            aria-label="Modüller"
            className="size-touch focus-visible:shadow-focus -ml-2.5 flex shrink-0 items-center justify-center rounded-full outline-none md:hidden"
          >
            <ChevronLeft aria-hidden className="size-5.5" />
          </Link>
          <h1 className="text-title tracking-title flex min-w-0 items-center gap-2.5 font-bold md:text-3xl">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: moduleColor(mod) }}
            />
            <span className="truncate">{row.name}</span>
          </h1>
          <p className="text-ink-2 text-note hidden min-w-0 truncate md:block">{line}</p>
          {health ? <Status health={health} /> : null}
        </div>
        {/* The module's own actions at the right (its main "add" first); without them the
            core's "İş ekle" (docs/tasarim/ekranlar/moduller.md, region 1). */}
        {definition && (definition.ui.actions?.length || definition.ui.fullscreen?.length) ? (
          <div
            role="toolbar"
            aria-label="Hızlı eylemler"
            className="flex flex-wrap justify-end gap-2"
          >
            {(definition.ui.actions ?? []).map((action) => (
              <Button key={action.key} size="sm" onClick={() => void run(action)}>
                {action.label}
              </Button>
            ))}
            {(definition.ui.fullscreen ?? []).map((view) => (
              <Link
                key={view.key}
                href={`/m/${row.slug}/tam/${view.key}`}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                {view.label}
              </Link>
            ))}
          </div>
        ) : (
          <Button size="sm" onClick={() => quickAdd.open({ moduleSlug: row.slug })}>
            İş ekle
          </Button>
        )}
      </div>
      {line ? <p className="text-ink-2 -mt-2 text-sm md:hidden">{line}</p> : null}

      {report.data && report.data.metrics.length > 0 ? (
        <Panel variant="dense" className="px-4 py-3.5 md:px-6">
          <dl aria-label="Bu hafta" className="flex flex-wrap gap-x-8 gap-y-2.5">
            {report.data.metrics.map((metric) => (
              <div key={metric.label} className="flex flex-col gap-0.5">
                <dt className="text-ink-2 text-sm">{metric.label}</dt>
                <dd className="text-section font-bold tabular-nums">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      ) : null}
      {report.data?.suggestions.slice(0, 2).map((suggestion) => (
        <p key={suggestion} className="text-ink-2 text-note">
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

  // Until the work has been read the region says nothing; "no work" would be a wrong answer.
  const loading = [tasks, workItems, rhythms, rhythmLogs].some((query) => query.isLoading);

  return (
    <Panel variant="dense" label="Yaklaşanlar" className="pb-1.5">
      <div className="px-4 empty:hidden md:px-4.5">
        <SplitSuggestions moduleId={mod.row.id} />
      </div>
      {loading ? null : list.length === 0 ? (
        <p className="text-ink-2 px-4 pb-3 text-base md:px-4.5">Bu modülde sırada iş yok.</p>
      ) : (
        <ul>
          {list.map((candidate) => (
            <UpcomingRow
              key={`${candidate.type}-${candidate.id}`}
              candidate={candidate}
              now={now}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function UpcomingRow({ candidate, now }: { candidate: Candidate; now: Date }) {
  const start = useStartSession();
  const complete = useCompleteTask();
  const logRhythm = useLogRhythm();
  const closeItem = useCloseWorkItem();
  // Ç3e: the work's facet (name and colour) when the module has facets.
  const colors = useColors();
  const facet = colors.facetOf(candidate.moduleId, candidate);

  const item = candidate.item;
  const parts = [
    facet?.name,
    candidate.type === "item" && item?.effort_total_minutes
      ? `${formatMinutes(item.effort_done_minutes)} / ${formatMinutes(item.effort_total_minutes)}`
      : formatMinutes(candidate.minutes),
    candidate.progress,
    candidate.dueAt ? formatDue(candidate.dueAt, now) : null,
    candidate.task?.status === "waiting" ? "bekliyor" : null,
  ].filter(Boolean);

  const waiting = candidate.task?.status === "waiting";
  return (
    <li className="border-line border-t">
      <ListRow
        dot={colors.of(candidate.moduleId, candidate)}
        dotTestId="work-dot"
        pending={waiting}
        title={candidate.title}
        titleProps={{ className: "truncate" }}
        subtitle={<span className="tabular-nums">{parts.join(" · ")}</span>}
        className="border-b-0 md:pl-4.5"
        trailing={
          <>
            {(candidate.task ?? candidate.item) ? (
              <AiBadge row={(candidate.task ?? candidate.item)!} align="right" />
            ) : null}
            <IconButton
              label={`Başla: ${candidate.title}`}
              title="Başla"
              onClick={() => start.mutate(sessionTargetOf(candidate))}
            >
              <Play aria-hidden />
            </IconButton>
            {candidate.type === "task" ? (
              <IconButton
                label={`Bitti: ${candidate.title}`}
                title="Bitti"
                onClick={() => complete.mutate(candidate.id)}
              >
                <Check aria-hidden />
              </IconButton>
            ) : null}
            {candidate.type === "rhythm" ? (
              <IconButton
                label={`Yapıldı: ${candidate.title}`}
                title="Yapıldı"
                onClick={() => logRhythm.mutate(candidate.id)}
              >
                <Check aria-hidden />
              </IconButton>
            ) : null}
            {candidate.type === "item" ? (
              <>
                <IconButton
                  label={`Kalemi bitir: ${candidate.title}`}
                  title="Bitti"
                  onClick={() => closeItem.mutate({ itemId: candidate.id, result: "done" })}
                >
                  <Check aria-hidden />
                </IconButton>
                <IconButton
                  label={`Kalemi bırak: ${candidate.title}`}
                  title="Bırak"
                  onClick={() => closeItem.mutate({ itemId: candidate.id, result: "dropped" })}
                >
                  <X aria-hidden />
                </IconButton>
              </>
            ) : null}
            <EditWorkButton candidate={candidate} />
          </>
        }
      />
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
    return <p className="text-ink-2 text-base">Son 8 haftada kayıtlı oturum yok.</p>;
  }
  return (
    <BarChart
      title={`${mod.row.name}: haftalık harcanan süre`}
      data={data}
      unit="dk"
      color={moduleColor(mod)}
    />
  );
}

/** Region 5: the module's own entries, and the way to its settings. */
function EntryAndSettings({ mod }: { mod: KnownModule }) {
  const quickAdd = useQuickAdd();
  const { row, definition } = mod;
  return (
    <Panel variant="dense" label="Giriş ve ayarlar" className="gap-3 pb-4">
      <div className="flex flex-wrap gap-2 px-4 md:px-4.5">
        <Button size="sm" onClick={() => quickAdd.open({ moduleSlug: row.slug })}>
          İş ekle
        </Button>
        {(definition?.intake ?? []).map((type) => (
          <Button
            key={type.key}
            size="sm"
            onClick={() => quickAdd.open({ moduleSlug: row.slug, intakeKey: type.key })}
          >
            {type.label} ekle
          </Button>
        ))}
        <AddRhythmButton moduleId={row.id} />
      </div>
      <Link
        href={`/ayarlar/moduller/${row.slug}`}
        className="link-quiet text-note mx-4 w-fit font-semibold md:mx-4.5"
      >
        Modül ayarları
      </Link>
    </Panel>
  );
}
