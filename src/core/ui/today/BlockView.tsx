"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Component, type ReactNode, useCallback, useEffect, useState } from "react";
import type { KnownModule } from "@/core/app/hooks";
import { blockPhase } from "@/core/contract/blockView";
import { facetColor, moduleColor } from "@/core/contract/colors";
import { findFacet } from "@/core/contract/facets";
import type { BlockViewProps, ModuleBlockView, ModuleFacet } from "@/core/contract/types";
import type { Block } from "@/core/types";
import { Backdrop, useBackdrop } from "@/core/ui/sky/Backdrop";
import { formatTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import { useModuleScope } from "../module/ModuleProvider";
import { useNotify } from "../Notices";
import { SceneStripBar, useDevice } from "./Scene";

// Okul çekirdek A (docs/06-modul-sozlesmesi.md, "Sabit blok görünümü"): a fixed block the module
// proposed opens the module's view in the scene's place (a lesson, an exam day). No session runs
// and nothing is counted: the strip has the hour, the block's colour, its name and a few words of
// the module's ("derste"), no minutes; "Çık" goes back to Today. The address names the block
// (`/?blok=<id>`), so Takvim and the day's flow open it too and a reload keeps it.

/** The block named in Today's address, and the ways in and out. */
export function useBlockParam(): { blockId: string | null; close: () => void } {
  const params = useSearchParams();
  const router = useRouter();
  return {
    blockId: params.get("blok"),
    close: useCallback(() => router.replace("/"), [router]),
  };
}

type Strip = { title?: string; detail?: string | null } | null;

export function BlockViewFrame({
  mod,
  block,
  view,
  facets,
  now,
  onExit,
}: {
  mod: KnownModule;
  block: Block;
  view: ModuleBlockView;
  facets: readonly ModuleFacet[] | null;
  now: Date;
  onExit: () => void;
}) {
  const { ctx } = useModuleScope(mod);
  const device = useDevice();
  const notify = useNotify();
  const facet = findFacet(facets, block.facet);
  const color = facet ? facetColor(mod.row, facet) : moduleColor(mod);
  const [strip, setStrip] = useState<Strip>(null);
  const setStripStable = useCallback(
    (next: Strip) =>
      setStrip((before) =>
        before?.title === next?.title && (before?.detail ?? null) === (next?.detail ?? null)
          ? before
          : next,
      ),
    [],
  );
  // A second's clock for the strip (the shared clock ticks slower).
  const [second, setSecond] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setSecond(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const at = new Date(Math.max(second, now.getTime()));
  // The module's own backdrop if it has one, else the focus tone's dark (the scene's look).
  const Own = mod.definition?.ui.backdrop;
  const backdrop = Own
    ? ({ kind: "module", id: mod.row.slug, color, Backdrop: Own } as const)
    : ({ kind: "focus" } as const);
  useBackdrop(device === "pano" ? backdrop : null);
  const View = view.component;
  const props: BlockViewProps = {
    block,
    device,
    phase: blockPhase(block, at),
    now: at,
    ctx,
    facet: facet ? { key: facet.key, name: facet.name, color } : null,
    strip: setStripStable,
    exit: onExit,
  };
  const hours = `${formatTime(new Date(block.starts_at))}–${formatTime(new Date(block.ends_at))}`;
  return (
    <div
      data-testid="block-view"
      data-block={block.id}
      data-device={device}
      className={cn(
        "animate-scene-in flex flex-col motion-reduce:animate-none",
        device === "telefon"
          ? "bg-solid fixed inset-0 z-30 overflow-x-hidden overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          : "min-h-[70vh] flex-1",
      )}
    >
      {device === "telefon" ? <Backdrop kind={backdrop} contained band /> : null}
      <SceneStripBar
        device={device}
        now={at}
        color={color}
        title={strip?.title ?? block.title}
        minutes={null}
        detail={strip?.detail ?? hours}
        onExit={onExit}
      />
      <section aria-label="Blok" className="relative z-10 flex flex-1 flex-col p-5 md:p-10">
        <ViewBoundary
          onError={() => {
            notify("Görünüm açılamadı.");
            onExit();
          }}
        >
          <View {...props} />
        </ViewBoundary>
      </section>
    </div>
  );
}

/** A view that throws gives Today back with one line; nothing else changes. */
class ViewBoundary extends Component<{ onError: () => void; children: ReactNode }> {
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
