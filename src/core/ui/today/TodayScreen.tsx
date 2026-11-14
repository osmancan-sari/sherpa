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
import { useColors } from "@/core/app/facets";
import { useAnswerFollowUp, useDefer, useReplan, useStopForStuck } from "@/core/app/plan-actions";
import { moduleColor } from "@/core/contract/colors";
import type { ChipData, Health } from "@/core/contract/types";
import {
  buildPlan,
  type Candidate,
  type NowState,
  type PlanRows,
  tomorrowInput,
} from "@/core/planner";
import { BED_UNDO_MINUTES } from "@/core/data/frame";
import type { PlannedTarget } from "@/core/data/sessions";
import { chainLine, chainsOf, chainWith, nextInChain, sceneChain } from "@/core/today/chain";
import { blocksOfDay } from "@/core/today/select";
import type { Block, Task } from "@/core/types";
import { dayKey, formatDue, formatMinutes, formatTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import { AiBadge } from "../ai/AiMarks";
import { ClientOnly } from "../ClientOnly";
import { useNotify } from "../Notices";
import { QuickAddButton } from "../QuickAdd";
import { AlertBar, DayStrip, isTyping, MinutesDialog, TopBar } from "./DayParts";
import { NowCard, sessionTargetOf, travelText } from "./NowCard";
import { briefOf, chainLook, SceneFrame, sceneFor, useSceneExit } from "./Scene";
import { briefLine } from "./frame-text";
import { useWakeChainStart } from "./wake-chain";

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
  const colors = useColors();
  const { input, plan, rows, loading, failed, retry, now } = useTodayPlan();
  const start = useStartSession();
  const end = useEndSession();
  const defer = useDefer();
  const replan = useReplan();
  const aiOn = useAiStatus().data?.state === "on";
  const notify = useNotify();
  const [minutesOpen, setMinutesOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const moduleMap = useMemo(() => new Map(modules.map((mod) => [mod.row.id, mod])), [modules]);
  // The scene (Ç3c): left on this device ("Çık"), or failed, per session.
  const [exitedScene, setExitedScene] = useSceneExit();
  const [failedScene, setFailedScene] = useState<string | null>(null);
  const [stuck, setStuck] = useState<Task | null>(null);
  const stopForStuck = useStopForStuck();

  // The night screen shows the first work of tomorrow.
  const tomorrowFirst = useMemo(() => {
    if (!plan || plan.now.kind !== "night" || !rows) return null;
    const tomorrow = buildPlan(tomorrowInput(rows, { now, context: input!.context }));
    return tomorrow.slots.find((slot) => slot.assignment)?.assignment?.candidate ?? null;
  }, [plan, rows, now, input]);

  // Ç3f: the day's anchored chains, from the plan and the day's records; the running work's,
  // as its scene gets it (kept while nothing changes: a scene may depend on it).
  const chains = useMemo(
    () => (input && plan ? chainsOf(input, plan) : { wake: null, bed: null }),
    [input, plan],
  );
  const runningWork =
    plan?.now.kind === "running" ? (plan.now.task?.id ?? plan.now.rhythm?.id ?? null) : null;
  const runningModule = plan?.now.kind === "running" ? plan.now.session.module_id : null;
  const runningChain = useMemo(() => {
    const chain = chainWith(chains, runningWork);
    return chain && runningModule
      ? sceneChain(chain, runningModule, chainLook(moduleMap, colors))
      : null;
  }, [chains, runningWork, runningModule, moduleMap, colors]);

  // Ç3f: a waking told from outside starts the wake chain when the app comes to the front.
  useWakeChainStart(input, plan, chains.wake);

  // Ç3f: the chain's next work after `id`, when the setting is on (Bitti and Ertele start it).
  const chainAuto = input?.settings.frame?.chainAuto ?? false;
  const nextOf = (id: string | null | undefined): PlannedTarget | null => {
    if (!chainAuto || !id) return null;
    const chain = chainWith(chains, id);
    const next = chain ? nextInChain(chain, id) : null;
    return next?.target ? sessionTargetOf(next.target) : null;
  };

  const state = plan?.now;
  const doReplan = () => {
    if (!input) return;
    replan.mutate({ input, ai: aiOn }, { onSuccess: () => notify("Gün yeniden planlandı.") });
  };

  // The second screen's keys (docs/05-arayuz.md, "Klavye"): Space starts or finishes, E puts
  // off, X asks for the minutes, R plans again. N (quick add) lives with quick add.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      // Ç3f: the closing opened inside a scene has its own keys (Enter, Escape).
      if (document.querySelector("[data-scene-closing]")) return;
      if (!state || !input) return;
      const key = event.key.toLowerCase();
      if (event.key === " ") {
        if (state.kind === "suggest" && state.assignment.candidate.type !== "follow_up") {
          event.preventDefault();
          start.mutate(sessionTargetOf(state.assignment.candidate));
        } else if (state.kind === "running" && state.session.id !== "pending") {
          event.preventDefault();
          end.mutate({
            session: state.session,
            outcome: "done",
            next: nextOf(state.task?.id ?? state.rhythm?.id),
          });
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

  // While the module's work runs, its scene has the screen (docs/06-modul-sozlesmesi.md, "Sahne").
  const running = state.kind === "running" ? state : null;
  const sceneMod = running?.session.module_id
    ? moduleMap.get(running.session.module_id)
    : undefined;
  const scene = running
    ? sceneFor(
        sceneMod,
        running,
        input.workItems,
        sceneMod ? (colors.lists.get(sceneMod.row.id) ?? null) : null,
      )
    : null;
  const sessionId = running?.session.id ?? null;
  if (
    running &&
    scene &&
    sceneMod &&
    sessionId !== "pending" &&
    exitedScene !== sessionId &&
    failedScene !== sessionId
  ) {
    return (
      <>
        {/* The page keeps its heading under the scene (for screen readers). */}
        <h1 className="sr-only">Bugün</h1>
        <SceneFrame
          mod={sceneMod}
          state={running}
          scene={scene.scene}
          subject={scene.subject}
          facet={scene.facet}
          chain={runningChain}
          next={nextOf(running.task?.id ?? running.rhythm?.id)}
          date={input.date}
          brief={briefOf(input, plan, moduleMap)}
          onExit={() => setExitedScene(running.session.id)}
          onStuck={() => {
            setExitedScene(running.session.id);
            if (!running.task) return;
            stopForStuck.mutate(running.session);
            setStuck(running.task);
          }}
          onFailed={() => setFailedScene(running.session.id)}
        />
      </>
    );
  }

  // Rutin 1: a scene's "Yatıyorum" can be taken back for a while; meanwhile the night screen is
  // that scene's (docs/06-modul-sozlesmesi.md, "Diziler" rule 6; SceneProps.bedtime).
  const bedded = state.kind === "night" ? sceneBedtime(input.date, rows, now) : null;
  const beddedMod = bedded?.state.session.module_id
    ? moduleMap.get(bedded.state.session.module_id)
    : undefined;
  const beddedScene = bedded
    ? sceneFor(
        beddedMod,
        bedded.state,
        input.workItems,
        beddedMod ? (colors.lists.get(beddedMod.row.id) ?? null) : null,
      )
    : null;
  if (bedded && beddedScene && beddedMod && failedScene !== bedded.state.session.id) {
    return (
      <>
        <h1 className="sr-only">Bugün</h1>
        <SceneFrame
          key={`bed-${bedded.state.session.id}`}
          mod={beddedMod}
          state={bedded.state}
          scene={beddedScene.scene}
          subject={beddedScene.subject}
          facet={beddedScene.facet}
          date={input.date}
          brief={briefOf(input, plan, moduleMap)}
          bedtime={{ at: bedded.at, until: bedded.until }}
          onExit={() => undefined}
          onStuck={() => undefined}
          onFailed={() => setFailedScene(bedded.state.session.id)}
        />
      </>
    );
  }

  const currentId =
    state.kind === "running"
      ? (state.task?.id ?? state.rhythm?.id ?? null)
      : state.kind === "suggest"
        ? state.assignment.candidate.id
        : state.kind === "evening"
          ? (state.next?.candidate.id ?? null)
          : null;
  // Ç3f: where the current work stands in its chain, on the standard card.
  const currentChain = chainWith(chains, currentId);
  const chainText = currentChain && currentId ? chainLine(currentChain, currentId) : null;
  const assignments = plan.slots.flatMap((slot) => (slot.assignment ? [slot.assignment] : []));
  const ahead = assignments.filter((row) => row.candidate.id !== currentId);
  // When the day is done, what is still planned waits behind "Vakit kalırsa" with the rest.
  const finished = state.kind === "done";
  // At night and on the return the screen is quiet: the card alone (with the day's three on
  // the return), no list, no strip, no warnings (docs/04-planlayici.md, "Geri dönüş").
  // The evening is calm too (Ç3c): its card has what the evening holds.
  const quiet = state.kind === "night" || state.kind === "return" || state.kind === "evening";
  const upNext = quiet || finished ? [] : ahead.slice(0, 3);
  const rest = [...ahead.slice(finished ? 0 : 3).map((row) => row.candidate), ...plan.overflow];
  const doneToday = input.tasks.filter(
    (task) =>
      task.status === "done" && task.done_at && dayKey(new Date(task.done_at)) === input.date,
  );

  return (
    <>
      <TopBar input={input} plan={plan} now={now} />

      <AiBudgetNotice />

      {quiet ? null : <AlertBar warnings={plan.warnings} modules={moduleMap} />}

      {/* minmax(0, …) and min-w-0: a long title is cut with an ellipsis instead of widening
          the column past the screen. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          {running && failedScene === running.session.id ? (
            <p role="status" className="text-muted-foreground mb-2 text-sm">
              Sahne açılamadı; iş sürüyor.
            </p>
          ) : null}
          <NowCard
            state={state}
            stuck={stuck}
            onStuckChange={setStuck}
            frame={input.frame}
            startOnWake={input.settings.frame?.startOnWake ?? false}
            brief={briefLine(input, plan)}
            chainLine={chainText}
            nextOf={nextOf}
            onReturnToScene={
              scene && running && exitedScene === running.session.id
                ? () => setExitedScene(null)
                : undefined
            }
            now={now}
            date={input.date}
            modules={moduleMap}
            tomorrowFirst={tomorrowFirst}
            onShowRest={rest.length > 0 ? () => setRestOpen(true) : undefined}
          />
        </div>

        {/* The evening's card holds what the evening has (Ç3c): no list beside it. */}
        <section
          aria-label="Sıradakiler"
          hidden={state.kind === "evening" || (state.kind === "night" && input.frame !== undefined)}
          className="flex min-w-0 flex-col gap-3 lg:col-span-2"
        >
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
          {rest.length > 0 && !quiet ? (
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

      {quiet ? null : (
        <>
          <DayStrip input={input} plan={plan} now={now} modules={moduleMap} />
          <DayBlocks blocks={blocksOfDay(input.blocks, input.date)} now={now} />
        </>
      )}

      <footer className="flex flex-wrap items-center gap-2">
        <ModuleChips modules={modules.filter(({ row }) => row.status === "active")} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 md:h-9" onClick={() => setMinutesOpen(true)}>
            X dk&apos;m var
          </Button>
          <Button variant="outline" className="h-11 md:h-9" onClick={doReplan}>
            Yeniden planla
          </Button>
          {/* The evening's card has its own "Günü kapat" (Ç3c). */}
          {state.kind === "evening" ? null : (
            <Link
              href="/kapanis"
              className="border-border hover:bg-muted flex h-11 items-center rounded-lg border px-3 text-sm md:h-9"
            >
              Günü kapat
            </Link>
          )}
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
  const colors = useColors();
  const facet = colors.facetOf(candidate.moduleId, candidate);

  const parts = [
    facet ? `${mod?.row.name ?? ""} · ${facet.name}` : mod?.row.name,
    formatMinutes(candidate.minutes),
    travelText(candidate.travelBefore, candidate.travelAfter),
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
        data-testid="work-dot"
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: colors.of(candidate.moduleId, candidate) }}
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
        style={{ backgroundColor: moduleColor(mod) }}
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

/**
 * Rutin 1: tonight's bedtime written by a scene's "Yatıyorum", while it can be taken back: the
 * session it closed, with its work, and until when. Null otherwise (or when the rows are not in).
 */
function sceneBedtime(
  date: string,
  rows: PlanRows | undefined,
  now: Date,
): { state: Extract<NowState, { kind: "running" }>; at: Date; until: Date } | null {
  const day = rows?.days.find((row) => row.date === date);
  if (!rows || !day?.bed_session_id || !day.bed_at) return null;
  const until = new Date(Date.parse(day.bed_at) + BED_UNDO_MINUTES * 60_000);
  if (now >= until) return null;
  const session = rows.sessions.find((row) => row.id === day.bed_session_id);
  if (!session?.ended_at) return null;
  return {
    state: {
      kind: "running",
      session,
      task: session.task_id ? (rows.tasks.find((row) => row.id === session.task_id) ?? null) : null,
      rhythm: session.rhythm_id
        ? (rows.rhythms.find((row) => row.id === session.rhythm_id) ?? null)
        : null,
    },
    at: new Date(day.bed_at),
    until,
  };
}
