"use client";

import { Check, Volume2 } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRefreshAll } from "@/core/app/actions";
import { useModuleQuery } from "@/core/app/hooks";
import type { SceneKey, SceneProps } from "@/core/contract/types";
import {
  glassAlpha,
  PANEL_RANGE,
  skyOf,
  sunElevation,
  sunRising,
  useReducedMotion,
  useReducedTransparency,
} from "@/core/ui/kit";
import { SAVE_FAILED, useNotify } from "@/core/ui/Notices";
import { dayKey, formatDayLabel, formatTime, shiftDay } from "@/lib/date";
import { briefLines, briefText, nextOfDay } from "../brief";
import { css, GLASS, type Glass, SOLID, type Tone } from "../look";
import {
  ensureRun,
  getRun,
  listRecords,
  listRoutines,
  listSteps,
  moveRun,
  type RunPatch,
  saveRecords,
  updateRun,
} from "../queries";
import {
  BULK_SECONDS,
  type DayStep,
  dayStepsOf,
  FACET_OF,
  formatSeconds,
  isRoutineKey,
  lastDoneDays,
  type Line,
  minimumDone,
  type RoutineKey,
  type Run,
  type Unit,
  unitsOf,
} from "../server/flow";
import { RutinSky } from "./RutinSky";

// The routine's scene (docs/moduller/rutin.md, 8.2–8.5; look: docs/tasarim/ekranlar/rutin.md): one
// step on the screen, its sub-steps in the "Bu adımda" panel, the morning (or the evening) as one
// list in "Sıradaki"; the sky by the clock. Where the run stands lives in the module's own row
// (rutin_runs), so both screens follow it; a timed sub-step counts from its stored start, so a
// reload finds it in the right place. Step names come from the data only.

// --- This device ---------------------------------------------------------------------------------

/** The last touch on this page: only the touched screen speaks (8.2 "Ses"; B5). */
let lastTouch = 0;
if (typeof window !== "undefined") {
  const touched = () => void (lastTouch = Date.now());
  window.addEventListener("pointerdown", touched, { capture: true, passive: true });
  window.addEventListener("keydown", touched, { capture: true, passive: true });
}
const touchedWithin = (ms: number) => Date.now() - lastTouch < ms;

/** A ticking clock while `fast` (a timer runs), else every 20 seconds (the sky moves slowly). */
function useTick(fast: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), fast ? 250 : 20_000);
    return () => clearInterval(timer);
  }, [fast]);
  return now;
}

/** Keeps the screen on while a timed sub-step runs (B6), where the device allows it. */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = () => {
      (
        navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<typeof lock> } }
      ).wakeLock
        .request("screen")
        .then((granted) => {
          if (cancelled) void granted?.release();
          else lock = granted;
        })
        .catch(() => undefined);
    };
    request();
    const again = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", again);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", again);
      void lock?.release().catch(() => undefined);
    };
  }, [on]);
}

const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/** "Dil'e", "Nemlendirici'ye": where a timed sub-step goes on to. */
function dative(name: string): string {
  const vowels = name.toLocaleLowerCase("tr").match(/[aeıioöuü]/g) ?? ["e"];
  const back = "aıou".includes(vowels[vowels.length - 1]);
  const endsInVowel = /[aeıioöuü]$/i.test(name);
  return `${name}'${endsInVowel ? "y" : ""}${back ? "a" : "e"}`;
}

const lineTitle = (line: Line) =>
  line.part.seconds ? `${line.part.title} · ${formatSeconds(line.part.seconds)}` : line.part.title;

// --- The scene -------------------------------------------------------------------------------------

export function RutinScene(props: SceneProps) {
  // A new session (the morning's second block, a day later) is a new scene.
  return <Scene key={props.session.id} {...props} />;
}

type Screen = "steps" | "goodbye";

function Scene(props: SceneProps) {
  const {
    subject,
    session,
    controls,
    say,
    today,
    ctx,
    device,
    chain,
    bedtime,
    facet,
    strip,
    keys,
  } = props;
  const refreshAll = useRefreshAll();
  const notify = useNotify();
  const reduceMotion = useReducedMotion();
  const solid = useReducedTransparency();
  const board = device === "pano";

  const meta = subject.kind === "rhythm" ? (subject.rhythm.meta as Record<string, unknown>) : {};
  const key: RoutineKey = isRoutineKey(meta?.routine) ? meta.routine : "sabah";
  const tone: Tone = (facet?.key ?? FACET_OF[key]) === "aksam" ? "aksam" : "sabah";
  const glass = GLASS[tone];
  const evening = tone === "aksam";

  const data = useModuleQuery(ctx.module, ["scene"], async (c) => {
    const today = dayKey(c.now());
    const [routines, steps, records, days, rhythms] = await Promise.all([
      listRoutines(c),
      listSteps(c),
      listRecords(c, shiftDay(today, -370)),
      c.days(shiftDay(today, -1)),
      c.work.rhythms(),
    ]);
    return {
      routines,
      steps,
      records,
      days,
      rhythms: rhythms.map(({ rhythm }) => ({ id: rhythm.id, routineId: rhythm.source_id })),
    };
  });
  const routine =
    data.data?.routines.find(
      (row) => subject.kind === "rhythm" && row.id === subject.rhythm.source_id,
    ) ?? data.data?.routines.find((row) => row.key === key);
  // The run's day is the core's planning day of the session's start (Ç3g: `session.day`).
  const day = session.day;
  const run = useModuleQuery(ctx.module, ["run", routine?.id ?? "", day], (c) =>
    routine ? getRun(c, routine.id, day) : Promise.resolve(null),
  );

  // The run is opened by the session's event; if that did not land yet, the scene opens it.
  const opening = useRef(false);
  useEffect(() => {
    if (!routine || !run.isSuccess || run.data || opening.current) return;
    opening.current = true;
    ensureRun(ctx, { routineId: routine.id, day, sessionId: session.id, at: session.startedAt })
      .then(() => refreshAll())
      .catch(() => notify(SAVE_FAILED));
  }, [routine, day, run.isSuccess, run.data, ctx, session, refreshAll, notify]);

  // What this screen did and the server has not echoed yet.
  const [local, setLocal] = useState<{ base: string; patch: RunPatch } | null>(null);
  const server = run.data ?? null;
  const view: Run | null =
    server && local && local.base === server.updated_at
      ? ({ ...server, ...local.patch } as Run)
      : server;

  const lastDone = useMemo(() => lastDoneDays(data.data?.records ?? []), [data.data]);
  const stepsOf = (routineId: string) =>
    data.data ? dayStepsOf(data.data.steps, routineId, day, lastDone) : [];
  const daySteps: DayStep[] = routine ? stepsOf(routine.id) : [];
  const stepIndex = view?.step_position ?? 0;
  const step: DayStep | undefined = daySteps[stepIndex];
  const partIndex = Math.min(view?.part_position ?? 0, Math.max(0, (step?.lines.length ?? 1) - 1));
  const line: Line | undefined = step?.lines[partIndex];

  const units: Unit[] =
    routine && subject.kind === "rhythm"
      ? unitsOf({
          chain,
          running: { rhythmId: subject.rhythm.id, routineId: routine.id, position: stepIndex },
          routineOf: (id) => data.data?.rhythms.find((row) => row.id === id)?.routineId ?? null,
          stepsOf,
        })
      : [];
  const current = units.findIndex((unit) => unit.state === "current");
  const lastUnit = current >= 0 && current === units.length - 1;
  const lastStep = stepIndex === daySteps.length - 1;

  // The timer of a timed sub-step, from its stored start (and its stop, if it was touched).
  const timed = line?.part.seconds ?? null;
  const startedAt = view?.part_started_at ? Date.parse(view.part_started_at) : null;
  const pausedAt = view?.part_paused_at ? Date.parse(view.part_paused_at) : null;
  const ticking = timed !== null && startedAt !== null && pausedAt === null;
  const now = useTick(ticking);
  const elapsedMs = startedAt !== null ? Math.max(0, (pausedAt ?? now) - startedAt) : 0;
  const remaining = timed !== null ? Math.max(0, Math.ceil(timed - elapsedMs / 1000)) : 0;
  const held = timed !== null && line?.part.hold === true && remaining > 0;
  useWakeLock(ticking && remaining > 0);

  const sky = useMemo(() => {
    const minute = new Date(Math.floor(now / 60_000) * 60_000);
    return skyOf(sunElevation(minute), { night: evening, rising: sunRising(minute) });
  }, [now, evening]);
  const alphas = useMemo(() => {
    const texts = [glass.text, glass.secondary, glass.line, glass.note];
    return {
      big: glassAlpha(sky, glass.panel, texts, ...PANEL_RANGE.big),
      small: glassAlpha(sky, glass.small, texts, ...PANEL_RANGE.small),
    };
  }, [sky, glass]);

  const [screen, setScreen] = useState<Screen>("steps");
  // The scene's height on the phone: the horizon stays at 73%, so on a short screen the header and
  // the panels above it get smaller (fewer rows, smaller timer), never the landscape.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [sceneHeight, setSceneHeight] = useState(844);
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setSceneHeight(entry.contentRect.height));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const roomy = board || sceneHeight >= 740;
  const tight = !board && sceneHeight < 620;
  // Günaydın: only when the waking came from outside (the phone's alarm automation, `core/wake`;
  // Ç3g: `today.wokeFrom`). "Uyandım" on a screen unlocked the voice already: the teeth come at
  // once (8.3).
  const fromOutside = today.wokeFrom === "outside";
  const [greeted, setGreeted] = useState(false);
  const runRecords = (data.data?.records ?? []).filter((row) => row.run_id === view?.id);
  const atStart = view !== null && stepIndex === 0 && partIndex === 0 && runRecords.length === 0;
  const runningAt = chain?.items.findIndex((row) => row.state === "running") ?? -1;
  const firstOfMorning =
    key === "sabah" &&
    !(chain?.items ?? []).slice(0, Math.max(0, runningAt)).some((row) => row.state === "done");
  // "Kalktım" on any screen stamps the step's start: the other screens leave Günaydın too.
  const woken = view?.step_started_at != null;
  const greets = fromOutside && atStart && firstOfMorning;
  const greeting = !greeted && greets && !woken;
  // No Günaydın to wait on: the step starts now (on every screen; the first write wins).
  const stampStart = Boolean(view && !woken && !greets && !bedtime);
  useEffect(() => {
    if (!stampStart) return;
    const timer = setTimeout(() => apply({ step_started_at: stamp() }), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stampStart]);

  // The day's summary: said on the touched screen, and always written.
  // Ç4a: tonight's bedtime comes with the core's brief (`today.bedtime`).
  const summary = briefText(today, new Date(now));
  const [speakingUntil, setSpeakingUntil] = useState(0);
  const tell = () => {
    say(summary, { interrupt: true });
    setSpeakingUntil(Date.now() + summary.length * 75);
  };
  const told = useRef(false);
  useEffect(() => {
    // "Uyandım" on this screen a moment ago unlocked the voice: the summary starts with the steps.
    if (told.current || greeting || !atStart || key !== "sabah" || !touchedWithin(30_000)) return;
    told.current = true;
    tell();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greeting, atStart, key]);

  // --- Writing the run ---------------------------------------------------------------------------

  const stamp = () => new Date().toISOString();
  const isTimed = (index: number, part: number) =>
    Boolean(daySteps[index]?.lines[part]?.part.seconds);
  const at = (index: number, part: number, fresh: boolean): RunPatch => ({
    step_position: index,
    part_position: part,
    ...(fresh ? { step_started_at: stamp() } : {}),
    part_started_at: isTimed(index, part) ? stamp() : null,
    part_paused_at: null,
  });

  const results = new Map(runRecords.map((row) => [row.step_id ?? "", row.result]));
  type Rec = { step_id: string; result: "done" | "skipped"; seconds: number | null; bulk: boolean };

  function apply(patch: RunPatch, records: Rec[] = [], after?: () => Promise<void> | void) {
    if (!view || !server) return;
    const before = view;
    const all = new Map(results);
    for (const record of records) all.set(record.step_id, record.result);
    const withMinimum: RunPatch =
      records.length > 0 ? { ...patch, minimum_done: minimumDone(daySteps, all) } : patch;
    setLocal({ base: server.updated_at, patch: withMinimum });
    (async () => {
      await saveRecords(
        ctx,
        records.map((record) => ({ ...record, run_id: before.id })),
      );
      const moved = await moveRun(ctx, before, withMinimum);
      await refreshAll();
      if (moved && after) await after();
    })().catch(() => {
      setLocal(null);
      notify(SAVE_FAILED);
    });
  }

  /** The step's own record and its add-ons': done up to the line it stands on, the rest `result`. */
  function recordsOf(target: DayStep, result: "done" | "skipped", fromLine: number, bulk = false) {
    const since = view?.step_started_at
      ? Date.parse(view.step_started_at)
      : session.startedAt.getTime();
    const seconds = view ? Math.max(0, Math.round((Date.now() - since) / 1000)) : null;
    const quick = bulk || (seconds !== null && seconds < BULK_SECONDS);
    const ownDone = result === "done" || target.lines[fromLine]?.kind === "addon";
    const records: Rec[] = [
      {
        step_id: target.id,
        result: ownDone ? "done" : "skipped",
        seconds: ownDone ? seconds : null,
        bulk: quick,
      },
    ];
    target.lines.forEach((row, index) => {
      if (row.kind !== "addon") return;
      const passed = index < fromLine || (result === "done" && index === fromLine);
      records.push({
        step_id: row.step.id,
        result: passed || result === "done" ? "done" : "skipped",
        seconds: null,
        bulk: quick,
      });
    });
    return records;
  }

  const finish = (records: Rec[], then: "finish" | "goodbye" | "bed") =>
    apply(at(daySteps.length, 0, true), records, async () => {
      if (then === "bed") {
        // Ç3g: asked first when it is far before bedtime; "Vazgeç" puts the last step back.
        if (!(await controls.bed()) && view) {
          await updateRun(ctx, view.id, {
            step_position: Math.max(0, daySteps.length - 1),
            part_position: 0,
          });
          await refreshAll();
        }
      } else if (then === "goodbye") {
        setScreen("goodbye");
        await new Promise((resolve) => setTimeout(resolve, reduceMotion ? 900 : 1600));
        await controls.finish();
      } else await controls.finish();
    });

  const ending = (): "finish" | "goodbye" | "bed" =>
    lastUnit ? (evening ? "bed" : "goodbye") : "finish";

  function stepDone(result: "done" | "skipped") {
    if (!step) return;
    const records = recordsOf(step, result, partIndex);
    if (lastStep) finish(records, ending());
    else apply(at(stepIndex + 1, 0, true), records);
  }

  function next(force = false) {
    if (!step || !line) return;
    if (held && !force) return;
    if (partIndex < step.lines.length - 1) apply(at(stepIndex, partIndex + 1, false));
    else stepDone("done");
  }

  function all() {
    const records = daySteps
      .slice(stepIndex)
      .flatMap((row, index) => recordsOf(row, "done", index === 0 ? partIndex : 0, true));
    finish(records, ending());
  }

  function togglePause() {
    if (!view || startedAt === null) return;
    if (pausedAt === null) apply({ part_paused_at: stamp() });
    else {
      apply({
        part_started_at: new Date(startedAt + (Date.now() - pausedAt)).toISOString(),
        part_paused_at: null,
      });
    }
  }

  // A timed sub-step ends by itself: on to the next one, its name said on the touched screen.
  useEffect(() => {
    if (!ticking || !step || timed === null || startedAt === null) return;
    const left = startedAt + timed * 1000 - Date.now();
    const lastLine = partIndex === step.lines.length - 1;
    if (lastLine && lastStep) return; // the routine's very end waits for its button
    const timer = setTimeout(
      () => {
        if (!lastLine) {
          const coming = step.lines[partIndex + 1];
          if (coming && touchedWithin(10 * 60_000)) say(coming.part.title);
          apply(at(stepIndex, partIndex + 1, false));
        } else {
          const coming = daySteps[stepIndex + 1];
          if (coming && touchedWithin(10 * 60_000)) say(coming.title);
          stepDone("done");
        }
      },
      Math.max(0, left),
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticking, stepIndex, partIndex, startedAt, timed]);

  // A timed sub-step reached without its start (an older row): it starts now. (The write is
  // the external system here; the screen follows the stored row.)
  const missingStart = Boolean(view && timed !== null && startedAt === null && !bedtime);
  useEffect(() => {
    if (!missingStart || !view) return;
    const timer = setTimeout(() => apply({ part_started_at: stamp(), part_paused_at: null }), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingStart, view?.id, stepIndex, partIndex]);

  // The board's keys (Ç3g: the scene takes them, `keys: "scene"`): Space and Enter are this
  // scene's "Sonraki" (or "Kalktım"); a held sub-step is not passed by them.
  const onKey = useRef<(key: SceneKey) => void>(() => undefined);
  useEffect(() => {
    onKey.current = (key) => {
      if (key !== "space" && key !== "enter") return;
      if (bedtime) return;
      if (greeting) wake();
      else if (screen === "steps") next();
    };
  });
  useEffect(() => keys?.listen((key) => onKey.current(key)), [keys]);

  // The core's strip (Ç3g, `strip`): the whole morning is "Sabah", counted from the waking (none
  // on Günaydın); the evening is its routine's name from its first step; no strip on "İyi günler".
  const stripTitle = evening ? (routine?.title ?? "Akşam kapanışı") : (facet?.name ?? "Sabah");
  const stripSince = evening ? session.startedAt : (today.wokeAt ?? session.startedAt);
  const stripHidden = screen === "goodbye";
  const stripTime = greeting ? null : stripSince.getTime();
  useEffect(() => {
    strip(
      stripHidden
        ? { hidden: true }
        : { title: stripTitle, since: stripTime === null ? null : new Date(stripTime) },
    );
  }, [strip, stripHidden, stripTitle, stripTime]);

  function wake() {
    setGreeted(true);
    told.current = true;
    tell();
    if (view) apply({ step_started_at: stamp() });
  }

  // --- Drawing -----------------------------------------------------------------------------------

  const panel = (kind: "big" | "small"): CSSProperties => {
    const fill = kind === "big" ? glass.panel : glass.small;
    if (solid) return { background: SOLID[tone], border: `1px solid ${glass.panelBorder}` };
    const blur = `blur(var(${kind === "big" ? "--blur-panel" : "--blur-soft"})) saturate(var(--glass-saturate))`;
    return {
      background: css({ ...fill, alpha: alphas[kind] }),
      border: `1px solid ${kind === "big" ? glass.panelBorder : glass.smallBorder}`,
      boxShadow: kind === "big" ? glass.panelShadow : glass.smallShadow,
      // Real blur only on the phone, where the landscape moves behind as the page scrolls; on
      // the board's still backdrop the panel looks the same without it (decision 3).
      ...(board ? {} : { backdropFilter: blur, WebkitBackdropFilter: blur }),
    };
  };

  const frame = (children: ReactNode, extra?: Record<string, string | undefined>) => (
    <div
      data-testid="rutin-scene"
      data-routine={key}
      data-device={device}
      data-sky={sky.phase}
      {...extra}
      ref={rootRef}
      className="relative -m-5 flex flex-1 flex-col overflow-hidden md:-m-10 md:min-h-[82vh]"
      style={{ color: glass.text }}
    >
      <RutinSky sky={sky} device={device} evening={evening} owlAsleep={Boolean(bedtime)} />
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  );

  if (bedtime) {
    return frame(
      <GoodNight
        glass={glass}
        panel={panel("big")}
        bedAt={bedtime.at}
        tomorrow={today.tomorrow}
        reduceMotion={reduceMotion}
        onUndo={async () => {
          if (!view) return bedtime.undo();
          // Back on the last step, then the bedtime goes; if it cannot, the run stays finished.
          const back = { step_position: Math.max(0, daySteps.length - 1), part_position: 0 };
          await updateRun(ctx, view.id, { ...back, part_started_at: null, part_paused_at: null });
          const result = await bedtime.undo();
          if (result !== "undone") {
            await updateRun(ctx, view.id, { step_position: daySteps.length, part_position: 0 });
          }
          await refreshAll();
          return result;
        }}
      />,
      { "data-screen": "iyi-geceler" },
    );
  }

  if (!data.data || !view || !routine) return frame(null, { "data-screen": "yukleniyor" });

  if (screen === "goodbye") {
    return frame(<Centered text="İyi günler" board={board} fade={!reduceMotion} />, {
      "data-screen": "iyi-gunler",
    });
  }

  if (greeting) {
    return frame(
      <div className="flex flex-1 flex-col items-center px-6" data-screen="gunaydin">
        <div className={`flex flex-col items-center gap-2 ${board ? "mt-55" : "mt-37.5"}`}>
          <h2 className="text-greet tracking-greet font-semibold">Günaydın</h2>
          <p className="text-lead text-warm-date font-medium">{formatDayLabel(new Date(now))}</p>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={wake}
          className={`${MAIN_BUTTON} text-heading mb-8.5 h-16 w-full max-w-md`}
          style={mainButton(glass)}
        >
          Kalktım
        </button>
      </div>,
      { "data-screen": "gunaydin" },
    );
  }

  if (!step || !line) {
    // The run is past its last step and the session has not closed yet (the other screen is on it).
    return frame(<Waiting glass={glass} onFinish={() => void controls.finish()} />, {
      "data-screen": "bitiyor",
    });
  }

  // The header: the step, the timer or the hint, the voice line in the morning's first block.
  const counter =
    timed !== null && line.part.timer ? (
      <button
        type="button"
        onClick={togglePause}
        aria-label={pausedAt === null ? "Sayacı durdur" : "Sayacı sürdür"}
        data-testid="rutin-timer"
        className={`tracking-counter self-start text-left leading-none font-medium tabular-nums ${
          board
            ? "text-counter-board"
            : roomy
              ? "text-counter"
              : tight
                ? "text-counter-xs"
                : "text-counter-sm"
        }`}
        style={{ opacity: pausedAt === null ? 1 : 0.6 }}
      >
        {clock(remaining)}
      </button>
    ) : null;
  const hint = step.hint ? (
    <p
      className={`leading-snug font-medium ${board ? "text-section" : "text-heading"}`}
      style={{ color: glass.note }}
    >
      {step.hint}
    </p>
  ) : null;
  const speaking = speakingUntil > now;
  const voice =
    key === "sabah" ? (
      <div
        className="text-note mt-2.5 flex flex-wrap items-center gap-x-2"
        style={{ color: glass.voice }}
      >
        <Volume2 aria-hidden className="size-4.5" />
        {speaking ? (
          <span>Günün planı okunuyor</span>
        ) : (
          <>
            <span>Günün planı</span>
            <span aria-hidden>·</span>
            <button type="button" onClick={tell} className="min-h-11 underline-offset-4">
              Tekrar anlat
            </button>
          </>
        )}
      </div>
    ) : null;

  const stepPanel = (
    <section
      aria-label="Bu adımda"
      className="rounded-scene flex flex-col gap-1 px-2 pt-3 pb-2"
      style={panel("big")}
    >
      <div className="tracking-label flex items-center justify-between px-2.5 pb-1.5 text-xs font-semibold">
        <span style={{ color: glass.secondary }}>BU ADIMDA</span>
        {step.lines.length > 1 ? (
          <span
            className="text-meta font-normal tracking-normal tabular-nums"
            data-testid="rutin-part-count"
            style={{ color: glass.secondary }}
          >
            {partIndex + 1} / {step.lines.length}
          </span>
        ) : null}
      </div>
      {windowOf(step.lines, partIndex, roomy ? 3 : tight ? 1 : 2).map(({ line: row, index }) => (
        <PartRow
          key={`${stepIndex}-${index}`}
          glass={glass}
          line={row}
          number={index + 1}
          state={index < partIndex ? "done" : index === partIndex ? "active" : "next"}
          note={
            index === partIndex
              ? (row.part.note ??
                (row.part.seconds && step.lines[index + 1]
                  ? `Bitince kendiliğinden ${dative(step.lines[index + 1].part.title)} geçer`
                  : step.lines.length === 1 && step.seconds > 0
                    ? `Planda ${formatSeconds(step.seconds)}`
                    : null))
              : null
          }
          big={board}
          reduceMotion={reduceMotion}
        />
      ))}
    </section>
  );

  const nextUnit = units[current + 1];
  const after = units.slice(current + 2).map((unit) => unit.title);
  // Tomorrow's expected waking and tonight's sleep, as the core plans them (Ç3g).
  const tomorrow = today.tomorrow;
  const lastText = evening
    ? tomorrow
      ? `${formatTime(tomorrow.wake)} · uyku ${sleepHours(tomorrow.sleepMinutes)}`
      : null
    : nextOfDay(today, new Date(now));
  const count = `${evening ? "bu akşam" : "bu sabah"} ${current + 1} / ${units.length}`;
  const nextPanel = (
    <section
      aria-label={lastUnit ? (evening ? "Yarın" : "Sonra") : "Sıradaki"}
      data-testid="rutin-next"
      className="rounded-soft mt-3 px-4.5 py-3"
      style={panel("small")}
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="tracking-label text-xs font-semibold" style={{ color: glass.secondary }}>
          {lastUnit ? (evening ? "YARIN" : "SONRA") : "SIRADAKİ"}
        </span>
        <span className="text-note min-w-0 flex-1 font-semibold">
          {lastUnit ? (lastText ?? (evening ? "Uyanış saati henüz yok" : null)) : nextUnit?.title}
        </span>
        <span
          className="text-meta tabular-nums"
          data-testid="rutin-count"
          style={{ color: glass.secondary }}
        >
          {count}
        </span>
      </div>
      <div className="mt-2.5 flex gap-1.5" aria-hidden>
        {units.map((unit, index) => (
          <span
            key={unit.key}
            className="h-1 flex-1 rounded-xs"
            style={{ background: index <= current ? glass.accent : glass.empty }}
          />
        ))}
      </div>
      {!lastUnit && after.length > 0 && !tight ? (
        <p className="text-meta mt-2 truncate" style={{ color: glass.line }}>
          Sonra: {after.join(" · ")}
        </p>
      ) : null}
    </section>
  );

  // The buttons: "Sonraki" (the last step "Bitti", the evening's "Yatıyorum"), "Atla", "Hepsini yaptım".
  const finalBed = evening && lastStep && lastUnit;
  const label = lastStep && lastUnit ? (evening ? "Yatıyorum" : "Bitti") : "Sonraki";
  const height = board ? "h-14" : "h-15";
  const buttons = finalBed ? (
    <div className="flex flex-col items-center px-4 pb-8.5">
      <p className="text-note mb-2" style={{ color: glass.secondary }}>
        Işık kapalı.
      </p>
      <button
        type="button"
        onClick={() => next(true)}
        className={`${MAIN_BUTTON} text-heading h-16 w-full max-w-md`}
        style={mainButton(glass)}
      >
        Yatıyorum
      </button>
    </div>
  ) : (
    <div className={board ? "px-12 pb-8.5" : "px-4 pb-7.5"}>
      <div className={board ? "flex items-center gap-3" : "flex gap-2.5"}>
        {held ? (
          <HoldButton
            onDone={() => next(true)}
            className={`${EARLY_BUTTON} ${height} ${board ? "px-8" : "flex-2"}`}
            style={earlyButton(glass)}
          >
            Erken geç · basılı tut
          </HoldButton>
        ) : (
          <button
            type="button"
            onClick={() => next()}
            className={`${MAIN_BUTTON} text-lg ${height} ${board ? "px-8" : "flex-2"}`}
            style={mainButton(glass)}
          >
            {label}
          </button>
        )}
        <button
          type="button"
          onClick={() => stepDone("skipped")}
          className={`${SKIP_BUTTON} ${height} ${board ? "px-7" : "flex-1"}`}
          style={skipButton(glass, solid)}
        >
          Atla
        </button>
        {board && !lastStep ? (
          <button
            type="button"
            onClick={all}
            className={PLAIN_BUTTON}
            style={{ color: glass.plain }}
          >
            Hepsini yaptım
          </button>
        ) : null}
      </div>
      {!board && !lastStep ? (
        <button
          type="button"
          onClick={all}
          className={`${PLAIN_BUTTON} mt-1.5 h-11 w-full`}
          style={{ color: glass.plain }}
        >
          Hepsini yaptım
        </button>
      ) : null}
    </div>
  );

  const extra = {
    "data-screen": "adim",
    "data-step": String(stepIndex),
    "data-part": String(partIndex),
    "data-held": held ? "true" : "false",
  };

  if (board) {
    const lines = evening
      ? tomorrow
        ? [
            { left: formatTime(tomorrow.wake), right: "Uyanış" },
            { left: sleepHours(tomorrow.sleepMinutes), right: "Uyku, yaklaşık" },
          ]
        : [{ left: "–", right: "Uyanış saati henüz yok." }]
      : briefLines(today, new Date(now));
    return frame(
      <>
        <div className="grid flex-1 grid-cols-[5fr_4fr] gap-12 px-12 pt-10">
          <div className="flex min-w-0 flex-col gap-2.5">
            <h2 className="text-board-title tracking-title font-bold">{step.title}</h2>
            {counter ?? hint}
            <div className="mt-3.5 max-w-120">{stepPanel}</div>
          </div>
          <div className="flex min-w-0 flex-col gap-4.5">
            <section
              aria-label={evening ? "Yarın" : "Günün planı"}
              className="rounded-panel px-6 py-5.5"
              style={panel("big")}
            >
              <div className="flex items-center justify-between">
                <span
                  className="tracking-label text-xs font-semibold"
                  style={{ color: glass.boardLabel }}
                >
                  {evening ? "YARIN" : speaking ? "GÜNÜN PLANI OKUNUYOR" : "GÜNÜN PLANI"}
                </span>
                {evening ? null : (
                  <button type="button" onClick={tell} className="min-h-11 text-sm">
                    Tekrar anlat
                  </button>
                )}
              </div>
              <div className="text-lead mt-3 flex flex-col gap-2.5">
                {lines.map((row) => (
                  <div key={`${row.left}-${row.right}`} className="flex leading-snug">
                    <span className="w-16 shrink-0 tabular-nums" style={{ color: glass.secondary }}>
                      {row.left}
                    </span>
                    <span className="min-w-0">{row.right}</span>
                  </div>
                ))}
              </div>
            </section>
            <ChainPanel
              glass={glass}
              style={panel("big")}
              units={units}
              title={evening ? "BU AKŞAM" : "BU SABAH"}
              count={`${current + 1} / ${units.length}`}
              evening={evening}
            />
          </div>
        </div>
        {buttons}
      </>,
      extra,
    );
  }

  return frame(
    <>
      {/* Above the horizon (73%): the header and the panels end here, however short the screen. */}
      <div className="flex max-h-[71%] min-h-0 flex-col overflow-hidden">
        <header
          className={`flex shrink-0 flex-col gap-1 ${tight ? "px-5 pt-3.5" : "px-6 pt-6.5"} ${roomy ? "min-h-50" : ""}`}
        >
          <h2
            className={`tracking-title leading-tight font-bold ${roomy ? "text-scene" : tight ? "text-title" : "text-4xl"}`}
          >
            {step.title}
          </h2>
          {counter ?? (tight ? null : hint)}
          {tight ? null : voice}
          {key === "sabah" && !counter && roomy ? (
            <p data-testid="rutin-summary" className="mt-1.5 text-sm" style={{ color: glass.note }}>
              {summary}
            </p>
          ) : null}
        </header>
        <div className={`min-h-0 px-4 ${tight ? "pt-2.5" : "pt-4"}`}>
          {stepPanel}
          {nextPanel}
        </div>
      </div>
      <div className="min-h-3 flex-1" />
      {buttons}
    </>,
    extra,
  );
}

// --- Pieces ----------------------------------------------------------------------------------------

/**
 * At most three rows: the one before (done) when there is one, the current one, what comes. A
 * short screen shows two (the current one first) or the current one alone.
 */
function windowOf(lines: Line[], current: number, size = 3): { line: Line; index: number }[] {
  const before = size >= 3 ? 1 : 0;
  const start = Math.max(0, Math.min(current - before, lines.length - size));
  return lines.slice(start, start + size).map((line, offset) => ({ line, index: start + offset }));
}

function PartRow({
  glass,
  line,
  number,
  state,
  note,
  big,
  reduceMotion,
}: {
  glass: Glass;
  line: Line;
  number: number;
  state: "done" | "active" | "next";
  note: string | null;
  big: boolean;
  reduceMotion: boolean;
}) {
  const active = state === "active";
  const title = line.kind === "addon" && !active ? `${line.part.title} · bugün` : lineTitle(line);
  return (
    <div
      data-state={state}
      data-kind={line.kind}
      aria-current={active ? "step" : undefined}
      className={`rounded-step flex items-center gap-3 px-2.5 ${active ? "min-h-15" : "min-h-10.5"} ${big ? "text-lead" : "text-base"} ${
        active && !reduceMotion ? "animate-in fade-in slide-in-from-bottom-1 duration-300" : ""
      }`}
      style={{
        opacity: state === "done" ? 0.5 : 1,
        background: active ? css(glass.active) : undefined,
        boxShadow: active ? glass.activeShadow : undefined,
      }}
    >
      <span
        aria-hidden
        className={`flex size-6.5 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          active ? "" : "border-scene-ring border-[length:var(--stroke-step)]"
        } ${state === "done" ? "bg-scene-done" : ""}`}
        style={{
          background: active ? glass.accent : undefined,
          color: active ? glass.onAccent : glass.text,
        }}
      >
        {state === "done" ? (
          <Check className="size-4" strokeWidth={2.4} />
        ) : line.kind === "addon" ? (
          "+"
        ) : (
          number
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={active ? "font-semibold" : "font-medium"}>{title}</span>
        {active && note ? (
          <span
            className={big ? "text-note text-warm-step" : "text-sm"}
            style={big ? undefined : { color: glass.line }}
          >
            {note}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function ChainPanel({
  glass,
  style,
  units,
  title,
  count,
  evening,
}: {
  glass: Glass;
  style: CSSProperties;
  units: Unit[];
  title: string;
  count: string;
  evening: boolean;
}) {
  return (
    <section
      aria-label={evening ? "Bu akşam" : "Bu sabah"}
      data-testid="rutin-chain"
      className="rounded-panel text-lead px-2.5 pt-4 pb-2.5"
      style={style}
    >
      <div className="tracking-label flex h-7 items-center justify-between px-3.5 text-xs font-semibold">
        <span style={{ color: glass.secondary }}>{title}</span>
        <span
          className="text-meta font-normal tabular-nums"
          data-testid="rutin-count"
          style={{ color: glass.secondary }}
        >
          {count}
        </span>
      </div>
      {units.map((unit, index) => {
        const current = unit.state === "current";
        const last = index === units.length - 1;
        const note = current
          ? "şimdi"
          : (unit.note ?? (evening && last ? "sonra: Yatıyorum" : null));
        return (
          <div
            key={unit.key}
            data-state={unit.state}
            data-mine={unit.mine ? "true" : "false"}
            className={`rounded-step flex h-11 items-center gap-3 px-3.5 ${current ? "font-semibold" : "font-normal"}`}
            style={{
              opacity: unit.state === "done" ? 0.6 : 1,
              background: current ? css(glass.active) : undefined,
              boxShadow: current ? glass.activeShadow : undefined,
            }}
          >
            {unit.state === "done" ? (
              <span
                aria-hidden
                className="bg-fill-active flex size-3.5 items-center justify-center rounded-full"
              >
                <Check className="size-2.5" strokeWidth={2.4} />
              </span>
            ) : (
              <span
                aria-hidden
                className={`mx-0.5 size-2.5 rounded-full ${current ? "" : "border-scene-ring-next border-[length:var(--stroke-step)]"}`}
                style={{ background: current ? glass.accent : undefined }}
              />
            )}
            <span className="min-w-0 flex-1 truncate">{unit.title}</span>
            {note ? (
              <span
                className="text-sm font-medium"
                style={{ color: current ? glass.now : glass.secondary }}
              >
                {note}
              </span>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

/** "Erken geç · basılı tut": a short tap does nothing; held for 0.8 s it passes. */
function HoldButton({
  onDone,
  className,
  style,
  children,
}: {
  onDone: () => void;
  className: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      data-testid="rutin-hold"
      data-holding={holding ? "true" : "false"}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setHolding(true);
        timer.current = setTimeout(() => {
          timer.current = null;
          setHolding(false);
          onDone();
        }, 800);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onContextMenu={(event) => event.preventDefault()}
      className={`relative touch-none overflow-hidden select-none ${className}`}
      style={style}
    >
      <span
        aria-hidden
        className={`bg-fill-off absolute inset-y-0 left-0 ${holding ? "w-full transition-[width] duration-800 ease-linear" : "w-0"}`}
      />
      <span className="relative">{children}</span>
    </button>
  );
}

function Centered({ text, board, fade }: { text: string; board: boolean; fade: boolean }) {
  return (
    <div className="flex flex-1 justify-center">
      <h2
        className={`text-greet tracking-greet font-semibold ${board ? "mt-85" : "mt-75"} ${
          fade ? "animate-out fade-out fill-mode-forwards delay-1000 duration-600" : ""
        }`}
      >
        {text}
      </h2>
    </div>
  );
}

function Waiting({ glass, onFinish }: { glass: Glass; onFinish: () => void }) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLate(true), 4000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="flex flex-1 flex-col items-center justify-end px-4 pb-8.5">
      {late ? (
        <button
          type="button"
          onClick={onFinish}
          className={`${MAIN_BUTTON} h-15 w-full max-w-md text-lg`}
          style={mainButton(glass)}
        >
          Bitti
        </button>
      ) : null}
    </div>
  );
}

/** "İyi geceler": tomorrow's waking and sleep; the screen dims after a while; "Geri al". */
function GoodNight({
  glass,
  panel,
  bedAt,
  tomorrow,
  reduceMotion,
  onUndo,
}: {
  glass: Glass;
  panel: CSSProperties;
  bedAt: Date;
  /** The core's: tomorrow's expected waking after this bedtime, tonight's sleep. */
  tomorrow: { wake: Date; sleepMinutes: number } | null;
  reduceMotion: boolean;
  onUndo: () => Promise<"undone" | "expired" | "changed">;
}) {
  const [dim, setDim] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (dim) return;
    const timer = setTimeout(() => setDim(true), 8000);
    return () => clearTimeout(timer);
  }, [dim]);
  return (
    <div
      className="relative flex flex-1 flex-col items-center px-8 pb-9"
      data-dim={dim ? "true" : "false"}
      onPointerDown={() => setDim(false)}
    >
      <div className="mt-[clamp(--spacing(10),12vh,--spacing(49.5))] flex w-full max-w-md flex-col items-center">
        <h2 className="tracking-greet text-5xl font-semibold">İyi geceler</h2>
        <p className="text-lead text-cool-ink-2 mt-3">Işık kapalı.</p>
        <section aria-label="Yarın" className="rounded-dense mt-8 w-full pb-1.5" style={panel}>
          <p
            className="tracking-label px-5 pt-3.5 pb-1 text-xs font-semibold"
            style={{ color: glass.secondary }}
          >
            YARIN
          </p>
          {tomorrow ? (
            <>
              <div className="border-line-soft flex items-center justify-between border-b px-5 py-2">
                <span className="text-cool-line text-base">Uyanış</span>
                <span className="text-section font-semibold tabular-nums">
                  {formatTime(tomorrow.wake)}
                </span>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-cool-line text-base">Uyku</span>
                <span className="text-base font-semibold">
                  yaklaşık {sleepHours(tomorrow.sleepMinutes, true)}
                </span>
              </div>
            </>
          ) : (
            <p className="text-cool-line px-5 pt-2 pb-2.5 text-base">Uyanış saati henüz yok.</p>
          )}
        </section>
      </div>
      <div className="flex-1" />
      <div className="flex flex-col items-center gap-1">
        <p className="text-meta text-cool-quiet">
          Yatış {formatTime(bedAt)} kaydedildi. Ekran birazdan kararır.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            onUndo()
              .then((result) => setAnswer(result))
              .catch(() => setAnswer("failed"))
              .finally(() => setBusy(false));
          }}
          className="text-note text-cool-line decoration-scene-underline min-h-11 font-semibold underline underline-offset-4"
        >
          Geri al
        </button>
        {answer && answer !== "undone" ? (
          <p role="status" className="text-meta text-cool-ink-2">
            {answer === "expired"
              ? "Geri alma süresi geçti; yatış kayıtlı."
              : answer === "changed"
                ? "Yatış başka yerden değişti; bir şey değişmedi."
                : "Geri alınamadı."}
          </p>
        ) : null}
      </div>
      <div
        aria-hidden
        className={`bg-blackout pointer-events-none absolute -inset-50 ${reduceMotion ? "" : "transition-opacity duration-1200 ease-out"}`}
        style={{ opacity: dim ? 0.85 : 0 }}
      />
    </div>
  );
}

/** Tonight's sleep, as said: "8 sa", "7,5 sa" (or "8 saat"), to the half hour. */
function sleepHours(minutes: number, long = false): string {
  const rounded = Math.max(0, Math.round((minutes / 60) * 2) / 2);
  const text = String(rounded).replace(".", ",");
  return `${text} ${long ? "saat" : "sa"}`;
}

// The scene's buttons (docs/tasarim/ekranlar/rutin.md): sizes as classes, the tone's colours as
// styles.
const MAIN_BUTTON = "rounded-full border font-semibold tracking-tight";
const EARLY_BUTTON = "border-edge-pressed rounded-full border text-base font-semibold";
const SKIP_BUTTON = "border-edge-button text-lead rounded-full border font-medium";
const PLAIN_BUTTON = "text-note min-h-11 px-4 font-medium";

const mainButton = (glass: Glass): CSSProperties => ({
  background: glass.button.fill,
  color: glass.button.text,
  borderColor: glass.button.border,
  boxShadow: glass.button.shadow,
});

const earlyButton = (glass: Glass): CSSProperties => ({
  background: glass.early.fill,
  color: glass.early.text,
  boxShadow: glass.early.shadow,
});

const skipButton = (glass: Glass, solid: boolean): CSSProperties => {
  const blur = "blur(var(--blur-skip)) saturate(var(--glass-saturate-soft))";
  return {
    background: solid ? "var(--color-scene-skip-solid)" : glass.skip.fill,
    boxShadow: glass.skip.shadow,
    color: glass.text,
    ...(solid ? {} : { backdropFilter: blur, WebkitBackdropFilter: blur }),
  };
};
