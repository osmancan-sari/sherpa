"use client";

import { Component, type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useEndSession } from "@/core/app/actions";
import { useRecordBed } from "@/core/app/frame-actions";
import { ClosingInScene } from "../closing/ClosingScreen";
import type { KnownModule } from "@/core/app/hooks";
import { facetColor, moduleColor } from "@/core/contract/colors";
import { chooseScene, findFacet, sceneTone, taskFacet } from "@/core/contract/facets";
import type {
  ModuleFacet,
  ModuleScene,
  SceneChain,
  SceneProps,
  SceneSubject,
  TodayBrief,
} from "@/core/contract/types";
import type { NowState, Plan, PlanInput } from "@/core/planner";
import type { Colors } from "@/core/app/facets";
import type { PlannedTarget } from "@/core/data/sessions";
import type { ChainLook } from "@/core/today/chain";
import { blocksOfDay } from "@/core/today/select";
import { useSay } from "@/core/voice";
import { formatMinutes, formatTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import { useModuleScope } from "../module/ModuleProvider";

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

/** The day in short for a scene or a narration (read only). */
export function briefOf(
  input: PlanInput,
  plan: Plan,
  modules: Map<string, KnownModule>,
): TodayBrief {
  const top = plan.top3.flatMap((id) => {
    const candidate = plan.candidates.find((row) => row.id === id || row.task?.work_item_id === id);
    if (!candidate) return [];
    return [
      {
        title: candidate.title,
        module: modules.get(candidate.moduleId)?.row.name ?? "",
        reason: input.advice?.reasons?.[id] ?? null,
      },
    ];
  });
  return {
    top,
    blocks: blocksOfDay(input.blocks, input.date)
      .filter((block) => block.status !== "cancelled")
      .map((block) => ({
        title: block.title,
        startsAt: new Date(block.starts_at),
        endsAt: new Date(block.ends_at),
      })),
    finishLine: input.finishLine,
    wokeAt: input.frame?.woke ? input.frame.wake : null,
    closed: Boolean(input.closed),
  };
}

/** How a chain's rows look on this screen: the module, the resolved colour, the facet (Ç3f). */
export function chainLook(modules: Map<string, KnownModule>, colors: Colors): ChainLook {
  return {
    module: (moduleId) => {
      const mod = modules.get(moduleId);
      return mod ? { slug: mod.row.slug, name: mod.row.name } : null;
    },
    color: (row) => colors.of(row.moduleId, row.work),
    facet: (row) => {
      const facet = colors.facetOf(row.moduleId, row.work);
      return facet ? { key: facet.key, name: facet.name } : null;
    },
  };
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
  brief,
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
  brief: TodayBrief;
  onExit: () => void;
  onStuck: () => void;
  onFailed: () => void;
}) {
  const { ctx } = useModuleScope(mod);
  const end = useEndSession();
  const say = useSay();
  const recordBed = useRecordBed();
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
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt.getTime()) / 1000));
  const title = state.task?.title ?? state.rhythm?.title ?? session.title ?? "";
  // Ç3e: the facet's tone and colour come before the scene's and the module's.
  const tone = sceneTone(scene, facet);
  const color = facet ? facetColor(mod.row, facet) : moduleColor(mod);
  const Scene = scene.component;

  const props: SceneProps = {
    subject,
    session: { id: session.id, startedAt, elapsedSeconds },
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
        // "Yatıyorum" ends the day: the work is done, no chain goes on from it.
        await end.mutateAsync({ session, outcome: "done" });
        await recordBed.mutateAsync({ date, at: new Date() });
      },
    },
    say,
    today: brief,
    ctx,
    facet: facet ? { key: facet.key, name: facet.name, color } : null,
    chain,
  };

  return (
    <div
      data-testid="scene"
      data-tone={tone}
      data-facet={facet?.key}
      className={cn(
        "animate-in fade-in flex min-h-[70vh] flex-1 flex-col overflow-hidden rounded-2xl border duration-300 motion-reduce:animate-none",
        TONE[tone],
      )}
      style={
        tone === "energy"
          ? { backgroundColor: `color-mix(in oklab, ${color} 12%, transparent)` }
          : undefined
      }
    >
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
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground tabular-nums">
            {" "}
            · {formatMinutes(Math.floor(elapsedSeconds / 60))}
          </span>
        </span>
        <Button variant="ghost" className="h-11 md:h-8" onClick={onExit}>
          Çık
        </Button>
      </header>
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
