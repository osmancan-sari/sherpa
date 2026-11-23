"use client";

import { Backdrop, useBackdrop } from "@/core/ui/sky/Backdrop";
import { sceneBackdrop } from "@/core/ui/sky/moduleBackdrop";
import { TOKENS } from "@/core/ui/tokens";
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useEndSession } from "@/core/app/actions";
import { useRecordBed, useUndoBed } from "@/core/app/frame-actions";
import { ClosingInScene } from "../closing/ClosingScreen";
import type { KnownModule } from "@/core/app/hooks";
import { facetColor, moduleColor } from "@/core/contract/colors";
import { chooseScene, findFacet, sceneTone, taskFacet } from "@/core/contract/facets";
import type {
  ClosingResult,
  ModuleFacet,
  ModuleScene,
  SceneChain,
  SceneKey,
  SceneProps,
  SceneStrip,
  SceneSubject,
  TodayBrief,
} from "@/core/contract/types";
import { type NowState, type PlanInput, planningDay } from "@/core/planner";
import type { PlannedTarget } from "@/core/data/sessions";
import { useSay } from "@/core/voice";
import { formatMinutes, formatTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import { useModuleScope } from "../module/ModuleProvider";
import { useAskBed } from "./BedAsk";
import { isTyping } from "./DayParts";

// The scene (docs/06-modul-sozlesmesi.md, "Sahne"; docs/05-arayuz.md, "Sahne"): while a
// module's work runs, the Today screen is the module's, under a thin strip that stays the
// core's (the time, the work, the minutes, "Çık"). The session is the core's: the scene acts on
// it through `controls` only. A scene that fails gives the standard card back.

type Running = Extract<NowState, { kind: "running" }>;

/**
 * The running work's scene, if its module has one and says yes to this work. Ç3e: the work's
 * facet may name a scene of its own (`ui.scenes`); without one, or when it says no, the
 * module's default scene (docs/06-modul-sozlesmesi.md, "Bölümler" rule 5). A `when` that fails
 * means no scene; the standard card is always there.
 */
export function sceneFor(
  mod: KnownModule | undefined,
  state: Running,
  workItems: PlanInput["workItems"],
  facets: readonly ModuleFacet[] | null = null,
): { scene: ModuleScene; subject: SceneSubject; facet: ModuleFacet | null } | null {
  const ui = mod?.definition?.ui;
  if (!ui || (!ui.scene && !ui.scenes)) return null;
  let subject: SceneSubject | null = null;
  let facetKey: string | null = null;
  if (state.task) {
    const item = state.task.work_item_id
      ? (workItems.find((row) => row.id === state.task!.work_item_id) ?? null)
      : null;
    subject = { kind: "task", task: state.task, workItem: item };
    facetKey = taskFacet(state.task, item);
  } else if (state.rhythm) {
    subject = { kind: "rhythm", rhythm: state.rhythm };
    facetKey = state.rhythm.facet;
  }
  if (!subject) return null;
  const facet = findFacet(facets, facetKey);
  const scene = chooseScene(ui, facet, subject);
  return scene ? { scene, subject, facet } : null;
}

// --- "Çık": remembered on this device, for this session ----------------------------------------

const EXIT_KEY = "sherpa.scene.exited";
const exitListeners = new Set<() => void>();

function readExit(): string | null {
  try {
    return localStorage.getItem(EXIT_KEY);
  } catch {
    return null;
  }
}

function writeExit(sessionId: string | null) {
  try {
    if (sessionId) localStorage.setItem(EXIT_KEY, sessionId);
    else localStorage.removeItem(EXIT_KEY);
  } catch {
    // This page only.
  }
  exitListeners.forEach((listener) => listener());
}

/** The session this device left the scene of ("Çık"); null to go back ("Sahneye dön"). */
export function useSceneExit(): [string | null, (sessionId: string | null) => void] {
  const exited = useSyncExternalStore(
    (listener) => {
      exitListeners.add(listener);
      return () => exitListeners.delete(listener);
    },
    readExit,
    () => null,
  );
  return [exited, writeExit];
}

const BOARD_QUERY = `(width >= ${TOKENS["breakpoint-md"]})`;

/** Which layout this device draws: the second screen or the phone. */
export function useDevice(): SceneProps["device"] {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia(BOARD_QUERY);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => (window.matchMedia(BOARD_QUERY).matches ? "pano" : "telefon"),
    () => "pano",
  );
}

export function SceneFrame({
  mod,
  state,
  scene,
  subject,
  facet = null,
  chain = null,
  next = null,
  date,
  dayStart,
  brief,
  bedtime = null,
  onExit,
  onStuck,
  onFailed,
}: {
  mod: KnownModule;
  state: Running;
  scene: ModuleScene;
  subject: SceneSubject;
  /** Ç3e: the running work's facet in the module's current list. */
  facet?: ModuleFacet | null;
  /** Ç3f: the chain the running work is part of. */
  chain?: SceneChain | null;
  /** Ç3f: the chain's next work, started when this one ends with Bitti (setting on). */
  next?: PlannedTarget | null;
  /** The planning day (the bedtime is tonight's). */
  date: string;
  /** Ç3g: the clock time the night ends by (`dayStartClock`): the session's planning day. */
  dayStart: string;
  brief: TodayBrief;
  /**
   * Rutin 1: the session ended with the scene's "Yatıyorum" and its bedtime can still be taken
   * back: the scene stays, without the strip (`SceneProps.bedtime`).
   */
  bedtime?: { at: Date; until: Date } | null;
  onExit: () => void;
  onStuck: () => void;
  onFailed: () => void;
}) {
  const { ctx } = useModuleScope(mod);
  const end = useEndSession();
  const say = useSay();
  const recordBed = useRecordBed();
  const undoBed = useUndoBed();
  const askBed = useAskBed();
  // Ç3f: the evening closing opened by the scene, in its place (this device only). Ç4c: the
  // scene learns how it ended (`controls.closing()` resolves).
  const [closing, setClosing] = useState(false);
  const closingDone = useRef<((result: ClosingResult) => void) | null>(null);
  const openClosing = useCallback(
    () =>
      new Promise<ClosingResult>((resolve) => {
        closingDone.current?.("skipped");
        closingDone.current = resolve;
        setClosing(true);
      }),
    [],
  );
  const endClosing = useCallback((result: ClosingResult) => {
    setClosing(false);
    const done = closingDone.current;
    closingDone.current = null;
    done?.(result);
  }, []);
  // A scene that goes away with its closing open hears "skipped".
  useEffect(() => () => closingDone.current?.("skipped"), []);
  const device = useDevice();
  const session = state.session;
  const startedAt = new Date(session.started_at);
  // A second's clock for the strip and the scene's elapsed time (the shared clock ticks slower).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  // After the bedtime the clock stops where the session ended.
  const until = session.ended_at ? Date.parse(session.ended_at) : now;
  const elapsedSeconds = Math.max(0, Math.floor((until - startedAt.getTime()) / 1000));
  const workTitle = state.task?.title ?? state.rhythm?.title ?? session.title ?? "";
  // Ç3g: the strip as the scene sets it for the screen it shows; a new session starts plain.
  const [stripOf, setStripOf] = useState<{ session: string; strip: SceneStrip | null }>({
    session: session.id,
    strip: null,
  });
  const strip = stripOf.session === session.id ? stripOf.strip : null;
  const setStrip = useCallback(
    (next: SceneStrip | null) =>
      setStripOf((before) =>
        before.session === session.id && sameStrip(before.strip, next)
          ? before
          : { session: session.id, strip: next },
      ),
    [session.id],
  );
  const title = strip?.title ?? workTitle;
  // The strip's minutes: from the session's start, or the moment the scene names, or none.
  const stripSince = strip?.since === undefined ? startedAt : strip.since;
  const stripMinutes =
    stripSince === null ? null : Math.max(0, Math.floor((until - stripSince.getTime()) / 60_000));
  // Okul çekirdek A: "elapsed / allotted": the work's planned minutes unless the scene says.
  const plannedMinutes = state.task?.est_minutes ?? state.rhythm?.est_minutes ?? null;
  const stripAllotted = strip?.allotted === undefined ? plannedMinutes : strip.allotted;
  // Ç3g: the Today keys, handed to the scene that takes them.
  const takesKeys = scene.keys === "scene";
  const keyListeners = useRef(new Set<(key: SceneKey) => void>());
  const keys = useMemo(
    () =>
      takesKeys
        ? {
            listen: (handler: (key: SceneKey) => void) => {
              keyListeners.current.add(handler);
              return () => void keyListeners.current.delete(handler);
            },
          }
        : null,
    [takesKeys],
  );
  useEffect(() => {
    if (!takesKeys || closing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [data-scene-closing]'))
        return;
      const key = sceneKeyOf(event.key);
      if (!key) return;
      // Space and Enter on a focused button or link are that button's: the browser presses it.
      const target = event.target instanceof Element ? event.target : null;
      if ((key === "space" || key === "enter") && target?.closest("button, a, [role='button']")) {
        return;
      }
      if (key === "space" || key === "enter") event.preventDefault();
      keyListeners.current.forEach((handler) => handler(key));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [takesKeys, closing]);
  // Ç3e: the facet's tone and colour come before the scene's and the module's.
  const tone = sceneTone(scene, facet);
  const color = facet ? facetColor(mod.row, facet) : moduleColor(mod);
  const Scene = scene.component;
  // Ç4b: the scene stands on its tone's backdrop (calm: the hour's full landscape; focus: dark
  // and flat; energy: the work's colour fading to dark), or on the module's own. On the board it
  // is the page's backdrop (the menu stays over it); the phone's scene covers the screen and
  // carries it.
  const backdrop = sceneBackdrop(mod, tone, color);
  useBackdrop(device === "pano" ? backdrop : null);

  const props: SceneProps = {
    subject,
    session: {
      id: session.id,
      startedAt,
      elapsedSeconds,
      day: planningDay(startedAt, dayStart),
    },
    device,
    controls: {
      finish: async (counted) => {
        await end.mutateAsync({ session, outcome: "done", next, counted });
      },
      stop: async (counted) => {
        await end.mutateAsync({ session, outcome: "stopped", counted });
      },
      stuck: onStuck,
      exit: onExit,
      closing: openClosing,
      bed: async () => {
        // Ç3g: far before tonight's bedtime range it asks first; "Vazgeç" changes nothing.
        const at = new Date();
        if (!(await askBed(at))) return false;
        // "Yatıyorum" ends the day: the work is done, no chain goes on from it. The day keeps
        // which session did it, so that it can be taken back for a while (Rutin 1).
        await end.mutateAsync({ session, outcome: "done" });
        await recordBed.mutateAsync({ date, at, sessionId: session.id });
        return true;
      },
    },
    say,
    today: brief,
    ctx,
    facet: facet ? { key: facet.key, name: facet.name, color } : null,
    chain,
    strip: setStrip,
    keys,
    bedtime: bedtime
      ? {
          at: bedtime.at,
          until: bedtime.until,
          undo: () => undoBed.mutateAsync({ date, sessionId: session.id }),
        }
      : null,
  };

  return (
    <div
      data-testid="scene"
      data-bedtime={bedtime ? "" : undefined}
      data-scene-keys={takesKeys ? "" : undefined}
      data-tone={tone}
      data-facet={facet?.key}
      data-device={device}
      data-backdrop={backdrop.kind}
      className={cn(
        "animate-scene-in flex flex-col motion-reduce:animate-none",
        // The phone gives the whole screen to the scene: the bottom menu and "+" stay under it
        // (dialogs still open above it). The second screen keeps it in the page, beside the menu.
        device === "telefon"
          ? "bg-solid fixed inset-0 z-30 overflow-x-hidden overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          : "min-h-[70vh] flex-1",
      )}
    >
      {/* Its own backdrop, and the band under the clock that its content scrolls behind. */}
      {device === "telefon" ? <Backdrop kind={backdrop} contained band /> : null}
      {bedtime || strip?.hidden ? null : (
        <SceneStripBar
          device={device}
          now={new Date(now)}
          color={color}
          title={title}
          minutes={stripMinutes}
          allotted={stripAllotted}
          detail={strip?.detail ?? null}
          onExit={onExit}
        />
      )}
      <section aria-label="Sahne" className="relative z-10 flex flex-1 flex-col p-5 md:p-10">
        {closing ? (
          <div data-scene-closing="">
            <ClosingInScene onDone={endClosing} />
          </div>
        ) : (
          <SceneBoundary onError={onFailed}>
            <Scene {...props} />
          </SceneBoundary>
        )}
      </section>
    </div>
  );
}

/**
 * The core's strip over a scene (docs/tasarim/ekranlar/sahne.md): the time, the work's colour, its
 * name, the minutes, "Çık". On the phone across the top edge; on the board a glass pill. Okul
 * çekirdek A: the minutes are "elapsed / allotted" when there is an allotted time, or a short text
 * of the scene's (`detail`) in their place.
 */
export function SceneStripBar({
  device,
  now,
  color,
  title,
  minutes,
  allotted = null,
  detail = null,
  onExit,
}: {
  device: SceneProps["device"];
  now: Date;
  color: string | null;
  title: string;
  minutes: number | null;
  allotted?: number | null;
  detail?: string | null;
  onExit: () => void;
}) {
  const after = detail
    ? detail
    : minutes === null
      ? null
      : allotted
        ? `${formatMinutes(minutes)} / ${formatMinutes(allotted)}`
        : formatMinutes(minutes);
  return (
    <header
      aria-label="Sahne şeridi"
      data-glass=""
      className={cn(
        // Over the scene's section: on the board a scene's sky may reach the whole screen
        // (`Landscape` `screen`) and must not cover the strip.
        "h-strip backdrop-blur-strip relative z-20 flex shrink-0 items-center gap-2.5 backdrop-saturate-170",
        device === "telefon"
          ? "bg-scene-strip-night border-line border-b pr-2 pl-5 text-sm"
          : "bg-scene-strip border-edge-strip rounded-rail text-note gap-3 border pr-3 pl-5.5",
      )}
    >
      <span className="font-medium tabular-nums">{formatTime(now)}</span>
      {color ? (
        <span
          aria-hidden
          data-testid="work-dot"
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span className="truncate font-semibold" data-testid="strip-title">
          {title}
        </span>
        {after === null ? null : (
          <span className="text-ink-2 whitespace-nowrap tabular-nums" data-testid="strip-minutes">
            · {after}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onExit}
        className="text-note min-h-touch focus-visible:shadow-focus rounded-full px-3 font-semibold outline-none"
      >
        Çık
      </button>
    </header>
  );
}

/**
 * Ç4c: the evening closing when no active module holds it in its scene (`hostsClosing`): the
 * standard scene shell, the core's strip ("Akşam kapanışı", "Çık") over the hour's landscape,
 * and the closing inside. "Çık", "Vazgeç" and "Onayla" go back to Today. No session runs.
 */
export function ClosingShell({ onDone }: { onDone: () => void }) {
  const device = useDevice();
  const [opened] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useBackdrop(device === "pano" ? { kind: "full" } : null);
  return (
    <div
      data-testid="closing-shell"
      data-device={device}
      className={cn(
        "animate-scene-in flex flex-col motion-reduce:animate-none",
        device === "telefon"
          ? "bg-solid fixed inset-0 z-30 overflow-x-hidden overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          : "min-h-[70vh] flex-1",
      )}
    >
      {device === "telefon" ? <Backdrop kind={{ kind: "full" }} contained band /> : null}
      <SceneStripBar
        device={device}
        now={new Date(now)}
        color={null}
        title="Akşam kapanışı"
        minutes={Math.max(0, Math.floor((now - opened) / 60_000))}
        onExit={onDone}
      />
      <section aria-label="Sahne" className="relative z-10 flex flex-1 flex-col p-5 md:p-10">
        <div data-scene-closing="">
          <ClosingInScene onDone={onDone} />
        </div>
      </section>
    </div>
  );
}

/** Ç3g: whether two strips say the same (a scene sets its strip on every render it likes). */
function sameStrip(a: SceneStrip | null, b: SceneStrip | null): boolean {
  if (a === null || b === null) return a === b;
  const time = (since: Date | null | undefined) =>
    since === undefined ? "default" : since === null ? "none" : since.getTime();
  return (
    a.title === b.title &&
    Boolean(a.hidden) === Boolean(b.hidden) &&
    time(a.since) === time(b.since) &&
    a.allotted === b.allotted &&
    (a.detail ?? null) === (b.detail ?? null)
  );
}

/** Ç3g: the Today keys a scene may take (docs/05-arayuz.md, "Klavye"). */
function sceneKeyOf(key: string): SceneKey | null {
  if (key === " ") return "space";
  if (key === "Enter") return "enter";
  const lower = key.toLowerCase();
  return lower === "e" || lower === "x" || lower === "r" ? lower : null;
}

/** A scene that throws gives the standard card back; the session is untouched. */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
