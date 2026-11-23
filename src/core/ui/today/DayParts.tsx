"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { blockViewHref, blockViewOf } from "@/core/contract/blockView";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStartSession } from "@/core/app/actions";
import type { KnownModule } from "@/core/app/hooks";
import type { Candidate, Plan, PlanInput, Warning } from "@/core/planner";
import { useColors } from "@/core/app/facets";
import { pickForMinutes } from "@/core/planner";
import { dayFlowOf } from "@/core/today/flow";
import type { Session } from "@/core/types";
import { formatDayLabel, formatMinutes, formatTime } from "@/lib/date";
import { Dialog } from "../Dialog";
import { AlertRow } from "../kit/Feedback";
import { PanelLabel } from "../kit/Panel";
import { TimeStrip, type TimeStripPiece } from "../kit/TimeStrip";
import { ConnectionPill } from "../look/Connection";
import { sessionTargetOf } from "./NowCard";

// The pieces of the Today screen around the "now" card (docs/tasarim/ekranlar/bugun.md; Ç4c).

/**
 * The top line (decision 6): "Bugün" and the date; on the board the time too. No progress, no
 * finish, no waking and bedtime line (they are written only in the day's flow).
 */
export function TopBar({ now }: { now: Date }) {
  return (
    <header className="flex items-baseline gap-2.5 px-1 md:gap-3.5 md:px-0">
      <h1 className="text-title tracking-title font-bold md:text-3xl">Bugün</h1>
      <p className="text-ink-2 text-note md:text-lead flex-1 tabular-nums">
        {formatDayLabel(now)}
        <span className="max-md:hidden"> · {formatTime(now)}</span>
      </p>
      <ConnectionPill />
    </header>
  );
}

/**
 * "Günün akışı" (4.2): the day from the waking to the expected bedtime as a strip of hours; the
 * waking and the bedtime are written only here.
 */
export function DayFlowPanel({
  input,
  plan,
  sessions,
  now,
  modules,
}: {
  input: PlanInput;
  plan: Plan;
  sessions: Session[];
  now: Date;
  /** Okul çekirdek A: a block the module proposed opens its view from its piece. */
  modules?: Map<string, KnownModule>;
}) {
  const colors = useColors();
  const router = useRouter();
  const flow = dayFlowOf(input, plan, sessions);
  const opens = (key: string) => {
    if (!modules || !key.startsWith("block-")) return undefined;
    const block = input.blocks.find((row) => `block-${row.id}` === key);
    return block && blockViewOf(block, modules)
      ? () => router.push(blockViewHref(block.id))
      : undefined;
  };
  const pieces: TimeStripPiece[] = flow.pieces.map((piece) => ({
    onOpen: opens(piece.key),
    key: piece.key,
    kind: piece.kind,
    start: piece.start,
    end: piece.end,
    label: piece.label,
    color: piece.moduleId ? colors.of(piece.moduleId, piece.work) : undefined,
    testId:
      piece.kind === "work"
        ? "strip-work"
        : piece.kind === "travel"
          ? "strip-travel"
          : "strip-block",
  }));
  return (
    <section
      aria-label="Günün akışı"
      className="glass-dense rounded-dense flex flex-col gap-2.5 px-4 pt-3 md:gap-3 md:pt-3.5"
    >
      <div className="flex flex-wrap items-baseline gap-x-3">
        <PanelLabel className="flex-1">Günün akışı</PanelLabel>
        <span data-testid="flow-ends" className="text-ink-2 text-sm tabular-nums">
          {flow.wake ? `${formatTime(flow.wake)} uyanış · ` : ""}
          {formatTime(flow.bed)} yatış
        </span>
      </div>
      <TimeStrip from={flow.from} to={flow.to} now={now} pieces={pieces} parts={flow.parts} />
    </section>
  );
}

/** At most two warnings, each with one action (docs/05-arayuz.md, `AlertBar`): uyarı satırları. */
export function AlertBar({
  warnings,
  modules,
}: {
  warnings: Warning[];
  modules: Map<string, KnownModule>;
}) {
  if (warnings.length === 0) return null;
  return (
    <section aria-label="Uyarılar" className="grid gap-3.5 md:grid-cols-2 md:gap-3.5">
      {warnings.map((warning) => (
        <AlertRow
          key={`${warning.kind}-${warning.subjectId}`}
          action={warningAction(warning, modules)}
        >
          <span className="font-semibold">Uyarı</span> · {warning.text}
        </AlertRow>
      ))}
    </section>
  );
}

/** One action per warning: Takvim for time, the work's module for the work itself. */
function warningAction(warning: Warning, modules: Map<string, KnownModule>) {
  if (warning.kind === "deadline" || warning.kind === "floor") {
    return { label: "Takvime bak", href: "/takvim" as const };
  }
  const slug = warning.moduleId ? modules.get(warning.moduleId)?.row.slug : undefined;
  return { label: "Modüle git", href: (slug ? `/m/${slug}` : "/m") as Route };
}

/** "X dk'm var": the best work that fits the minutes the user has right now. */
export function MinutesDialog({
  open,
  onOpenChange,
  input,
  modules,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: PlanInput;
  modules: Map<string, KnownModule>;
}) {
  const start = useStartSession();
  const [minutes, setMinutes] = useState("");
  const [picked, setPicked] = useState<Candidate | null | undefined>(undefined);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(minutes);
    if (Number.isFinite(value) && value > 0) setPicked(pickForMinutes(input, value));
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setMinutes("");
          setPicked(undefined);
        }
      }}
      title="Kaç dakikan var?"
    >
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <Input
          autoFocus
          inputMode="numeric"
          aria-label="Dakika"
          value={minutes}
          onChange={(event) => {
            setMinutes(event.target.value.replace(/\D/g, ""));
            setPicked(undefined);
          }}
          className="h-11 w-28 text-base"
        />
        <Button type="submit" className="h-11" disabled={!minutes}>
          Bul
        </Button>
      </form>
      {picked === null ? (
        <p className="text-muted-foreground text-sm">Bu süreye uyan iş yok.</p>
      ) : null}
      {picked ? (
        <div className="border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div className="min-w-0">
            <p className="font-medium">{picked.title}</p>
            <p className="text-muted-foreground text-sm tabular-nums">
              {[modules.get(picked.moduleId)?.row.name, formatMinutes(picked.minutes)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Button
            className="h-11"
            onClick={() => {
              start.mutate(sessionTargetOf(picked));
              onOpenChange(false);
              setMinutes("");
              setPicked(undefined);
            }}
          >
            Başla
          </Button>
        </div>
      ) : null}
    </Dialog>
  );
}

export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
