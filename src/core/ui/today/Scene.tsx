"use client";

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
import { Button } from "@/components/ui/button";
import { useEndSession } from "@/core/app/actions";
import { useRecordBed, useUndoBed } from "@/core/app/frame-actions";
import { ClosingInScene } from "../closing/ClosingScreen";
import type { KnownModule } from "@/core/app/hooks";
import { facetColor, moduleColor } from "@/core/contract/colors";
import { chooseScene, findFacet, sceneTone, taskFacet } from "@/core/contract/facets";
import type {
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

/** Which layout this device draws: the second screen or the phone. */
export function useDevice(): SceneProps["device"] {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia("(min-width: 768px)");
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => (window.matchMedia("(min-width: 768px)").matches ? "pano" : "telefon"),
    () => "pano",
  );
}

const TONE: Record<"calm" | "focus" | "energy", string> = {
  calm: "bg-muted/40",
  focus: "bg-card",
  energy: "",
};

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
  // Ç3f: the evening closing opened by the scene, in its place (this device only).
  const [closing, setClosing] = useState(false);
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
      if (document.querySelector('[role="dialog"], [data-scene-closing]')) return;
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
      finish: async () => {
        await end.mutateAsync({ session, outcome: "done", next });
      },
      stop: async () => {
        await end.mutateAsync({ session, outcome: "stopped" });
      },
      stuck: onStuck,
      exit: onExit,
      closing: () => setClosing(true),
      bed: async () => {
        // "Yatıyorum" ends the day: the work is done, no chain goes on from it. The day keeps
        // which session did it, so that it can be taken back for a while (Rutin 1).
        await end.mutateAsync({ session, outcome: "done" });
        await recordBed.mutateAsync({ date, at: new Date(), sessionId: session.id });
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
      className={cn(
        "animate-in fade-in flex flex-col duration-300 motion-reduce:animate-none",
        TONE[tone],
        // The phone gives the whole screen to the scene: the bottom menu and "+" stay under it
        // (dialogs still open above it). The second screen keeps it in the page, beside the menu.
        device === "telefon"
          ? "bg-background fixed inset-0 z-30 overflow-x-hidden overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          : "min-h-[70vh] flex-1 overflow-hidden rounded-2xl border",
      )}
      style={
        tone === "energy"
          ? { backgroundColor: `color-mix(in oklab, ${color} 12%, var(--background))` }
          : undefined
      }
    >
      {bedtime || strip?.hidden ? null : (
        <header
          aria-label="Sahne şeridi"
          className="border-border bg-background/80 flex items-center gap-3 border-b px-4 py-2 text-sm md:px-6"
        >
          <span className="tabular-nums">{formatTime(new Date(now))}</span>
          <span
            aria-hidden
            data-testid="work-dot"
            className="size-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium" data-testid="strip-title">
              {title}
            </span>
            {stripMinutes === null ? null : (
              <span className="text-muted-foreground tabular-nums" data-testid="strip-minutes">
                {" "}
                · {formatMinutes(stripMinutes)}
              </span>
            )}
          </span>
          <Button variant="ghost" className="h-11 md:h-8" onClick={onExit}>
            Çık
          </Button>
        </header>
      )}
      <section aria-label="Sahne" className="flex flex-1 flex-col p-5 md:p-10">
        {closing ? (
          <div data-scene-closing="">
            <ClosingInScene onDone={() => setClosing(false)} />
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

/** Ç3g: whether two strips say the same (a scene sets its strip on every render it likes). */
function sameStrip(a: SceneStrip | null, b: SceneStrip | null): boolean {
  if (a === null || b === null) return a === b;
  const time = (since: Date | null | undefined) =>
    since === undefined ? "default" : since === null ? "none" : since.getTime();
  return (
    a.title === b.title &&
    Boolean(a.hidden) === Boolean(b.hidden) &&
    time(a.since) === time(b.since)
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
