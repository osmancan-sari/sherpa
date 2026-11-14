"use client";

import { Check, Volume2 } from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRefreshAll } from "@/core/app/actions";
import { useModuleQuery } from "@/core/app/hooks";
import type { SceneProps } from "@/core/contract/types";
import { SAVE_FAILED, useNotify } from "@/core/ui/Notices";
import { dayKey, formatDayLabel, formatTime, istanbulInstant, shiftDay } from "@/lib/date";
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
  runDay,
  type Unit,
  unitsOf,
} from "../server/flow";
import { glassAlpha, PANEL_RANGE, skyOf, sunElevation } from "../sky";
import { Sky } from "./Sky";

// The routine's scene (docs/moduller/rutin.md, 8.2–8.5; values: rutin-cizimler/degerler.md): one
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

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

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
  const { subject, session, controls, say, today, ctx, device, chain, bedtime, facet } = props;
  const refreshAll = useRefreshAll();
  const notify = useNotify();
  const reduceMotion = useMedia("(prefers-reduced-motion: reduce)");
  const solid = useMedia("(prefers-reduced-transparency: reduce)");
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
  const day = data.data ? runDay(session.startedAt, key, data.data.days) : null;
  const run = useModuleQuery(ctx.module, ["run", routine?.id ?? "", day ?? ""], (c) =>
    routine && day ? getRun(c, routine.id, day) : Promise.resolve(null),
  );

  // The run is opened by the session's event; if that did not land yet, the scene opens it.
  const opening = useRef(false);
  useEffect(() => {
    if (!routine || !day || !run.isSuccess || run.data || opening.current) return;
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
    data.data && day ? dayStepsOf(data.data.steps, routineId, day, lastDone) : [];
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

  const sky = useMemo(
    () => skyOf(sunElevation(new Date(Math.floor(now / 60_000) * 60_000)), evening),
    [now, evening],
  );
  const alphas = useMemo(() => {
    const texts = [glass.text, glass.secondary, glass.line, glass.note];
    return {
      big: glassAlpha(sky, glass.panel, texts, ...PANEL_RANGE.big),
      small: glassAlpha(sky, glass.small, texts, ...PANEL_RANGE.small),
    };
  }, [sky, glass]);

  const [screen, setScreen] = useState<Screen>("steps");
  // Günaydın: only when this screen was not touched lately (the waking came from outside: the
  // phone's automation opened the app, or it came back to the front in the morning). A tap on
  // "Uyandım" a moment ago means the voice is unlocked and the teeth come at once (8.3).
  const untouched = useRef(!touchedWithin(15 * 60_000));
  const [greeted, setGreeted] = useState(false);
  const runRecords = (data.data?.records ?? []).filter((row) => row.run_id === view?.id);
  const atStart = view !== null && stepIndex === 0 && partIndex === 0 && runRecords.length === 0;
  const runningAt = chain?.items.findIndex((row) => row.state === "running") ?? -1;
  const firstOfMorning =
    key === "sabah" &&
    !(chain?.items ?? []).slice(0, Math.max(0, runningAt)).some((row) => row.state === "done");
  // "Kalktım" on any screen stamps the step's start: the other screens leave Günaydın too.
  const woken = view?.step_started_at != null;
  const greeting = !greeted && untouched.current && atStart && firstOfMorning && !woken;
  // A touched screen (the tap that started it, "Uyandım") is awake: it stamps the start.
  const stampStart = Boolean(view && !woken && !untouched.current && !bedtime);
  useEffect(() => {
    if (!stampStart) return;
    const timer = setTimeout(() => apply({ step_started_at: stamp() }), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stampStart]);

  // The day's summary: said on the touched screen, and always written.
  const tomorrow = day ? shiftDay(day, 1) : null;
  const plannedBed = data.data?.days.find((row) => row.date === day)?.plannedBed ?? null;
  const summary = briefText(today, new Date(now), plannedBed);
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
      if (then === "bed") await controls.bed();
      else if (then === "goodbye") {
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

  // The board's keys: Space and Enter are this scene's "Sonraki" (the core's would end the work).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "Enter") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea, select, [role='dialog']")) return;
      if (document.querySelector('[role="dialog"], [data-scene-closing]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (bedtime) return;
      if (greeting) wake();
      else if (screen === "steps") next();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  });

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
    return {
      background: css({ ...fill, alpha: alphas[kind] }),
      border: `1px solid ${kind === "big" ? glass.panelBorder : glass.smallBorder}`,
      boxShadow: kind === "big" ? glass.panelShadow : glass.smallShadow,
      backdropFilter: `blur(${kind === "big" ? 26 : 22}px) saturate(170%)`,
      WebkitBackdropFilter: `blur(${kind === "big" ? 26 : 22}px) saturate(170%)`,
    };
  };

  const frame = (children: ReactNode, extra?: Record<string, string | undefined>) => (
    <div
      data-testid="rutin-scene"
      data-routine={key}
      data-device={device}
      data-sky={sky.phase}
      {...extra}
      className="relative -m-5 flex min-h-[78vh] flex-1 flex-col overflow-hidden md:-m-10 md:min-h-[82vh]"
      style={{ color: glass.text }}
    >
      <style>{TWINKLE}</style>
      <Sky sky={sky} device={device} evening={evening} owlAsleep={Boolean(bedtime)} />
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  );

  if (bedtime) {
    return frame(
      <GoodNight
        glass={glass}
        panel={panel("big")}
        bedAt={bedtime.at}
        wake={
          tomorrow
            ? (data.data?.days.find((row) => row.date === tomorrow)?.plannedWake ?? null)
            : null
        }
        tomorrow={tomorrow}
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
    return frame(<Centered text="İyi günler" top={board ? 340 : 300} fade={!reduceMotion} />, {
      "data-screen": "iyi-gunler",
    });
  }

  if (greeting) {
    return frame(
      <div className="flex flex-1 flex-col items-center px-6" data-screen="gunaydin">
        <div className="flex flex-col items-center gap-2" style={{ marginTop: board ? 220 : 150 }}>
          <h2 style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.03em" }}>Günaydın</h2>
          <p style={{ fontSize: 17, fontWeight: 500, color: "#d6d3ea" }}>
            {formatDayLabel(new Date(now))}
          </p>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={wake}
          className="w-full max-w-md"
          style={{ ...mainButton(glass, 64), marginBottom: 34 }}
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
        className="self-start text-left tabular-nums"
        style={{
          fontSize: board ? 168 : 84,
          fontWeight: 500,
          letterSpacing: "-0.045em",
          lineHeight: 1,
          opacity: pausedAt === null ? 1 : 0.6,
        }}
      >
        {clock(remaining)}
      </button>
    ) : null;
  const hint = step.hint ? (
    <p style={{ fontSize: board ? 22 : 19, fontWeight: 500, lineHeight: 1.4, color: glass.note }}>
      {step.hint}
    </p>
  ) : null;
  const speaking = speakingUntil > now;
  const voice =
    key === "sabah" ? (
      <div
        className="flex flex-wrap items-center gap-x-2"
        style={{ fontSize: 15, color: glass.voice, marginTop: 10 }}
      >
        <Volume2 aria-hidden size={18} />
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
      className="flex flex-col"
      style={{ ...panel("big"), borderRadius: 26, padding: "12px 8px 8px", gap: 4 }}
    >
      <div
        className="flex items-center justify-between"
        style={{ padding: "0 10px 6px", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em" }}
      >
        <span style={{ color: glass.secondary }}>BU ADIMDA</span>
        {step.lines.length > 1 ? (
          <span
            className="tabular-nums"
            data-testid="rutin-part-count"
            style={{ fontSize: 13, fontWeight: 400, letterSpacing: 0, color: glass.secondary }}
          >
            {partIndex + 1} / {step.lines.length}
          </span>
        ) : null}
      </div>
      {windowOf(step.lines, partIndex).map(({ line: row, index }) => (
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
  const wakeTomorrow = tomorrow
    ? (data.data.days.find((row) => row.date === tomorrow)?.plannedWake ?? null)
    : null;
  const lastText = evening
    ? wakeTomorrow
      ? `${wakeTomorrow} · uyku ${sleepHours(new Date(now), tomorrow!, wakeTomorrow)}`
      : null
    : nextOfDay(today, new Date(now));
  const count = `${evening ? "bu akşam" : "bu sabah"} ${current + 1} / ${units.length}`;
  const nextPanel = (
    <section
      aria-label={lastUnit ? (evening ? "Yarın" : "Sonra") : "Sıradaki"}
      data-testid="rutin-next"
      style={{ ...panel("small"), borderRadius: 22, padding: "12px 18px", marginTop: 12 }}
    >
      <div className="flex items-baseline gap-2">
        <span
          style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: glass.secondary }}
        >
          {lastUnit ? (evening ? "YARIN" : "SONRA") : "SIRADAKİ"}
        </span>
        <span className="min-w-0 flex-1 truncate" style={{ fontSize: 15, fontWeight: 600 }}>
          {lastUnit ? (lastText ?? (evening ? "Uyanış saati henüz yok" : null)) : nextUnit?.title}
        </span>
        <span
          className="tabular-nums"
          data-testid="rutin-count"
          style={{ fontSize: 13, color: glass.secondary }}
        >
          {count}
        </span>
      </div>
      <div className="flex" style={{ gap: 6, marginTop: 10 }} aria-hidden>
        {units.map((unit, index) => (
          <span
            key={unit.key}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: index <= current ? glass.accent : glass.empty,
            }}
          />
        ))}
      </div>
      {!lastUnit && after.length > 0 ? (
        <p className="truncate" style={{ fontSize: 13, marginTop: 8, color: glass.line }}>
          Sonra: {after.join(" · ")}
        </p>
      ) : null}
    </section>
  );

  // The buttons: "Sonraki" (the last step "Bitti", the evening's "Yatıyorum"), "Atla", "Hepsini yaptım".
  const finalBed = evening && lastStep && lastUnit;
  const label = lastStep && lastUnit ? (evening ? "Yatıyorum" : "Bitti") : "Sonraki";
  const height = board ? 56 : 60;
  const buttons = finalBed ? (
    <div
      className="flex flex-col items-center"
      style={{ padding: board ? "0 16px 34px" : "0 16px 34px" }}
    >
      <p style={{ fontSize: 15, color: glass.secondary, marginBottom: 8 }}>Işık kapalı.</p>
      <button
        type="button"
        onClick={() => next(true)}
        className="w-full max-w-md"
        style={mainButton(glass, 64)}
      >
        Yatıyorum
      </button>
    </div>
  ) : (
    <div style={{ padding: board ? "0 48px 34px" : "0 16px 30px" }}>
      <div className={board ? "flex items-center gap-3" : "flex gap-[10px]"}>
        {held ? (
          <HoldButton
            onDone={() => next(true)}
            style={{
              ...earlyButton(glass, height),
              ...(board ? { padding: "0 32px" } : { flex: 2 }),
            }}
          >
            Erken geç · basılı tut
          </HoldButton>
        ) : (
          <button
            type="button"
            onClick={() => next()}
            style={{
              ...mainButton(glass, height),
              ...(board ? { padding: "0 32px" } : { flex: 2 }),
            }}
          >
            {label}
          </button>
        )}
        <button
          type="button"
          onClick={() => stepDone("skipped")}
          style={{
            ...skipButton(glass, height, solid),
            ...(board ? { padding: "0 28px" } : { flex: 1 }),
          }}
        >
          Atla
        </button>
        {board && !lastStep ? (
          <button type="button" onClick={all} style={plainButton(glass)}>
            Hepsini yaptım
          </button>
        ) : null}
      </div>
      {!board && !lastStep ? (
        <button
          type="button"
          onClick={all}
          className="mt-[6px] w-full"
          style={{ ...plainButton(glass), height: 44 }}
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
      ? [
          ...(wakeTomorrow ? [{ left: wakeTomorrow, right: "Uyanış" }] : []),
          ...(wakeTomorrow
            ? [
                {
                  left: sleepHours(new Date(now), tomorrow!, wakeTomorrow),
                  right: "Uyku, yaklaşık",
                },
              ]
            : [{ left: "–", right: "Uyanış saati henüz yok." }]),
        ]
      : briefLines(today, new Date(now));
    return frame(
      <>
        <div className="grid flex-1 grid-cols-[5fr_4fr] gap-12" style={{ padding: "40px 48px 0" }}>
          <div className="flex min-w-0 flex-col" style={{ gap: 10 }}>
            <h2
              style={{ fontSize: 52, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 }}
            >
              {step.title}
            </h2>
            {counter ?? hint}
            <div style={{ marginTop: 14, maxWidth: 480 }}>{stepPanel}</div>
          </div>
          <div className="flex min-w-0 flex-col" style={{ gap: 18 }}>
            <section
              aria-label={evening ? "Yarın" : "Günün planı"}
              style={{ ...panel("big"), borderRadius: 28, padding: "22px 24px" }}
            >
              <div className="flex items-center justify-between">
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    color: glass.boardLabel,
                  }}
                >
                  {evening ? "YARIN" : speaking ? "GÜNÜN PLANI OKUNUYOR" : "GÜNÜN PLANI"}
                </span>
                {evening ? null : (
                  <button
                    type="button"
                    onClick={tell}
                    className="min-h-11"
                    style={{ fontSize: 14 }}
                  >
                    Tekrar anlat
                  </button>
                )}
              </div>
              <div className="flex flex-col" style={{ gap: 10, marginTop: 12, fontSize: 17 }}>
                {lines.map((row) => (
                  <div
                    key={`${row.left}-${row.right}`}
                    className="flex"
                    style={{ lineHeight: 1.4 }}
                  >
                    <span
                      className="shrink-0 tabular-nums"
                      style={{ width: 64, color: glass.secondary }}
                    >
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
      <header className="flex flex-col" style={{ padding: "26px 24px 0", gap: 4, minHeight: 200 }}>
        <h2 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          {step.title}
        </h2>
        {counter ?? hint}
        {voice}
        {key === "sabah" && !counter ? (
          <p data-testid="rutin-summary" style={{ fontSize: 14, color: glass.note, marginTop: 6 }}>
            {summary}
          </p>
        ) : null}
      </header>
      <div style={{ padding: "16px 16px 0" }}>
        {stepPanel}
        {nextPanel}
      </div>
      <div className="flex-1" style={{ minHeight: 24 }} />
      {buttons}
    </>,
    extra,
  );
}

// --- Pieces ----------------------------------------------------------------------------------------

const TWINKLE =
  "@keyframes rutin-twinkle{50%{opacity:.25}}@media (prefers-reduced-motion:no-preference){.rutin-twinkle{animation:rutin-twinkle 7s ease-in-out infinite}}";

/** At most three rows: the one before (done) when there is one, the current one, what comes. */
function windowOf(lines: Line[], current: number): { line: Line; index: number }[] {
  const start = Math.max(0, Math.min(current - 1, lines.length - 3));
  return lines.slice(start, start + 3).map((line, offset) => ({ line, index: start + offset }));
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
      className={
        active && !reduceMotion ? "animate-in fade-in slide-in-from-bottom-1 duration-300" : ""
      }
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: active ? 60 : 42,
        padding: "0 10px",
        borderRadius: 14,
        opacity: state === "done" ? 0.5 : 1,
        background: active ? css(glass.active) : undefined,
        boxShadow: active ? glass.activeShadow : undefined,
        fontSize: big ? 17 : 16,
      }}
    >
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: 26,
          height: 26,
          fontSize: 14,
          fontWeight: 600,
          border: active ? undefined : "1.5px solid rgba(255,255,255,0.5)",
          background: active
            ? glass.accent
            : state === "done"
              ? "rgba(255,255,255,0.16)"
              : undefined,
          color: active ? glass.onAccent : glass.text,
        }}
      >
        {state === "done" ? (
          <Check size={16} strokeWidth={2.4} />
        ) : line.kind === "addon" ? (
          "+"
        ) : (
          number
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span style={{ fontWeight: active ? 600 : 500 }}>{title}</span>
        {active && note ? (
          <span style={{ fontSize: big ? 15 : 14, color: big ? "#ece9f6" : glass.line }}>
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
      style={{ ...style, borderRadius: 28, padding: "16px 10px 10px", fontSize: 17 }}
    >
      <div
        className="flex items-center justify-between"
        style={{
          height: 28,
          padding: "0 14px",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.08em",
        }}
      >
        <span style={{ color: glass.secondary }}>{title}</span>
        <span
          className="tabular-nums"
          data-testid="rutin-count"
          style={{ fontSize: 13, fontWeight: 400, color: glass.secondary }}
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
            className="flex items-center"
            style={{
              height: 44,
              padding: "0 14px",
              gap: 12,
              borderRadius: 14,
              opacity: unit.state === "done" ? 0.6 : 1,
              background: current ? css(glass.active) : undefined,
              boxShadow: current ? glass.activeShadow : undefined,
              fontWeight: current ? 600 : 400,
            }}
          >
            {unit.state === "done" ? (
              <span
                aria-hidden
                className="flex items-center justify-center rounded-full"
                style={{ width: 14, height: 14, background: "rgba(255,255,255,0.2)" }}
              >
                <Check size={10} strokeWidth={2.4} />
              </span>
            ) : (
              <span
                aria-hidden
                className="rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  margin: "0 2px",
                  background: current ? glass.accent : undefined,
                  border: current ? undefined : "1.5px solid rgba(255,255,255,0.55)",
                }}
              />
            )}
            <span className="min-w-0 flex-1 truncate">{unit.title}</span>
            {note ? (
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: current ? glass.now : glass.secondary,
                }}
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
  style,
  children,
}: {
  onDone: () => void;
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
      className="relative overflow-hidden select-none"
      style={{ ...style, touchAction: "none" }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0"
        style={{
          width: holding ? "100%" : "0%",
          transition: holding ? "width 0.8s linear" : "none",
          background: "rgba(255,255,255,0.18)",
        }}
      />
      <span className="relative">{children}</span>
    </button>
  );
}

function Centered({ text, top, fade }: { text: string; top: number; fade: boolean }) {
  return (
    <div className="flex flex-1 justify-center">
      <h2
        className={fade ? "animate-out fade-out fill-mode-forwards delay-1000 duration-600" : ""}
        style={{ marginTop: top, fontSize: 48, fontWeight: 600, letterSpacing: "-0.03em" }}
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
    <div
      className="flex flex-1 flex-col items-center justify-end"
      style={{ padding: "0 16px 34px" }}
    >
      {late ? (
        <button
          type="button"
          onClick={onFinish}
          className="w-full max-w-md"
          style={mainButton(glass, 60)}
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
  wake,
  tomorrow,
  reduceMotion,
  onUndo,
}: {
  glass: Glass;
  panel: CSSProperties;
  bedAt: Date;
  wake: string | null;
  tomorrow: string | null;
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
      className="relative flex flex-1 flex-col items-center"
      style={{ padding: "0 32px 36px" }}
      data-dim={dim ? "true" : "false"}
      onPointerDown={() => setDim(false)}
    >
      <div
        className="flex w-full max-w-md flex-col items-center"
        style={{ marginTop: "clamp(40px, 12vh, 198px)" }}
      >
        <h2 style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.03em" }}>İyi geceler</h2>
        <p style={{ fontSize: 17, color: "#c6cde8", marginTop: 12 }}>Işık kapalı.</p>
        <section
          aria-label="Yarın"
          className="w-full"
          style={{ ...panel, borderRadius: 24, marginTop: 32, paddingBottom: 6 }}
        >
          <p
            style={{
              padding: "14px 20px 4px",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: glass.secondary,
            }}
          >
            YARIN
          </p>
          {wake && tomorrow ? (
            <>
              <div
                className="flex items-center justify-between"
                style={{ padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}
              >
                <span style={{ fontSize: 16, color: "#dfe4f6" }}>Uyanış</span>
                <span className="tabular-nums" style={{ fontSize: 22, fontWeight: 600 }}>
                  {wake}
                </span>
              </div>
              <div className="flex items-center justify-between" style={{ padding: "10px 20px" }}>
                <span style={{ fontSize: 16, color: "#dfe4f6" }}>Uyku</span>
                <span style={{ fontSize: 16, fontWeight: 600 }}>
                  yaklaşık {sleepHours(bedAt, tomorrow, wake, true)}
                </span>
              </div>
            </>
          ) : (
            <p style={{ padding: "8px 20px 10px", fontSize: 16, color: "#dfe4f6" }}>
              Uyanış saati henüz yok.
            </p>
          )}
        </section>
      </div>
      <div className="flex-1" />
      <div className="flex flex-col items-center" style={{ gap: 4 }}>
        <p style={{ fontSize: 13, color: "#9aa5c8" }}>
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
          className="min-h-11 underline underline-offset-4"
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#dfe4f6",
            textDecorationColor: "rgba(255,255,255,0.35)",
          }}
        >
          Geri al
        </button>
        {answer && answer !== "undone" ? (
          <p role="status" style={{ fontSize: 13, color: "#c6cde8" }}>
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
        className="pointer-events-none absolute -inset-[200px] bg-black"
        style={{ opacity: dim ? 0.85 : 0, transition: reduceMotion ? "none" : "opacity 1.2s ease" }}
      />
    </div>
  );
}

/** The sleep until tomorrow's waking, as said: "8 sa", "7,5 sa" (or "8 saat"). */
function sleepHours(from: Date, tomorrow: string, wake: string, long = false): string {
  const hours = (istanbulInstant(tomorrow, wake).getTime() - from.getTime()) / 3_600_000;
  const rounded = Math.max(0, Math.round(hours * 2) / 2);
  const text = String(rounded).replace(".", ",");
  return `${text} ${long ? "saat" : "sa"}`;
}

const mainButton = (glass: Glass, height: number): CSSProperties => ({
  height,
  borderRadius: height / 2,
  background: glass.button.fill,
  color: glass.button.text,
  border: `1px solid ${glass.button.border}`,
  boxShadow: glass.button.shadow,
  fontSize: height >= 64 ? 19 : 18,
  fontWeight: 600,
  letterSpacing: "-0.01em",
});

const earlyButton = (glass: Glass, height: number): CSSProperties => ({
  height,
  borderRadius: height / 2,
  background: glass.early.fill,
  color: glass.early.text,
  border: "1px solid rgba(255,255,255,0.5)",
  boxShadow: glass.early.shadow,
  fontSize: 16,
  fontWeight: 600,
});

const skipButton = (glass: Glass, height: number, solid: boolean): CSSProperties => ({
  height,
  borderRadius: height / 2,
  background: solid ? "#2a2840" : glass.skip.fill,
  border: "1px solid rgba(255,255,255,0.3)",
  boxShadow: glass.skip.shadow,
  color: glass.text,
  fontSize: 17,
  fontWeight: 500,
  ...(solid
    ? {}
    : {
        backdropFilter: "blur(18px) saturate(160%)",
        WebkitBackdropFilter: "blur(18px) saturate(160%)",
      }),
});

const plainButton = (glass: Glass): CSSProperties => ({
  color: glass.plain,
  fontSize: 15,
  fontWeight: 500,
  padding: "0 16px",
  minHeight: 44,
});
