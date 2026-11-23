"use client";

import { Check, Info, Play } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
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
import { useWelcomeLater } from "@/core/app/frame-actions";
import { useAnswerFollowUp, useDefer, useReplan, useStopForStuck } from "@/core/app/plan-actions";
import { moduleColor } from "@/core/contract/colors";
import type { ChipData, Health } from "@/core/contract/types";
import { buildPlan, type Candidate, dayStartClock, tomorrowInput } from "@/core/planner";
import { sceneBedtime } from "@/core/today/bedtime";
import { briefOf } from "@/core/today/brief";
import type { PlannedTarget } from "@/core/data/sessions";
import { chainLine, chainsOf, chainWith, nextInChain, sceneChain } from "@/core/today/chain";
import { breakText, closedUpNext, type UpNextRow, upNextOf } from "@/core/today/flow";
import { blocksOfDay } from "@/core/today/select";
import { type Welcome, welcomeOf } from "@/core/today/welcome";
import type { Block, Task } from "@/core/types";
import { dayKey, formatDue, formatMinutes, formatTime } from "@/lib/date";
import { blockViewHref, blockViewOf } from "@/core/contract/blockView";
import { BlockViewFrame, useBlockParam } from "./BlockView";
import { effortText, isPlaceholder } from "@/core/today/effort";
import { cn } from "@/lib/utils";
import { AiBadge } from "../ai/AiMarks";
import { IconButton } from "../kit/Button";
import { ReadError } from "../kit/Feedback";
import { ListMore, ListRow } from "../kit/ListRow";
import { PanelLabel } from "../kit/Panel";
import { ClientOnly } from "../ClientOnly";
import { useNotify } from "../Notices";
import { QuickAddButton } from "../QuickAdd";
import { useLayoutDevice } from "../sky/Backdrop";
import { useClosingHost } from "./closing-host";
import { AlertBar, DayFlowPanel, isTyping, MinutesDialog, TopBar } from "./DayParts";
import { NowCard, sessionTargetOf, travelText } from "./NowCard";
import { chainLook } from "./chains";
import { ClosingShell, SceneFrame, sceneFor, useSceneExit } from "./Scene";
import { briefLine } from "./frame-text";
import { useWakeChainStart } from "./wake-chain";
import { WelcomeFrame, welcomeSceneFor } from "./Welcome";

// The Today screen (docs/05-arayuz.md; look docs/tasarim/ekranlar/bugun.md, Ç4c): drawn from
// the planner's plan, re-made on every change and every minute. The "now" card, "Sıradakiler",
// the day's flow, at most two warnings, one chip per module and the bottom line. On the board
// everything on one screen (the card and the list 5:3); on the phone one column.

export function TodayScreen() {
  return (
    <div className="flex w-full flex-1 flex-col gap-3.5 px-4 pt-4.5 pb-6 md:gap-5 md:px-10 md:pt-6 md:pb-6.5">
      <ClientOnly
        fallback={<h1 className="text-title tracking-title px-1 font-bold md:text-3xl">Bugün</h1>}
      >
        {/* Okul çekirdek A: the address may name a block whose view opens (`?blok=`). */}
        <Suspense fallback={null}>
          <TodayBody />
        </Suspense>
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
  const moduleMap = useMemo(() => new Map(modules.map((mod) => [mod.row.id, mod])), [modules]);
  // The scene (Ç3c): left on this device ("Çık"), or failed, per session.
  const [exitedScene, setExitedScene] = useSceneExit();
  // Okul çekirdek A: a fixed block's view, named in the address. A block that is not there (or
  // opens nothing) leaves the address clean: plain Today.
  const blockParam = useBlockParam();
  const blockMissing =
    blockParam.blockId !== null &&
    input !== undefined &&
    input !== null &&
    !input.blocks.some((row) => row.id === blockParam.blockId && blockViewOf(row, moduleMap));
  const closeBlock = blockParam.close;
  useEffect(() => {
    if (blockMissing) closeBlock();
  }, [blockMissing, closeBlock]);
  const [failedScene, setFailedScene] = useState<string | null>(null);
  const [stuck, setStuck] = useState<Task | null>(null);
  const stopForStuck = useStopForStuck();
  // Ç4c: the evening closing in the standard scene shell, when no active module holds it.
  const closingHost = useClosingHost(modules);
  const [closingOpen, setClosingOpen] = useState(false);

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
  const chainStarting = useWakeChainStart(input, plan, chains.wake);

  // Sabah açılışı: the welcome of the wake chain's scene in the Today screen's place. "Şimdi
  // değil" leaves it for the day on every device (the day's row); one that fails gives Today back.
  // After "Başla" the welcome is held until the scene comes (the waking is written at once, so
  // the moment is no longer the welcome's), or for a while if nothing comes.
  const welcomeLater = useWelcomeLater();
  const [failedWelcome, setFailedWelcome] = useState<string | null>(null);
  // "Şimdi değil" said on this screen: it holds here even if the write fails (offline), so the
  // full-screen welcome never keeps the user from Today.
  const [laterHere, setLaterHere] = useState<string | null>(null);
  const [held, setHeld] = useState<Welcome | null>(null);
  const sceneReady = plan?.now.kind === "running" && plan.now.session.id !== "pending";
  useEffect(() => {
    if (!held) return;
    const timer = setTimeout(() => setHeld(null), sceneReady ? 0 : HOLD_WELCOME_MS);
    return () => clearTimeout(timer);
  }, [held, sceneReady]);

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
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      // Ç3f: the closing opened inside a scene has its own keys (Enter, Escape).
      if (document.querySelector("[data-scene-closing]")) return;
      // Ç3g: a scene that takes the keys has them (SceneProps.keys).
      if (document.querySelector("[data-scene-keys]")) return;
      // Okul çekirdek A: a scene that asks on the way out finishes with Space through its step.
      if (event.key === " " && document.querySelector("[data-scene-exit-step]")) return;
      // Sabah açılışı: the welcome is on the screen; its buttons take Space and Enter themselves.
      if (document.querySelector("[data-welcome]")) return;
      if (!state || !input) return;
      const key = event.key.toLowerCase();
      // Space and Enter on a focused button are that button's (the browser presses it).
      const onButton =
        event.target instanceof Element && event.target.closest("button, a, [role='button']");
      if (event.key === " ") {
        if (onButton) return;
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
    // XP1: the title with the day and the hour, the panel in the card's place.
    return (
      <>
        <TopBar now={now} />
        <LoadFailed onRetry={retry} />
      </>
    );
  }
  if (loading || !input || !plan || !state) {
    return (
      <>
        <TopBar now={now} />
        <div className="glass-main rounded-panel min-h-56 md:min-h-72" />
      </>
    );
  }

  // Okul çekirdek A: a fixed block the module proposed, opened from Today, the day's flow or
  // Takvim: its module's view in the scene's place; no session, no time counted.
  const openBlock = blockParam.blockId
    ? input.blocks.find((row) => row.id === blockParam.blockId)
    : undefined;
  const openView = openBlock ? blockViewOf(openBlock, moduleMap) : null;
  const openMod = openBlock?.module_id ? moduleMap.get(openBlock.module_id) : undefined;
  if (openBlock && openView && openMod) {
    return (
      <>
        <h1 className="sr-only">Bugün</h1>
        <BlockViewFrame
          mod={openMod}
          block={openBlock}
          view={openView}
          facets={colors.lists.get(openMod.row.id) ?? null}
          now={now}
          onExit={blockParam.close}
        />
      </>
    );
  }

  // Ç4c: the closing opened from the evening card, in the standard scene shell (this device).
  if (closingOpen && !closingHost.hosted) {
    return (
      <>
        <h1 className="sr-only">Bugün</h1>
        <ClosingShell onDone={() => setClosingOpen(false)} />
      </>
    );
  }

  // Sabah açılışı (docs/06-modul-sozlesmesi.md, "Sahne", rule 7): in the morning, before the
  // wake chain begins, the welcome of the scene that would show its first work.
  const welcome =
    held && !sceneReady
      ? held
      : !chainStarting && failedWelcome !== input.date
        ? welcomeOf(
            input,
            chains.wake,
            laterHere === input.date ||
              (rows?.days.some((day) => day.date === input.date && day.welcome_later_at !== null) ??
                false),
          )
        : null;
  const welcomeMod = welcome ? moduleMap.get(welcome.row.moduleId) : undefined;
  const welcomeScene =
    welcome && welcomeMod
      ? welcomeSceneFor(welcomeMod, welcome, colors.lists.get(welcomeMod.row.id) ?? null)
      : null;
  if (welcome && welcomeScene && welcomeMod) {
    return (
      <>
        <h1 className="sr-only">Bugün</h1>
        <WelcomeFrame
          mod={welcomeMod}
          scene={welcomeScene.scene}
          subject={welcomeScene.subject}
          facet={welcomeScene.facet}
          welcome={welcome}
          date={input.date}
          brief={briefOf(input, plan, moduleMap)}
          onStart={() => setHeld(welcome)}
          onStartFailed={() => setHeld(null)}
          onLater={() => {
            setLaterHere(input.date);
            welcomeLater.mutate({ date: input.date, at: new Date() });
          }}
          onFailed={() => setFailedWelcome(input.date)}
        />
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
          dayStart={dayStartClock(input.settings)}
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
          dayStart={dayStartClock(input.settings)}
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
  // At night, on the return and in the evening the screen is calm: the card alone (bugun.md;
  // docs/04-planlayici.md, "Geri dönüş"); at night only the hour. The empty day has no list, no
  // strip and no warnings (bos-ve-hata.md).
  const quiet = state.kind === "night" || state.kind === "return" || state.kind === "evening";
  const empty = state.kind === "empty";
  const upNext = quiet || empty ? [] : upNextOf(input, plan, currentId);
  const doneToday = input.tasks.filter(
    (task) =>
      task.status === "done" && task.done_at && dayKey(new Date(task.done_at)) === input.date,
  );

  const card = (
    <NowCard
      state={state}
      stuck={stuck}
      onStuckChange={setStuck}
      frame={input.frame}
      startOnWake={input.settings.frame?.startOnWake ?? false}
      brief={briefLine(input)}
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
      closingHere={closingHost.hosted ? undefined : () => setClosingOpen(true)}
    />
  );

  if (state.kind === "night") {
    return (
      <>
        <TopBar now={now} />
        <div className="flex flex-1 flex-col justify-center">{card}</div>
      </>
    );
  }

  return (
    <>
      <TopBar now={now} />

      {/* minmax(0, …) and min-w-0: a long title is cut with an ellipsis instead of widening
          the column past the screen. On the board the card and the list stand 5:3. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3.5 md:grid-cols-8 md:gap-6.5">
        <div className="flex min-w-0 flex-col gap-2 md:col-span-5">
          {running && failedScene === running.session.id ? (
            <p role="status" className="text-ink-2 text-note px-1">
              Sahne açılamadı; iş sürüyor.
            </p>
          ) : null}
          {card}
        </div>
        {quiet || empty ? null : (
          <div className="flex min-w-0 flex-col gap-3.5 md:col-span-3 md:gap-5">
            <UpNext rows={upNext} date={input.date} now={now} modules={moduleMap} />
            {doneToday.length > 0 ? (
              <DoneToday tasks={doneToday} modules={moduleMap} className="max-md:hidden" />
            ) : null}
          </div>
        )}
      </div>

      {quiet || empty ? null : (
        <>
          <DayFlowPanel
            input={input}
            plan={plan}
            sessions={rows?.sessions ?? []}
            now={now}
            modules={moduleMap}
          />
          <AlertBar warnings={plan.warnings} modules={moduleMap} />
          <DayBlocks blocks={blocksOfDay(input.blocks, input.date)} now={now} modules={moduleMap} />
        </>
      )}

      {quiet ? null : (
        <footer className="flex flex-col gap-3.5 md:mt-auto md:flex-row md:items-end md:justify-between md:gap-6">
          <ModuleChips modules={modules.filter(({ row }) => row.status === "active")} />
          <div className="flex shrink-0 flex-wrap gap-2.5 md:flex-nowrap">
            <Button
              variant="secondary"
              size="sm"
              className={LANDSCAPE_FILL}
              onClick={() => setMinutesOpen(true)}
            >
              X dk&apos;m var
            </Button>
            <Button variant="secondary" size="sm" className={LANDSCAPE_FILL} onClick={doReplan}>
              Yeniden planla
            </Button>
            <span className="max-md:hidden">
              <QuickAddButton />
            </span>
          </div>
        </footer>
      )}
      {!quiet && doneToday.length > 0 ? (
        <DoneToday tasks={doneToday} modules={moduleMap} className="md:hidden" />
      ) : null}

      {/* At the end of the screen, under its bottom line (XT6, XP3). */}
      <AiBudgetNotice />

      <MinutesDialog
        open={minutesOpen}
        onOpenChange={setMinutesOpen}
        input={input}
        modules={moduleMap}
      />
    </>
  );
}

/** How long the welcome waits for its scene after "Başla" before Today comes back. */
const HOLD_WELCOME_MS = 15_000;

/** Shown when the data could not be read. One plain sentence and a way to try again. */
/** "Veri okunamadı": the screen's main panel in its place (docs/tasarim/ekranlar/bos-ve-hata.md). */
export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <ReadError
      onRetry={onRetry}
      className="md:max-w-read min-h-56 justify-between md:p-8 md:[&>p]:text-xl"
    />
  );
}

/**
 * "Sıradakiler" (4.2): the day's rest of the plan. Closed, its first work rows (two on the phone,
 * three on the board) and "Hepsini göster"; open, everything in order (work, breaks, fixed
 * blocks) and "Küçült". Empty: "Sırada başka iş yok." and no button.
 */
function UpNext({
  rows,
  date,
  now,
  modules,
}: {
  rows: UpNextRow[];
  date: string;
  now: Date;
  modules: Map<string, KnownModule>;
}) {
  const board = useLayoutDevice() === "pano";
  const [open, setOpen] = useState(false);
  const closed = closedUpNext(rows, board ? 3 : 2);
  const shown = open ? rows : closed;
  const more = rows.length > closed.length;
  return (
    <section aria-label="Sıradakiler" className="glass-dense rounded-dense flex flex-col">
      <PanelLabel className="px-4 pt-3.5 pb-1">Sıradakiler</PanelLabel>
      {rows.length === 0 ? (
        <p className="text-ink-2 px-4 pt-1 pb-4 text-base">Sırada başka iş yok.</p>
      ) : (
        <ul id="sradakiler-listesi" className="flex flex-col">
          {shown.map((row) =>
            row.kind === "work" ? (
              <li key={row.key}>
                <CandidateRow
                  candidate={row.assignment.candidate}
                  minutes={row.assignment.minutes}
                  at={row.anchored ? row.start : null}
                  date={date}
                  mod={modules.get(row.assignment.candidate.moduleId)}
                  now={now}
                />
              </li>
            ) : row.kind === "break" ? (
              <li
                key={row.key}
                className="text-ink-2 border-line flex h-9.25 items-center border-b pl-11.5 text-sm"
              >
                {breakText(row.minutes)}
              </li>
            ) : (
              <li key={row.key}>
                <ListRow
                  block
                  // Okul çekirdek A: a block the module proposed opens its view.
                  href={blockViewOf(row.block, modules) ? blockViewHref(row.block.id) : undefined}
                  title={row.block.title}
                  subtitle={`${formatTime(row.start)}–${formatTime(row.end)} · sabit`}
                />
              </li>
            ),
          )}
        </ul>
      )}
      {more ? (
        <ListMore open={open} onToggle={() => setOpen(!open)} controls="sradakiler-listesi" />
      ) : null}
    </section>
  );
}

function CandidateRow({
  candidate,
  minutes,
  at,
  date,
  mod,
  now,
}: {
  candidate: Candidate;
  minutes: number;
  /** Wake-bound or bed-bound work: its time is written. */
  at: Date | null;
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
    // Okul çekirdek A: a placeholder effort's minutes are "yaklaşık".
    effortText(minutes, isPlaceholder(candidate.item)),
    travelText(candidate.travelBefore, candidate.travelAfter),
    candidate.progress,
    candidate.type === "follow_up" ? "takip" : null,
    candidate.dueAt ? formatDue(candidate.dueAt, now) : null,
    at ? formatTime(at) : null,
  ].filter(Boolean);

  const item = candidate.item;
  const effortUsedUp =
    item !== undefined &&
    item.effort_total_minutes !== null &&
    item.effort_done_minutes >= item.effort_total_minutes;

  return (
    <ListRow
      dot={colors.of(candidate.moduleId, candidate)}
      dotTestId="work-dot"
      title={candidate.title}
      titleProps={{ className: "truncate" }}
      subtitle={<span className="block truncate tabular-nums">{parts.join(" · ")}</span>}
      trailing={
        <>
          {(candidate.task ?? candidate.item) ? (
            <AiBadge row={(candidate.task ?? candidate.item)!} align="right" />
          ) : null}
          {candidate.type === "follow_up" ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => followUp.mutate({ task: candidate.task!, came: true, date })}
            >
              Cevap geldi
            </Button>
          ) : (
            <IconButton
              label={`Başla: ${candidate.title}`}
              title={`Başla: ${candidate.title}`}
              onClick={() => start.mutate(sessionTargetOf(candidate))}
            >
              <Play aria-hidden />
            </IconButton>
          )}
          {candidate.type === "task" ? (
            <IconButton
              label={`Bitti: ${candidate.title}`}
              title={`Bitti: ${candidate.title}`}
              onClick={() => complete.mutate(candidate.id)}
            >
              <Check aria-hidden />
            </IconButton>
          ) : null}
          {candidate.type === "rhythm" ? (
            <IconButton
              label={`Yapıldı: ${candidate.title}`}
              title={`Yapıldı: ${candidate.title}`}
              onClick={() => logRhythm.mutate(candidate.id)}
            >
              <Check aria-hidden />
            </IconButton>
          ) : null}
          {/* The item's effort is used up: it does not close on its own, the user is asked. */}
          {candidate.type === "item" && effortUsedUp ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => closeItem.mutate({ itemId: candidate.id, result: "done" })}
            >
              Bitti mi?
            </Button>
          ) : null}
        </>
      }
    />
  );
}

/** "Bugün bitenler (n)" (BT32, BP27): the day's finished work, each with "Geri al". */
function DoneToday({
  tasks,
  modules,
  className,
}: {
  tasks: Task[];
  modules: Map<string, KnownModule>;
  className?: string;
}) {
  const reopen = useReopenTask();
  const colors = useColors();
  return (
    <section
      aria-label="Bugün bitenler"
      className={cn("glass-dense rounded-dense flex flex-col", className)}
    >
      <PanelLabel className="px-4 pt-3.5 pb-1">Bugün bitenler ({tasks.length})</PanelLabel>
      <ul className="flex flex-col">
        {tasks.map((task) => (
          <li key={task.id}>
            <ListRow
              dot={colors.of(task.module_id, { task })}
              title={task.title}
              titleProps={{ className: "truncate" }}
              subtitle={[
                modules.get(task.module_id)?.row.name,
                formatMinutes(task.est_minutes ?? 0),
              ]
                .filter(Boolean)
                .join(" · ")}
              trailing={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => reopen.mutate(task.id)}
                  aria-label={`Geri al: ${task.title}`}
                >
                  Geri al
                </Button>
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Bugünün sabit blokları" on the phone (BT31); the board has them in the day's flow. */
function DayBlocks({
  blocks,
  now,
  modules,
}: {
  blocks: Block[];
  now: Date;
  modules: Map<string, KnownModule>;
}) {
  const shown = blocks.filter((block) => block.status !== "cancelled");
  const time = now.getTime();
  if (shown.length === 0) return null;
  return (
    <section
      aria-label="Bugünün sabit blokları"
      className="glass-dense rounded-dense flex flex-col md:hidden"
    >
      <PanelLabel className="px-4 pt-3.5 pb-1">Bugünün sabit blokları</PanelLabel>
      <ul className="flex flex-col">
        {shown.map((block) => (
          <li key={block.id}>
            <ListRow
              aria-current={
                Date.parse(block.starts_at) <= time && Date.parse(block.ends_at) > time
                  ? "time"
                  : undefined
              }
              // Okul çekirdek A: a block the module proposed opens its view.
              href={blockViewOf(block, modules) ? blockViewHref(block.id) : undefined}
              title={block.title}
              subtitle={
                <span className="tabular-nums">
                  {formatTime(new Date(block.starts_at))}–{formatTime(new Date(block.ends_at))}
                  {block.location ? ` · ${block.location}` : ""}
                </span>
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

const HEALTH_LABEL: Record<Health, string> = {
  ok: "yolunda",
  attention: "dikkat",
  behind: "geride",
};

/**
 * Without a panel over the full landscape (BT32, BP01): each chip and button carries the soft
 * glass, which deepens over a bright sky until its text reads at 4.5:1 (Backdrop,
 * landscapeAlpha); the frames draw them in the dark sky.
 */
const LANDSCAPE_FILL = "bg-glass-soft hover:bg-glass-dense";

/** One line of status per module; touching it opens the module's page. */
function ModuleChips({ modules }: { modules: KnownModule[] }) {
  if (modules.length === 0) return null;
  return (
    <nav aria-label="Modüller" className="flex min-w-0 flex-wrap gap-2">
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
      className={cn(
        "h-control-sm border-edge focus-visible:shadow-focus relative flex items-center gap-2 rounded-full border px-3.5 text-sm whitespace-nowrap outline-none",
        "after:absolute after:inset-x-0 after:-inset-y-0.75",
        LANDSCAPE_FILL,
      )}
    >
      <span
        aria-hidden
        className="size-2.25 shrink-0 rounded-full"
        style={{ backgroundColor: moduleColor(mod) }}
      />
      <span className="font-semibold">{mod.row.name}</span>
      {data?.text ? <span className="text-ink-2">{data.text}</span> : null}
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
  // An information, not a warning: no warning colour (docs/tasarim/ekranlar/bos-ve-hata.md).
  return (
    <p role="note" className="text-ink-2 text-note flex items-start gap-2 px-1">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      Bu ayın yapay zeka bütçesi doldu; girişler ay sonuna kadar elle yönlendirilir.
    </p>
  );
}
