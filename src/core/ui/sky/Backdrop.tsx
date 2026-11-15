"use client";

import {
  type ComponentType,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { ModuleBackdropProps } from "@/core/contract/types";
import { token, TOKENS } from "@/core/ui/tokens";
import { cn } from "@/lib/utils";
import { type Device, Landscape } from "./Landscape";
import {
  calmStops,
  type GlassReading,
  gradient,
  landscapeAlpha,
  parseColor,
  type Sky,
  skyAt,
} from "./sky";

// The backdrop behind every screen (docs/tasarim/ilkeler.md, decisions 2–4): one fixed layer the
// content scrolls over. Today, the scene and sign-in stand on the full landscape; every other
// screen on the calm backdrop (the same hour's sky, its upper colours). A scene can ask for its
// tone instead (focus: dark and flat; energy: the module's colour fading to dark); a module may
// give its own backdrop (decision 4), used on its page and its scenes. On the board the sky
// moves once a minute and nothing else moves; at night the board dims (38%) and may sleep.

/** The glasses a page lays over the full landscape. */
export const LANDSCAPE_GLASSES = [
  "color-glass-main",
  "color-glass-dense",
  "color-glass-soft",
] as const;

/**
 * What those glasses carry: text, secondary text, the coral of an error and of "Geride", a
 * secondary button's and a chip's text.
 */
export function landscapeReadings(): GlassReading[] {
  return [
    { text: token("color-ink") },
    { text: token("color-ink-2") },
    { text: token("color-behind") },
    { text: token("color-ink"), fill: token("color-fill-button") },
    { text: token("color-ink-soft"), fill: token("color-fill-chip") },
  ];
}

export type BackdropKind =
  | { kind: "full" }
  | { kind: "calm" }
  | { kind: "focus" }
  | { kind: "energy"; color: string }
  | {
      kind: "module";
      id: string;
      color: string;
      Backdrop: ComponentType<ModuleBackdropProps>;
    };

const BOARD_QUERY = `(width >= ${TOKENS["breakpoint-md"]})`;

function subscribeBoard(listener: () => void) {
  const query = window.matchMedia(BOARD_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/** Which layout this device draws: the second screen or the phone. */
export function useLayoutDevice(): Device {
  return useSyncExternalStore(
    subscribeBoard,
    () => (window.matchMedia(BOARD_QUERY).matches ? "pano" : "telefon"),
    () => "pano",
  );
}

/** The minute, as a timestamp; moves once a minute (the sky needs no more). */
function useMinute(): number | null {
  const [minute, setMinute] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setMinute(Math.floor(Date.now() / 60_000) * 60_000);
    tick();
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  }, []);
  return minute;
}

/** The sky at this minute, or null before the page knows its clock (the first paint). */
export function useSky(): Sky | null {
  const minute = useMinute();
  return minute === null ? null : skyAt(new Date(minute));
}

type Ask = (id: string, kind: BackdropKind | null) => void;

const BackdropContext = createContext<Ask | null>(null);

/**
 * A screen asks for its backdrop while it is shown; when it leaves, what was asked before comes
 * back (Today asks for the full landscape, its scene for its tone on top). Without a provider (a
 * screen outside the app shell) it does nothing.
 */
export function useBackdrop(kind: BackdropKind | null) {
  const ask = useContext(BackdropContext);
  const id = useId();
  const key = kind ? keyOf(kind) : "";
  useLayoutEffect(() => {
    if (!ask) return;
    ask(id, kind);
    return () => ask(id, null);
    // The kind is compared by its key: a new object of the same backdrop does not redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask, id, key]);
}

function keyOf(kind: BackdropKind): string {
  if (kind.kind === "energy") return `energy:${kind.color}`;
  if (kind.kind === "module") return `module:${kind.id}:${kind.color}`;
  return kind.kind;
}

/** The app's backdrop: the latest request still shown, else the shell's default. */
export function BackdropProvider({
  fallback,
  children,
}: {
  fallback: BackdropKind;
  children: ReactNode;
}) {
  const [asks, setAsks] = useState<{ id: string; kind: BackdropKind }[]>([]);
  const ask = useCallback<Ask>((id, kind) => {
    setAsks((list) => {
      const rest = list.filter((entry) => entry.id !== id);
      return kind ? [...rest, { id, kind }] : rest;
    });
  }, []);
  return (
    <BackdropContext.Provider value={ask}>
      <Backdrop kind={asks.at(-1)?.kind ?? fallback} />
      {children}
    </BackdropContext.Provider>
  );
}

/**
 * The fixed layer itself. `contained`: drawn inside its parent instead of behind the page (a
 * scene that covers the phone's screen carries its own).
 */
export function Backdrop({
  kind,
  contained = false,
  sky: fixed,
}: {
  kind: BackdropKind;
  contained?: boolean;
  /** A given hour's sky instead of this minute's (the gallery). */
  sky?: Sky;
}) {
  const now = useSky();
  const sky = fixed ?? now;
  const device = useLayoutDevice();
  const key = keyOf(kind);
  const full = kind.kind === "full";

  // Over the full landscape the glasses deepen where what stands behind them (the bright band at
  // the horizon, a light hill) is too bright for their text, a button's or a chip's
  // (docs/tasarim/ilkeler.md: at least 4.5:1); the value is the token's, only its opacity grows.
  // The page's own backdrop sets it; a contained one leaves it alone.
  useEffect(() => {
    if (contained) return;
    const root = document.documentElement;
    // The page stands on the full landscape: on the board its panels blur too (glass.css).
    if (full) root.dataset.landscape = "full";
    else delete root.dataset.landscape;
    const style = root.style;
    for (const layer of LANDSCAPE_GLASSES) {
      const base = parseColor(token(layer));
      const alpha = sky && full ? landscapeAlpha(sky, base, landscapeReadings()) : base.alpha;
      if (alpha > base.alpha) {
        style.setProperty(`--${layer}`, `rgba(${base.rgb.join(", ")}, ${alpha})`);
      } else {
        style.removeProperty(`--${layer}`);
      }
    }
  }, [sky, full, contained]);

  return (
    <div
      aria-hidden
      data-testid={contained ? "scene-backdrop" : "backdrop"}
      data-backdrop={kind.kind}
      data-phase={sky?.phase}
      className={cn(
        "bg-solid pointer-events-none inset-0 overflow-hidden",
        contained ? "absolute" : "fixed -z-10",
      )}
    >
      {sky ? (
        <>
          {/* The calm sky is always under: a module's backdrop or a tone fades in over it. */}
          <div className="absolute inset-0" style={{ background: gradient(calmStops(sky)) }} />
          <div key={key} className="animate-fade-in absolute inset-0">
            <Layer kind={kind} sky={sky} device={device} />
          </div>
          {/* The board's night: dimmed, and nothing keeps it awake. */}
          <div
            className={cn(
              "bg-night-dim absolute inset-0 hidden",
              sky.phase === "night" && "md:block",
            )}
          />
        </>
      ) : null}
    </div>
  );
}

function Layer({ kind, sky, device }: { kind: BackdropKind; sky: Sky; device: Device }) {
  switch (kind.kind) {
    case "full":
      return <Landscape sky={sky} device={device} />;
    case "calm":
      return null;
    case "focus":
      return <div className="bg-focus-tone absolute inset-0" />;
    case "energy":
      return (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, color-mix(in oklab, ${kind.color} 26%, var(--color-energy-base)) 0%, color-mix(in oklab, ${kind.color} 12%, var(--color-energy-base)) 55%, var(--color-energy-base) 100%)`,
          }}
        />
      );
    case "module":
      return (
        <kind.Backdrop
          device={device}
          color={kind.color}
          sky={{ phase: sky.phase, elevation: sky.elevation }}
        />
      );
  }
}
