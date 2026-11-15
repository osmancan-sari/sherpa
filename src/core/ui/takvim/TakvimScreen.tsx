"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Sparkles, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import {
  type KnownModule,
  useAiStatus,
  useCalendar,
  useHorizonReviews,
  useModules,
  useTodayPlan,
  useWeeklyReviews,
} from "@/core/app/hooks";
import { useDb } from "@/core/app/CoreProvider";
import { useColors } from "@/core/app/facets";
import { useRecommitWeek } from "@/core/app/plan-actions";
import { moduleColor } from "@/core/contract/colors";
import { weekInput } from "@/core/data/keep";
import { listTasksById } from "@/core/data/work";
import {
  type ForecastDay,
  loadByWeek,
  readShares,
  type WeekLoad,
  type WeekWorkRow,
  weekNoTime,
} from "@/core/planner";
import { blocksOfDay } from "@/core/today/select";
import {
  doneOn,
  type DoneRow,
  dueOn,
  dueText,
  horizonNote,
  sessionTaskIds,
  weekLabel,
} from "@/core/today/takvim";
import type { Block } from "@/core/types";
import { formatMinutes, formatTime, inIstanbul, shiftDay, weekStart } from "@/lib/date";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ClientOnly } from "../ClientOnly";
import { IconButton } from "../kit/Button";
import { AlertRow, ProgressBar } from "../kit/Feedback";
import { ListRow } from "../kit/ListRow";
import { PanelLabel } from "../kit/Panel";
import { ConnectionPill } from "../look/Connection";
import { useNotify } from "../Notices";
import { useLayoutDevice } from "../sky/Backdrop";
import { LoadFailed } from "../today/TodayScreen";

// Takvim (docs/tasarim/ekranlar/takvim.md; frames TT1–TT7, TP1–TP5; Ç4c): the week chooser, the
// seven days to touch, "Bu hafta" (the week's work by deadline against its time), a day's detail
// (past: what was done; today: what is next; coming: the forecast), the coming weeks, the AI's
// notes and "Haftayı yeniden kur". Calm backdrop, dense glass.

const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export function TakvimScreen() {
  return (
    <div className="flex w-full flex-1 flex-col gap-3.5 px-4 pt-4.5 pb-6 md:gap-4 md:px-10 md:pt-6">
      <ClientOnly
        fallback={<h1 className="text-title tracking-title px-1 font-bold md:text-3xl">Takvim</h1>}
      >
        <TakvimBody />
      </ClientOnly>
    </div>
  );
}

function TakvimBody() {
  const { input, plan, rows, failed, retry, now } = useTodayPlan();
  const today = input?.date ?? null;
  const current = today ? weekStart(today) : null;
  const [chosenWeek, setChosenWeek] = useState<string | null>(null);
  const week = chosenWeek ?? current;
  const [selected, setSelected] = useState<string | null>(null);
  const goWeek = (next: string) => {
    setChosenWeek(next === current ? null : next);
    setSelected(null);
  };

  if (failed) {
    return (
      <>
        <Header week={null} onWeek={() => undefined} />
        <LoadFailed onRetry={retry} />
      </>
    );
  }
  if (!input || !plan || !rows || !week || !today || !current) {
    return <Header week={null} onWeek={() => undefined} />;
  }
  return (
    <>
      <Header week={week} onWeek={goWeek} />
      <Week
        week={week}
        current={current}
        today={today}
        selected={selected}
        onSelect={setSelected}
        onWeek={goWeek}
        now={now}
      />
    </>
  );
}

/** "Takvim" and the week chooser: the previous week, "9–15 Kasım", the next week. */
function Header({ week, onWeek }: { week: string | null; onWeek: (week: string) => void }) {
  return (
    <header className="flex items-center gap-3 px-1 md:gap-6 md:px-0">
      <h1 className="text-title tracking-title font-bold md:text-3xl">Takvim</h1>
      {week ? (
        <div className="flex items-center max-md:ml-auto" role="group" aria-label="Hafta">
          <ChooserButton label="Önceki hafta" onClick={() => onWeek(shiftDay(week, -7))}>
            <ChevronLeft aria-hidden />
          </ChooserButton>
          <span data-testid="week-label" className="text-base font-semibold tabular-nums">
            {weekLabel(week)}
          </span>
          <ChooserButton label="Sonraki hafta" onClick={() => onWeek(shiftDay(week, 7))}>
            <ChevronRight aria-hidden />
          </ChooserButton>
        </div>
      ) : null}
      <span className="md:ml-auto">
        <ConnectionPill />
      </span>
    </header>
  );
}

function ChooserButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="size-touch focus-visible:shadow-focus flex items-center justify-center rounded-full outline-none [&_svg]:size-5"
    >
      {children}
    </button>
  );
}

function Week({
  week,
  current,
  today,
  selected,
  onSelect,
  onWeek,
  now,
}: {
  week: string;
  current: string;
  today: string;
  selected: string | null;
  onSelect: (day: string | null) => void;
  onWeek: (week: string) => void;
  now: Date;
}) {
  const { input, plan, rows } = useTodayPlan();
  const { modules } = useModules();
  const board = useLayoutDevice() === "pano";
  const calendar = useCalendar(week);
  const moduleMap = useMemo(() => new Map(modules.map((mod) => [mod.row.id, mod])), [modules]);
  const loads = useMemo(() => {
    if (!rows) return null;
    const load = weekInput(rows, now);
    return {
      shown: loadByWeek(load, { from: week, weeks: 1 })[0],
      coming: loadByWeek(load, { from: shiftDay(current, 7), weeks: 8 }),
    };
  }, [rows, now, week, current]);
  if (!input || !plan || !rows || !calendar || !loads) return null;

  const days = Array.from({ length: 7 }, (_, index) => shiftDay(week, index));
  const usableOf = (day: string): number | null => {
    if (day < today) return null;
    if (day === today) return plan.usableMinutes;
    return calendar.days.find((row) => row.date === day)?.usableMinutes ?? null;
  };
  const dueOfDay = (day: string) => dueOn(day, input.workItems, input.tasks);

  const detail = selected ? (
    <DayDetail
      day={selected}
      today={today}
      usable={usableOf(selected)}
      forecast={calendar.days.find((row) => row.date === selected) ?? null}
      due={dueOfDay(selected)}
      blocks={blocksOfDay(input.blocks, selected).filter((block) => block.status !== "cancelled")}
      modules={moduleMap}
      onClose={() => onSelect(null)}
    />
  ) : null;

  // Work this week's windows cannot hold (docs/04-planlayici.md, "Zaman kısıtları", rule 8).
  const stored = rows.weekPlans.find((row) => row.week_start === week);
  const noTime =
    week === current
      ? weekNoTime({
          ...weekInput(rows, now),
          weekStart: week,
          committed: stored?.committed ?? null,
          shares: readShares(stored?.shares),
          rhythmLogs: rows.rhythmLogs,
        })
      : [];

  const thisWeek = (
    <ThisWeek
      label={week === current ? "Bu hafta" : weekLabel(week)}
      load={loads.shown}
      work={calendar.work}
      now={now}
      modules={moduleMap}
    />
  );

  return (
    <>
      <section aria-label="Haftanın günleri">
        <ol className="grid grid-cols-7 gap-1.5 md:gap-3.5">
          {days.map((day, index) => (
            <li key={day} className="min-w-0">
              <DayBox
                day={day}
                name={DAY_NAMES[index]}
                today={today}
                selected={selected === day}
                usable={usableOf(day)}
                due={dueOfDay(day)}
                board={board}
                onClick={() => onSelect(selected === day ? null : day)}
              />
            </li>
          ))}
        </ol>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3.5 md:grid-cols-9 md:gap-6.5">
        {board || !detail ? (
          <div className="flex min-w-0 flex-col gap-3.5 md:col-span-5">
            {thisWeek}
            {noTime.length > 0 ? (
              <section aria-label="Uygun saat" className="flex flex-col gap-3.5">
                {noTime.map((row) => {
                  const slug = moduleMap.get(row.moduleId)?.row.slug;
                  return (
                    <AlertRow
                      key={row.id}
                      action={{ label: "Modüle git", href: slug ? `/m/${slug}` : "/m" }}
                    >
                      <span className="font-semibold">Uyarı</span> · Bu hafta uygun saat yok:{" "}
                      {row.title}.
                    </AlertRow>
                  );
                })}
              </section>
            ) : null}
          </div>
        ) : null}
        <div className="flex min-w-0 flex-col gap-3.5 md:col-span-4 md:gap-4">
          {detail ?? (
            <>
              <Horizon loads={loads.coming} onWeek={onWeek} />
              <AiNotes week={week} month={`${today.slice(0, 7)}-01`} />
              {week === current ? <Rebuild /> : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** A day of the week: its name and date; a dot per deadline; on the board its time and first deadline. */
function DayBox({
  day,
  name,
  today,
  selected,
  usable,
  due,
  board,
  onClick,
}: {
  day: string;
  name: string;
  today: string;
  selected: boolean;
  usable: number | null;
  due: ReturnType<typeof dueOn>;
  board: boolean;
  onClick: () => void;
}) {
  const colors = useColors();
  const past = day < today;
  const number = Number(day.slice(8));
  const month = format(inIstanbul(new Date(`${day}T12:00:00Z`)), "MMMM", { locale: tr });
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-current={day === today ? "date" : undefined}
      aria-label={`${name} ${number} ${month}${due.length > 0 ? ", teslim var" : ""}`}
      onClick={onClick}
      className={cn(
        "focus-visible:shadow-focus flex h-18 w-full flex-col items-center justify-center gap-px rounded-2xl border outline-none md:h-23 md:items-start md:justify-start md:gap-0.5 md:px-3.5 md:py-2.5 md:text-left",
        selected
          ? "bg-light text-ink-dark shadow-selected border-transparent"
          : "bg-glass-dense text-ink border-edge-soft",
        day === today && !selected && "border-ink border-2",
        past && !selected && "opacity-60",
      )}
    >
      {board ? (
        <>
          <span className="text-lead font-semibold tabular-nums">
            {name} {number}
          </span>
          {usable !== null ? (
            <span
              className={cn("text-note tabular-nums", selected ? "text-ink-dark-2" : "text-ink-2")}
            >
              {formatMinutes(usable)} vakit
            </span>
          ) : null}
          {due[0] ? (
            <span className="mt-auto flex w-full min-w-0 items-center gap-1.5 text-sm">
              <span
                aria-hidden
                className="size-1.75 shrink-0 rounded-full"
                style={{ backgroundColor: colors.of(due[0].moduleId, due[0].work) }}
              />
              <span className="truncate">{due[0].title}</span>
            </span>
          ) : null}
        </>
      ) : (
        <>
          <span className={cn("text-sm", selected ? "text-ink-dark-2" : "text-ink-2")}>{name}</span>
          <span className="text-lg font-semibold tabular-nums">{number}</span>
          <span className="flex h-1.75 gap-0.75">
            {due.slice(0, 3).map((row) => (
              <span
                key={row.id}
                aria-hidden
                data-testid="due-dot"
                className="size-1.75 rounded-full"
                style={{ backgroundColor: colors.of(row.moduleId, row.work) }}
              />
            ))}
          </span>
        </>
      )}
    </button>
  );
}

/**
 * "Bu hafta": the week's work and time in one line with the load bar (modules' colours, the
 * time a white line), then the week's work by deadline: its share, what was worked, the AI's note.
 */
function ThisWeek({
  label,
  load,
  work,
  now,
  modules,
}: {
  label: string;
  load: WeekLoad;
  work: WeekWorkRow[];
  now: Date;
  modules: Map<string, KnownModule>;
}) {
  const colors = useColors();
  const { input } = useTodayPlan();
  const items = input?.workItems ?? [];
  const tasks = input?.tasks ?? [];
  const scale = Math.max(load.capacityMinutes, load.demandMinutes, 1);
  const parts = Object.entries(load.byModule).filter(([, minutes]) => minutes > 0);
  const workOf = (row: WeekWorkRow) =>
    row.type === "item"
      ? { item: items.find((item) => item.id === row.id) }
      : { task: tasks.find((task) => task.id === row.id) };
  return (
    <section aria-label="Bu hafta" className="glass-dense rounded-dense flex flex-col">
      <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-3">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <PanelLabel className="flex-1">{label}</PanelLabel>
          <span data-testid="week-load" className="text-ink-2 text-sm tabular-nums">
            {formatMinutes(load.demandMinutes)} iş · {formatMinutes(load.capacityMinutes)} vakit
          </span>
        </div>
        <div
          role="img"
          aria-label={`İş ${formatMinutes(load.demandMinutes)}, vakit ${formatMinutes(load.capacityMinutes)}`}
          className="bg-fill-track relative h-1.5 overflow-hidden rounded-xs"
        >
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
                  backgroundColor: moduleColor(modules.get(moduleId)),
                }}
              />
            ))}
          </div>
          <span
            aria-hidden
            className="bg-flow-now absolute inset-y-0 w-0.5"
            style={{
              left: `calc(${(load.capacityMinutes / scale) * 100}% - var(--spacing) * 0.5)`,
            }}
          />
        </div>
        {load.over ? (
          <div role="note" className="flex flex-col gap-0.5 text-sm">
            <p className="text-attention flex items-center gap-1.5 font-semibold">
              <TriangleAlert aria-hidden className="size-4 shrink-0" />
              İstenen süre bu haftanın vaktini aşıyor.
            </p>
            {load.deadlines.length > 0 ? (
              <p className="text-ink-2">
                Yetişmeyebilir:{" "}
                {load.deadlines
                  .slice(0, 5)
                  .map((row) => row.title)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {work.length === 0 ? (
        <p className="text-ink-2 text-note border-line border-t px-4 py-3.5">
          Bu hafta için taahhüt edilen iş yok.
        </p>
      ) : (
        <ul className="flex flex-col">
          {work.map((row) => {
            const color = colors.of(row.moduleId, workOf(row));
            return (
              <li
                key={`${row.type}-${row.id}`}
                className="border-line flex flex-col gap-1.5 border-t px-4 py-3.5"
              >
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden
                    data-testid="work-dot"
                    className="size-2.25 shrink-0 self-center rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-base font-semibold">
                    {row.title}
                  </span>
                  <span className="text-ink-2 shrink-0 text-sm">
                    {modules.get(row.moduleId)?.row.name}
                  </span>
                </div>
                {row.dueAt ? <p className="text-sm">{dueText(row.dueAt, now)}</p> : null}
                <ProgressBar
                  value={row.shareMinutes > 0 ? row.workedMinutes / row.shareMinutes : 0}
                  color={color}
                  label={`${row.title}: işlenen`}
                  className="h-1.5"
                />
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-ink-2 flex min-w-0 flex-1 items-start gap-1.5">
                    {row.note ? (
                      <>
                        <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          <span className="sr-only">Yapay zeka: </span>
                          {row.note}
                        </span>
                      </>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatMinutes(Math.min(row.workedMinutes, row.shareMinutes))} /{" "}
                    {formatMinutes(row.shareMinutes)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** A day's detail: past (what was done), today (what is next and done), coming (the forecast). */
function DayDetail({
  day,
  today,
  usable,
  forecast,
  due,
  blocks,
  modules,
  onClose,
}: {
  day: string;
  today: string;
  usable: number | null;
  forecast: ForecastDay | null;
  due: ReturnType<typeof dueOn>;
  blocks: Block[];
  modules: Map<string, KnownModule>;
  onClose: () => void;
}) {
  const { input, plan, rows } = useTodayPlan();
  const colors = useColors();
  const db = useDb();
  // The past day's sessions may name finished work older than the screen reads.
  const ids = rows ? sessionTaskIds(day, rows.sessions) : [];
  const known = new Set(input?.tasks.map((task) => task.id) ?? []);
  const missing = ids.filter((id) => !known.has(id));
  const older = useQuery({
    queryKey: ["core", "takvim-tasks", missing.join(",")],
    enabled: missing.length > 0 && day <= today,
    staleTime: Infinity,
    queryFn: () => listTasksById(db, missing),
  });
  if (!input || !plan || !rows) return null;
  const done: DoneRow[] =
    day <= today
      ? doneOn(day, rows.sessions, {
          tasks: [...input.tasks, ...(older.data ?? [])],
          items: input.workItems,
          rhythms: input.rhythms,
        })
      : [];
  const doneMinutes = done.reduce((sum, row) => sum + row.minutes, 0);
  const when = day < today ? "past" : day === today ? "today" : "coming";
  const name = format(inIstanbul(new Date(`${day}T12:00:00Z`)), "EEEE d MMMM", { locale: tr });
  const summary =
    when === "past"
      ? `${done.length} iş · ${formatMinutes(doneMinutes)}`
      : when === "today"
        ? `${done.length} iş bitti · ${formatMinutes(usable ?? 0)} vakit`
        : `${formatMinutes(usable ?? 0)} vakit`;
  const moduleName = (id: string | null) => (id ? modules.get(id)?.row.name : undefined);
  const nextRows =
    when === "today"
      ? plan.slots.flatMap((slot) => (slot.assignment ? [slot.assignment] : []))
      : when === "coming"
        ? (forecast?.work ?? []).map((row) => row.assignment)
        : [];

  const dueSection = (
    <DetailSection label="Teslim ve sınav" hidden={due.length === 0}>
      {due.map((row) => (
        <ListRow
          key={row.id}
          dot={colors.of(row.moduleId, row.work)}
          dotTestId="work-dot"
          title={row.title}
          subtitle={<span className="tabular-nums">{dueHour(row.dueAt)}</span>}
          trailing={<ModuleName name={moduleName(row.moduleId)} />}
        />
      ))}
    </DetailSection>
  );
  const doneSection = (
    <DetailSection label="Yapılanlar" hidden={done.length === 0}>
      {done.map((row) => (
        <ListRow
          key={row.key}
          dot={row.moduleId ? colors.of(row.moduleId, row.work) : null}
          dotTestId="work-dot"
          title={row.title}
          subtitle={<span className="tabular-nums">{formatMinutes(row.minutes)}</span>}
          trailing={<ModuleName name={moduleName(row.moduleId)} />}
        />
      ))}
    </DetailSection>
  );
  const nextSection = (
    <DetailSection
      label={when === "today" ? "Sıradakiler" : "Planlananlar"}
      hidden={nextRows.length === 0}
    >
      {nextRows.map((assignment) => (
        <ListRow
          key={`${assignment.candidate.type}-${assignment.candidate.id}`}
          dot={colors.of(assignment.candidate.moduleId, assignment.candidate)}
          dotTestId="work-dot"
          title={assignment.candidate.title}
          subtitle={<span className="tabular-nums">{formatMinutes(assignment.minutes)}</span>}
          trailing={<ModuleName name={moduleName(assignment.candidate.moduleId)} />}
        />
      ))}
    </DetailSection>
  );
  const blockSection = (
    <DetailSection label="Sabit" hidden={blocks.length === 0}>
      {blocks.map((block) => (
        <ListRow
          key={block.id}
          block
          title={block.title}
          subtitle={
            <span className="tabular-nums">
              {formatTime(new Date(block.starts_at))}–{formatTime(new Date(block.ends_at))}
            </span>
          }
        />
      ))}
    </DetailSection>
  );

  return (
    <section aria-label="Günün ayrıntısı" className="glass-dense rounded-dense flex flex-col pb-2">
      <header className="border-line flex items-center gap-3 border-b py-2.5 pr-2.5 pl-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-lg font-semibold first-letter:uppercase">
            {name}
            {when === "today" ? " · bugün" : ""}
          </h2>
          <p data-testid="day-summary" className="text-ink-2 text-sm tabular-nums">
            {summary}
          </p>
        </div>
        <IconButton label="Kapat" onClick={onClose}>
          <X aria-hidden />
        </IconButton>
      </header>
      {when === "past" ? (
        <>
          {dueSection}
          {doneSection}
          {blockSection}
        </>
      ) : when === "today" ? (
        <>
          {nextSection}
          {blockSection}
          {doneSection}
          <Link
            href="/"
            className="text-note min-h-touch link-quiet mx-4 mt-1 flex w-fit items-center font-semibold"
          >
            Bugün&apos;e git
          </Link>
        </>
      ) : (
        <>
          {dueSection}
          {nextSection}
          {blockSection}
          <p className="text-ink-2 px-4 pt-2 pb-2 text-sm">
            Plan tahminidir; o sabah yeniden kurulur.
          </p>
        </>
      )}
    </section>
  );
}

/** A deadline's hour; the end of the day says "gün sonuna kadar". */
function dueHour(at: Date): string {
  const time = formatTime(at);
  return time === "23:59" || time === "00:00" ? "gün sonuna kadar" : time;
}

function DetailSection({
  label,
  hidden,
  children,
}: {
  label: string;
  hidden: boolean;
  children: ReactNode;
}) {
  if (hidden) return null;
  return (
    <section aria-label={capital(label)} className="flex flex-col">
      <PanelLabel className="px-4 pt-3 pb-0.5">{label}</PanelLabel>
      {children}
    </section>
  );
}

const capital = (text: string) => text.charAt(0).toLocaleUpperCase("tr-TR") + text.slice(1);

function ModuleName({ name }: { name: string | undefined }) {
  return name ? <span className="text-ink-2 pr-1.5 text-sm">{name}</span> : null;
}

/**
 * The coming weeks: eight small bars, each its week's work with its time as a white line; a week
 * that asks more than its time in the attention colour, with its line under the bars. A bar goes
 * to its week.
 */
function Horizon({ loads, onWeek }: { loads: WeekLoad[]; onWeek: (week: string) => void }) {
  const scale = Math.max(1, ...loads.flatMap((load) => [load.capacityMinutes, load.demandMinutes]));
  const over = loads.find((load) => load.over) ?? null;
  return (
    <section
      aria-label="Önümüzdeki haftalar"
      className="glass-dense rounded-dense flex flex-col gap-2.5 px-4 pt-3.5 pb-4"
    >
      <div className="flex items-baseline">
        <PanelLabel className="flex-1">Önümüzdeki haftalar</PanelLabel>
        <span className="text-ink-2 text-sm">çizgi: vakit</span>
      </div>
      <ol className="flex gap-0.5">
        {loads.map((load, index) => {
          const start = inIstanbul(new Date(`${load.weekStart}T12:00:00Z`));
          const previous = index > 0 ? loads[index - 1].weekStart.slice(5, 7) : null;
          const month =
            previous !== load.weekStart.slice(5, 7) ? format(start, "MMM", { locale: tr }) : "";
          const label = `${start.getDate()} ${format(start, "MMM", { locale: tr })} haftası: ${formatMinutes(load.demandMinutes)} iş, ${formatMinutes(load.capacityMinutes)} vakit`;
          return (
            <li key={load.weekStart} className="min-w-0 flex-1">
              <button
                type="button"
                aria-label={label}
                title={label}
                onClick={() => onWeek(load.weekStart)}
                className="focus-visible:shadow-focus flex w-full flex-col items-center gap-1 rounded-md outline-none"
              >
                <span className={cn("flex h-4", load.over ? "text-attention" : "")}>
                  {load.over ? <TriangleAlert aria-hidden className="size-3.5" /> : null}
                </span>
                <span className="bg-fill-chip relative h-16 w-[62%] overflow-hidden rounded-md">
                  <span
                    className={cn(
                      "absolute inset-x-0 bottom-0 rounded-md",
                      load.over ? "bg-attention" : "bg-fill-bar",
                    )}
                    style={{ height: `${Math.min(100, (load.demandMinutes / scale) * 100)}%` }}
                  />
                  <span
                    aria-hidden
                    className="bg-flow-now absolute inset-x-0 h-0.5"
                    style={{ bottom: `${Math.min(100, (load.capacityMinutes / scale) * 100)}%` }}
                  />
                </span>
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-note tabular-nums">{start.getDate()}</span>
                  <span className="text-ink-2 min-h-4.25 text-sm">{month}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {over ? (
        <p role="note" className="flex items-start gap-1.5 text-sm">
          <TriangleAlert aria-hidden className="text-attention mt-0.5 size-4 shrink-0" />
          {horizonNote(over)}
        </p>
      ) : null}
    </section>
  );
}

/** A stored review; Ç4a: a life mode an older one suggested is not shown. */
type ReviewSummary = { summary?: string; suggestions?: string[] };
/** A stored proposal; Ç4a: an older one of kind "mode" (a life mode) is not shown. */
type MonthProposal = { kind?: string; text?: string };

/**
 * What the AI said about the week behind (`review`, from Saturday) and the coming weeks
 * (`month`), short, in a soft panel. Nothing without the AI: the page above is the engine's.
 */
function AiNotes({ week, month }: { week: string; month: string }) {
  const reviews = useWeeklyReviews();
  const horizons = useHorizonReviews();
  const review = reviews.data?.find((row) => row.week_start === week)?.summary as
    ReviewSummary | undefined;
  const proposals = (
    (horizons.data?.find((row) => row.period_start === month)?.proposals ?? []) as MonthProposal[]
  ).filter((row) => row.text && row.kind !== "mode");
  if (!review?.summary && proposals.length === 0) return null;
  return (
    <section
      aria-label="Yapay zekanın notları"
      className="glass-soft rounded-soft flex flex-col gap-2 px-4 pt-3.5 pb-4"
    >
      <PanelLabel className="flex items-center gap-1.5">
        <Sparkles aria-hidden className="size-3.5" />
        Yapay zekanın notları
      </PanelLabel>
      {review?.summary ? <p className="text-note">{review.summary}</p> : null}
      {(review?.suggestions ?? []).map((suggestion) => (
        <p key={suggestion} className="text-ink-2 text-sm">
          {suggestion}
        </p>
      ))}
      {proposals.map((row) => (
        <p key={row.text} className="text-ink-2 text-sm">
          {row.text}
        </p>
      ))}
    </section>
  );
}

/** "Haftayı yeniden kur": a quiet link at the end; "Hafta yeniden kuruldu." after it. */
function Rebuild() {
  const recommit = useRecommitWeek();
  const aiOn = useAiStatus().data?.state === "on";
  const notify = useNotify();
  return (
    <button
      type="button"
      disabled={recommit.isPending}
      onClick={() =>
        recommit.mutate(
          { now: new Date(), ai: aiOn },
          { onSuccess: () => notify("Hafta yeniden kuruldu.") },
        )
      }
      className="text-note min-h-touch link-quiet focus-visible:shadow-focus self-center rounded-full px-3 font-semibold outline-none disabled:opacity-50"
    >
      Haftayı yeniden kur
    </button>
  );
}
