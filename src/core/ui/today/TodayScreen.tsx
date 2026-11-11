"use client";

import { Check, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useCloseWorkItem,
  useCompleteTask,
  useEndSession,
  useLogRhythm,
  useReopenTask,
  useStartSession,
} from "@/core/app/actions";
import {
  useAiStatus,
  type KnownModule,
  useModuleQuery,
  useModules,
  useTodayPlan,
} from "@/core/app/hooks";
import { useAnswerFollowUp, useDefer, useReplan } from "@/core/app/plan-actions";
import type { ChipData, Health } from "@/core/contract/types";
import { buildPlan, type Candidate, tomorrowInput } from "@/core/planner";
import { blocksOfDay } from "@/core/today/select";
import type { Block, Task } from "@/core/types";
import { dayKey, formatDue, formatMinutes, formatTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import { AiBadge } from "../ai/AiMarks";
import { ClientOnly } from "../ClientOnly";
import { useNotify } from "../Notices";
import { QuickAddButton } from "../QuickAdd";
import { AlertBar, DayStrip, isTyping, MinutesDialog, TopBar } from "./DayParts";
import { NowCard, sessionTargetOf } from "./NowCard";

// The Today screen (docs/05-arayuz.md): drawn from the planner's plan, re-made on every change
// and every minute. The "now" card, the next things, the day as a strip, at most two warnings,
// one line per module. One page on the second screen, one column on the phone.

export function TodayScreen() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-5 py-6 md:px-10 md:py-8">
      <ClientOnly
        fallback={<h1 className="text-xl font-semibold tracking-tight md:text-2xl">Bugün</h1>}
      >
        <TodayBody />
      </ClientOnly>
    </div>
  );
}

function TodayBody() {
  const { modules } = useModules();
  const { input, plan, rows, loading, failed, retry, now } = useTodayPlan();
  const start = useStartSession();
  const end = useEndSession();
  const defer = useDefer();
  const replan = useReplan();
  const notify = useNotify();
  const [minutesOpen, setMinutesOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const moduleMap = useMemo(() => new Map(modules.map((mod) => [mod.row.id, mod])), [modules]);

  // The night screen shows the first work of tomorrow.
  const tomorrowFirst = useMemo(() => {
    if (!plan || plan.now.kind !== "night" || !rows) return null;
    const tomorrow = buildPlan(tomorrowInput(rows, { now, context: input!.context }));
    return tomorrow.slots.find((slot) => slot.assignment)?.assignment?.candidate ?? null;
  }, [plan, rows, now, input]);

  const state = plan?.now;
  const doReplan = () => {
    if (!input) return;
    replan.mutate(input, { onSuccess: () => notify("Gün yeniden planlandı.") });
  };

  // The second screen's keys (docs/05-arayuz.md, "Klavye"): Space starts or finishes, E puts
  // off, X asks for the minutes, R plans again. N (quick add) lives with quick add.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (!state || !input) return;
      const key = event.key.toLowerCase();
      if (event.key === " ") {
        if (state.kind === "suggest" && state.assignment.candidate.type !== "follow_up") {
          event.preventDefault();
          start.mutate(sessionTargetOf(state.assignment.candidate));
        } else if (state.kind === "running" && state.session.id !== "pending") {
          event.preventDefault();
          end.mutate({ session: state.session, outcome: "done" });
        }
      } else if (key === "e" && state.kind === "suggest") {
        event.preventDefault();
        defer.mutate({ candidate: state.assignment.candidate, date: input.date });
      } else if (key === "x") {
        event.preventDefault();
        setMinutesOpen(true);
      } else if (key === "r") {
        event.preventDefault();
        doReplan();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (failed) {
    return (
      <>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Bugün</h1>
        <LoadFailed onRetry={retry} />
      </>
    );
  }
  if (loading || !input || !plan || !state) {
    return (
      <>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Bugün</h1>
        <div className="border-border min-h-56 rounded-2xl border md:min-h-72" />
      </>
    );
  }

  const currentId =
    state.kind === "running"
      ? (state.task?.id ?? state.rhythm?.id ?? null)
      : state.kind === "suggest"
        ? state.assignment.candidate.id
        : null;
  const assignments = plan.slots.flatMap((slot) => (slot.assignment ? [slot.assignment] : []));
  const ahead = assignments.filter((row) => row.candidate.id !== currentId);
  // When the day is done, what is still planned waits behind "Vakit kalırsa" with the rest.
  const finished = state.kind === "done";
  const upNext = state.kind === "return" || finished ? [] : ahead.slice(0, 3);
  const rest = [...ahead.slice(finished ? 0 : 3).map((row) => row.candidate), ...plan.overflow];
  const doneToday = input.tasks.filter(
    (task) =>
      task.status === "done" && task.done_at && dayKey(new Date(task.done_at)) === input.date,
  );

  return (
    <>
      <TopBar input={input} plan={plan} now={now} />

      <AiBudgetNotice />

      <AlertBar warnings={plan.warnings} modules={moduleMap} />

      {/* minmax(0, …) and min-w-0: a long title is cut with an ellipsis instead of widening
          the column past the screen. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <NowCard
            state={state}
            now={now}
            date={input.date}
            modules={moduleMap}
            tomorrowFirst={tomorrowFirst}
            onShowRest={rest.length > 0 ? () => setRestOpen(true) : undefined}
          />
        </div>

        <section aria-label="Sıradakiler" className="flex min-w-0 flex-col gap-3 lg:col-span-2">
          <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Sıradakiler
          </h2>
          {upNext.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sırada başka iş yok.</p>
          ) : (
            <ul className="divide-border border-border divide-y rounded-xl border">
              {upNext.map((row) => (
                <CandidateRow
                  key={`${row.candidate.type}-${row.candidate.id}`}
                  candidate={row.candidate}
                  date={input.date}
                  mod={moduleMap.get(row.candidate.moduleId)}
                  now={now}
                />
              ))}
            </ul>
          )}
          {rest.length > 0 && state.kind !== "return" ? (
            <details
              className="text-sm"
              open={restOpen}
              onToggle={(event) => setRestOpen((event.target as HTMLDetailsElement).open)}
            >
              <summary className="text-muted-foreground hover:text-foreground flex min-h-11 cursor-pointer items-center md:min-h-9">
                Vakit kalırsa ({rest.length})
              </summary>
              <ul className="divide-border border-border divide-y rounded-xl border">
                {rest.map((candidate) => (
                  <CandidateRow
                    key={`${candidate.type}-${candidate.id}`}
                    candidate={candidate}
                    date={input.date}
                    mod={moduleMap.get(candidate.moduleId)}
                    now={now}
                  />
                ))}
              </ul>
            </details>
          ) : null}
          {doneToday.length > 0 ? <DoneToday tasks={doneToday} /> : null}
        </section>
      </div>

      <DayStrip input={input} plan={plan} now={now} modules={moduleMap} />
      <DayBlocks blocks={blocksOfDay(input.blocks, input.date)} now={now} />

      <footer className="flex flex-wrap items-center gap-2">
        <ModuleChips modules={modules.filter(({ row }) => row.status === "active")} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 md:h-9" onClick={() => setMinutesOpen(true)}>
            X dk&apos;m var
          </Button>
          <Button variant="outline" className="h-11 md:h-9" onClick={doReplan}>
            Yeniden planla
          </Button>
          <Link
            href="/kapanis"
            className="border-border hover:bg-muted flex h-11 items-center rounded-lg border px-3 text-sm md:h-9"
          >
            Günü kapat
          </Link>
          <QuickAddButton />
        </div>
      </footer>

      <MinutesDialog
        open={minutesOpen}
        onOpenChange={setMinutesOpen}
        input={input}
        modules={moduleMap}
      />
    </>
  );
}

/** Shown when the data could not be read. One plain sentence and a way to try again. */
export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="border-border flex min-h-56 flex-col justify-between gap-6 rounded-2xl border p-6 md:p-8"
    >
      <p className="text-muted-foreground text-lg">
        Veri okunamadı. Bağlantı gelince kendiliğinden yenilenir.
      </p>
      <div>
        <Button variant="outline" className="h-11 md:h-9" onClick={onRetry}>
          Yeniden dene
        </Button>
      </div>
    </div>
  );
}

function CandidateRow({
  candidate,
  date,
  mod,
  now,
}: {
  candidate: Candidate;
  date: string;
  mod: KnownModule | undefined;
  now: Date;
}) {
  const start = useStartSession();
  const complete = useCompleteTask();
  const logRhythm = useLogRhythm();
  const closeItem = useCloseWorkItem();
  const followUp = useAnswerFollowUp();

  const parts = [
    mod?.row.name,
    formatMinutes(candidate.minutes),
    candidate.progress,
    candidate.type === "follow_up" ? "takip" : null,
    candidate.dueAt ? formatDue(candidate.dueAt, now) : null,
  ].filter(Boolean);

  const item = candidate.item;
  const effortUsedUp =
    item !== undefined &&
    item.effort_total_minutes !== null &&
    item.effort_done_minutes >= item.effort_total_minutes;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: mod?.row.color ?? "var(--muted-foreground)" }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{candidate.title}</p>
        <p className="text-muted-foreground truncate text-sm tabular-nums">{parts.join(" · ")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {(candidate.task ?? candidate.item) ? (
          <AiBadge row={(candidate.task ?? candidate.item)!} align="right" />
        ) : null}
        {candidate.type === "follow_up" ? (
          <Button
            variant="outline"
            className="h-11 md:h-9"
            onClick={() => followUp.mutate({ task: candidate.task!, came: true, date })}
          >
            Cevap geldi
          </Button>
        ) : (
          <IconButton
            label={`Başla: ${candidate.title}`}
            onClick={() => start.mutate(sessionTargetOf(candidate))}
          >
            <Play aria-hidden />
          </IconButton>
        )}
        {candidate.type === "task" ? (
          <IconButton
            label={`Bitti: ${candidate.title}`}
            onClick={() => complete.mutate(candidate.id)}
          >
            <Check aria-hidden />
          </IconButton>
        ) : null}
        {candidate.type === "rhythm" ? (
          <IconButton
            label={`Yapıldı: ${candidate.title}`}
            onClick={() => logRhythm.mutate(candidate.id)}
          >
            <Check aria-hidden />
          </IconButton>
        ) : null}
        {/* The item's effort is used up: it does not close on its own, the user is asked. */}
        {candidate.type === "item" && effortUsedUp ? (
          <Button
            variant="outline"
            className="h-11 md:h-9"
            onClick={() => closeItem.mutate({ itemId: candidate.id, result: "done" })}
          >
            Bitti mi?
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      aria-label={label}
      title={label}
      className="size-11 md:size-9"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function DoneToday({ tasks }: { tasks: Task[] }) {
  const reopen = useReopenTask();
  return (
    <details className="text-sm">
      <summary className="text-muted-foreground hover:text-foreground flex min-h-11 cursor-pointer items-center md:min-h-9">
        Bugün bitenler ({tasks.length})
      </summary>
      <ul className="flex flex-col">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center justify-between gap-3 py-1">
            <span className="text-muted-foreground truncate line-through">{task.title}</span>
            <Button
              variant="ghost"
              className="h-11 shrink-0 md:h-8"
              onClick={() => reopen.mutate(task.id)}
              aria-label={`Geri al: ${task.title}`}
            >
              Geri al
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}

function DayBlocks({ blocks, now }: { blocks: Block[]; now: Date }) {
  if (blocks.length === 0) return null;
  const time = now.getTime();
  return (
    <section aria-label="Bugünün sabit blokları" className="flex flex-col gap-3">
      <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        Sabit bloklar
      </h2>
      <ul className="flex flex-wrap gap-2">
        {blocks.map((block) => {
          const over = Date.parse(block.ends_at) <= time;
          const running = Date.parse(block.starts_at) <= time && !over;
          return (
            <li
              key={block.id}
              aria-current={running ? "time" : undefined}
              className={cn(
                "border-border rounded-lg border px-3 py-2 text-sm",
                over && "text-muted-foreground",
                running && "border-foreground",
              )}
            >
              <span className="tabular-nums">
                {formatTime(new Date(block.starts_at))}–{formatTime(new Date(block.ends_at))}
              </span>{" "}
              {block.title}
              {block.location ? ` · ${block.location}` : ""}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const HEALTH_LABEL: Record<Health, string> = {
  ok: "yolunda",
  attention: "dikkat",
  behind: "geride",
};

/** One line of status per module; touching it opens the module's page. */
function ModuleChips({ modules }: { modules: KnownModule[] }) {
  if (modules.length === 0) return null;
  return (
    <nav aria-label="Modüller" className="flex flex-wrap gap-2">
      {modules.map((mod) => (
        <ModuleChip key={mod.row.id} mod={mod} />
      ))}
    </nav>
  );
}

export function ModuleChip({ mod }: { mod: KnownModule }) {
  const chip = useModuleQuery<ChipData | null>(mod.row, ["chip"], async (ctx) =>
    mod.definition ? mod.definition.chip(ctx) : null,
  );
  const data = chip.data;
  return (
    <Link
      href={`/m/${mod.row.slug}`}
      className="border-border hover:bg-muted focus-visible:ring-ring/50 flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm outline-none focus-visible:ring-3 md:min-h-9"
    >
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: mod.row.color }}
      />
      <span className="font-medium">{mod.row.name}</span>
      {data?.text ? <span className="text-muted-foreground">· {data.text}</span> : null}
      {data && data.health !== "ok" ? (
        <span className={cn("text-xs", `health-${data.health}`)}>{HEALTH_LABEL[data.health]}</span>
      ) : null}
    </Link>
  );
}

/** Rule 9: when the month's AI budget is used up, the screen says so in one quiet line. */
function AiBudgetNotice() {
  const status = useAiStatus();
  if (status.data?.state !== "budget") return null;
  return (
    <p role="note" className="text-muted-foreground text-sm">
      Bu ayın yapay zeka bütçesi doldu; girişler ay sonuna kadar elle yönlendirilir.
    </p>
  );
}
