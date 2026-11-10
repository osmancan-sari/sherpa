"use client";

import { Check, Play } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  useAnswerPrompt,
  useCloseWorkItem,
  useCompleteTask,
  useLogRhythm,
  useReopenTask,
  useSnoozePrompt,
  useStartSession,
} from "@/core/app/actions";
import {
  type KnownModule,
  useActiveModuleIds,
  useBlocks,
  useDuePrompts,
  useModuleQuery,
  useModules,
  useNow,
  useOpenSession,
  useRhythmLogs,
  useRhythms,
  useTasks,
  useWorkItems,
} from "@/core/app/hooks";
import type { ChipData, Health } from "@/core/contract/types";
import { blocksOfDay, type Candidate, nowState, todayCandidates } from "@/core/today/select";
import type { Block, Prompt, Task } from "@/core/types";
import { dayKey, formatDayLabel, formatDue, formatMinutes, formatTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import { ClientOnly } from "../ClientOnly";
import { QuickAddButton } from "../QuickAdd";
import { NowCard, sessionTargetOf } from "./NowCard";

// The first Today screen (Ç1): no planner yet. The "now" card, the pool in order of deadline
// and importance, the day's fixed blocks, one line per module. One page on the second screen,
// one column on the phone.

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
  const now = useNow();
  const { modules } = useModules();
  const activeModuleIds = useActiveModuleIds();
  const tasks = useTasks();
  const workItems = useWorkItems();
  const rhythms = useRhythms();
  const rhythmLogs = useRhythmLogs();
  const blocks = useBlocks();
  const openSession = useOpenSession();
  const prompts = useDuePrompts();

  const moduleMap = useMemo(() => new Map(modules.map((mod) => [mod.row.id, mod])), [modules]);
  const today = dayKey(now);

  const candidates = useMemo(
    () =>
      todayCandidates({
        tasks: tasks.data ?? [],
        workItems: workItems.data ?? [],
        rhythms: rhythms.data ?? [],
        rhythmLogs: rhythmLogs.data ?? [],
        activeModuleIds,
        now,
      }),
    [tasks.data, workItems.data, rhythms.data, rhythmLogs.data, activeModuleIds, now],
  );

  const state = nowState({
    openSession: openSession.data ?? null,
    tasks: tasks.data ?? [],
    rhythms: rhythms.data ?? [],
    blocks: blocks.data ?? [],
    candidates,
    now,
  });

  const runningId = state.kind === "running" ? (state.task?.id ?? state.rhythm?.id ?? null) : null;
  const suggestedId = state.kind === "suggest" ? state.candidate.id : null;
  const upcoming = candidates.filter(
    (candidate) => candidate.id !== runningId && candidate.id !== suggestedId,
  );
  const doneToday = (tasks.data ?? []).filter(
    (task) => task.status === "done" && task.done_at && dayKey(new Date(task.done_at)) === today,
  );
  const todaysBlocks = blocksOfDay(blocks.data ?? [], today);
  const prompt = (prompts.data ?? []).find((item) => activeModuleIds.has(item.module_id));
  const loading = tasks.isLoading || openSession.isLoading || workItems.isLoading;

  return (
    <>
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Bugün</h1>
        <p className="text-muted-foreground text-sm tabular-nums md:text-base">
          {formatDayLabel(now)} · {formatTime(now)}
          {doneToday.length > 0 ? ` · ${doneToday.length} iş bitti` : ""}
        </p>
      </header>

      {prompt ? <PromptCard prompt={prompt} mod={moduleMap.get(prompt.module_id)} /> : null}

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {loading ? (
            <div className="border-border min-h-56 rounded-2xl border md:min-h-72" />
          ) : (
            <NowCard state={state} now={now} modules={moduleMap} />
          )}
        </div>

        <section aria-label="Sıradakiler" className="flex flex-col gap-3 lg:col-span-2">
          <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Sıradakiler
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sırada başka iş yok.</p>
          ) : (
            <ul className="divide-border border-border divide-y rounded-xl border">
              {upcoming.map((candidate) => (
                <CandidateRow
                  key={`${candidate.type}-${candidate.id}`}
                  candidate={candidate}
                  mod={moduleMap.get(candidate.moduleId)}
                  now={now}
                />
              ))}
            </ul>
          )}
          {doneToday.length > 0 ? <DoneToday tasks={doneToday} /> : null}
        </section>
      </div>

      <DayBlocks blocks={todaysBlocks} now={now} />

      <footer className="flex flex-wrap items-center gap-2">
        <ModuleChips modules={modules.filter(({ row }) => row.status === "active")} />
        <div className="ml-auto">
          <QuickAddButton />
        </div>
      </footer>
    </>
  );
}

function CandidateRow({
  candidate,
  mod,
  now,
}: {
  candidate: Candidate;
  mod: KnownModule | undefined;
  now: Date;
}) {
  const start = useStartSession();
  const complete = useCompleteTask();
  const logRhythm = useLogRhythm();
  const closeItem = useCloseWorkItem();

  const parts = [
    mod?.row.name,
    formatMinutes(candidate.minutes),
    candidate.progress,
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
      <div className="flex shrink-0 gap-1">
        <IconButton
          label={`Başla: ${candidate.title}`}
          onClick={() => start.mutate(sessionTargetOf(candidate))}
        >
          <Play aria-hidden />
        </IconButton>
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

/** One question after an event. At most one is on screen at a time. */
function PromptCard({ prompt, mod }: { prompt: Prompt; mod: KnownModule | undefined }) {
  const answer = useAnswerPrompt();
  const snooze = useSnoozePrompt();
  const options = (prompt.options as { value: string; label: string }[] | null) ?? [];
  return (
    <section
      aria-label="Soru"
      className="border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
    >
      <p className="text-sm md:text-base">
        {mod ? <span className="text-muted-foreground">{mod.row.name} · </span> : null}
        {prompt.question}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            variant="outline"
            className="h-11 md:h-9"
            onClick={() => answer.mutate({ prompt, value: option.value })}
          >
            {option.label}
          </Button>
        ))}
        <Button variant="ghost" className="h-11 md:h-9" onClick={() => snooze.mutate(prompt.id)}>
          Sonra
        </Button>
      </div>
    </section>
  );
}
