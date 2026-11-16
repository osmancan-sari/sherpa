"use client";

import { Component, type ReactNode, useSyncExternalStore } from "react";
import { useStartChain } from "@/core/app/actions";
import { useRecordWake } from "@/core/app/frame-actions";
import type { KnownModule } from "@/core/app/hooks";
import { facetColor, moduleColor } from "@/core/contract/colors";
import { chooseScene, findFacet, sceneTone, taskFacet } from "@/core/contract/facets";
import type {
  ModuleFacet,
  ModuleScene,
  SceneSubject,
  SceneWelcomeProps,
  TodayBrief,
} from "@/core/contract/types";
import type { Welcome } from "@/core/today/welcome";
import { Backdrop, useBackdrop } from "@/core/ui/sky/Backdrop";
import { sceneBackdrop } from "@/core/ui/sky/moduleBackdrop";
import { cn } from "@/lib/utils";
import { useModuleScope } from "../module/ModuleProvider";
import { sessionTargetOf } from "./NowCard";
import { useDevice } from "./Scene";

// Sabah açılışı (16 Nov 2026; docs/06-modul-sozlesmesi.md, "Sahne", rule 7): in the morning, the
// app opens on the welcome of the scene that would show the wake chain's first work, instead of
// the Today screen ("Günaydın", one "Başla"). The core decides when (`welcomeOf`, pure) and owns
// the frame (the phone's whole screen, the board's page beside the menu; the backdrop; the safe
// area); the module draws the welcome. "Başla" records the waking as "Uyandım" does and starts the
// work; "Şimdi değil" leaves it for the day on this device.

/** The welcome's scene for the chain's first work: its module's, if that scene has a welcome. */
export function welcomeSceneFor(
  mod: KnownModule | undefined,
  welcome: Welcome,
  facets: readonly ModuleFacet[] | null,
): { scene: ModuleScene; subject: SceneSubject; facet: ModuleFacet | null } | null {
  const ui = mod?.definition?.ui;
  if (!mod || mod.row.status !== "active" || !ui || (!ui.scene && !ui.scenes)) return null;
  const { task, item, rhythm } = welcome.row.work;
  let subject: SceneSubject | null = null;
  let facetKey: string | null = null;
  if (task) {
    subject = { kind: "task", task, workItem: item ?? null };
    facetKey = taskFacet(task, item);
  } else if (rhythm) {
    subject = { kind: "rhythm", rhythm };
    facetKey = rhythm.facet;
  }
  // A work item's first sitting has no task yet: no subject for a scene, no welcome.
  if (!subject) return null;
  const facet = findFacet(facets, facetKey);
  const scene = chooseScene(ui, facet, subject);
  return scene?.welcome ? { scene, subject, facet } : null;
}

// --- "Şimdi değil": remembered on this device, for the day -------------------------------------

const LATER_KEY = "sherpa.welcome.later";
const laterListeners = new Set<() => void>();
/** Where the browser keeps nothing (a private window): this page remembers it. */
let sessionLater: string | null = null;

function readLater(): string | null {
  try {
    return localStorage.getItem(LATER_KEY);
  } catch {
    return null;
  }
}

/** The day "Şimdi değil" was said on this device, and how to say it. */
export function useWelcomeLater(): [string | null, (date: string) => void] {
  const later = useSyncExternalStore(
    (listener) => {
      laterListeners.add(listener);
      return () => laterListeners.delete(listener);
    },
    readLater,
    () => null,
  );
  const say = (date: string) => {
    try {
      localStorage.setItem(LATER_KEY, date);
    } catch {
      // This page only: kept below until it is reloaded.
    }
    sessionLater = date;
    laterListeners.forEach((listener) => listener());
  };
  return [later ?? sessionLater, say];
}

/** The longest "Biraz önce uyandım" goes back. */
const EARLIER_MAX = 180;

export function WelcomeFrame({
  mod,
  scene,
  subject,
  facet,
  welcome,
  date,
  brief,
  onStart,
  onStartFailed,
  onLater,
  onFailed,
}: {
  mod: KnownModule;
  scene: ModuleScene;
  subject: SceneSubject;
  facet: ModuleFacet | null;
  welcome: Welcome;
  /** The planning day: the waking is written on it. */
  date: string;
  brief: TodayBrief;
  /** "Başla" was pressed: the screen keeps the welcome until the scene comes. */
  onStart: () => void;
  /** It could not be written: the welcome is back to itself. */
  onStartFailed?: () => void;
  onLater: () => void;
  onFailed: () => void;
}) {
  const { ctx } = useModuleScope(mod);
  const device = useDevice();
  const wake = useRecordWake();
  const start = useStartChain();
  const tone = sceneTone(scene, facet);
  const color = facet ? facetColor(mod.row, facet) : moduleColor(mod);
  const backdrop = sceneBackdrop(mod, tone, color);
  useBackdrop(device === "pano" ? backdrop : null);
  const Welcome = scene.welcome!;

  const props: SceneWelcomeProps = {
    subject,
    device,
    woke: welcome.woke,
    controls: {
      start: async (minutesAgo = 0) => {
        const back = Math.min(EARLIER_MAX, Math.max(0, Math.round(minutesAgo)));
        const at = welcome.woke ?? new Date(Date.now() - back * 60_000);
        onStart();
        try {
          // "Uyandım"'s own way (`core.day_started`), then the chain's start: if another screen
          // started something since the waking, nothing more starts here.
          if (!welcome.woke) await wake.mutateAsync({ date, at });
          await start.mutateAsync({
            since: at.toISOString(),
            target: sessionTargetOf(welcome.target),
          });
        } catch (error) {
          onStartFailed?.();
          throw error;
        }
      },
      later: onLater,
    },
    today: brief,
    ctx,
    facet: facet ? { key: facet.key, name: facet.name, color } : null,
  };

  return (
    <div
      data-testid="welcome"
      // A touch on the welcome is no "something else": it does not stand for the waking (the
      // first touch's estimate, PlanKeeper), "Başla" writes the real one.
      data-wake-action=""
      data-welcome=""
      data-device={device}
      data-backdrop={backdrop.kind}
      className={cn(
        "animate-in fade-in flex flex-col duration-300 motion-reduce:animate-none",
        // As the scene: the phone's whole screen (the menu and "+" under it), the board's page.
        device === "telefon"
          ? "bg-solid fixed inset-0 z-30 overflow-x-hidden overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          : "min-h-[70vh] flex-1",
      )}
    >
      {device === "telefon" ? <Backdrop kind={backdrop} contained band /> : null}
      <section aria-label="Karşılama" className="relative z-10 flex flex-1 flex-col p-5 md:p-10">
        <WelcomeBoundary onError={onFailed}>
          <Welcome {...props} />
        </WelcomeBoundary>
      </section>
    </div>
  );
}

/** A welcome that throws gives the Today screen back. */
class WelcomeBoundary extends Component<{ onError: () => void; children: ReactNode }> {
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
