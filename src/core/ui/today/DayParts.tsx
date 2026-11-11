"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStartSession } from "@/core/app/actions";
import { type KnownModule, setDeviceContext } from "@/core/app/hooks";
import type { Candidate, Plan, PlanInput, Warning } from "@/core/planner";
import { pickForMinutes } from "@/core/planner";
import { blocksOfDay } from "@/core/today/select";
import type { Context, LifeMode } from "@/core/types";
import { formatDayLabel, formatMinutes, formatTime } from "@/lib/date";
import { Dialog } from "../Dialog";
import { sessionTargetOf } from "./NowCard";

// The pieces of the Today screen around the "now" card (docs/05-arayuz.md, "Bileşenler").

export const MODE_LABEL: Record<LifeMode, string> = {
  normal: "Normal",
  busy: "Yoğun",
  minimum: "Minimum",
  holiday: "Tatil",
};

const CONTEXT_LABEL: Record<Context, string> = {
  any: "Her yer",
  desk: "Masa",
  home: "Ev",
  office: "Ofis",
  campus: "Kampüs",
  out: "Dışarıda",
  commute: "Yolda",
};

/** Date and time, the day's progress, the finish line, the life mode, the device's context. */
export function TopBar({ input, plan, now }: { input: PlanInput; plan: Plan; now: Date }) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Bugün</h1>
        <p className="text-muted-foreground text-sm tabular-nums md:text-base">
          {formatDayLabel(now)} · {formatTime(now)}
        </p>
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums md:text-base">
        {plan.top3.length > 0 ? (
          <span aria-label="Günün ilerlemesi">
            Bugün {plan.top3Done}/{plan.top3.length}
          </span>
        ) : null}
        <span>bitiş {formatTime(input.finishLine)}</span>
        <Link
          href="/hafta"
          className="border-border hover:bg-muted rounded-full border px-3 py-0.5"
          aria-label={`Hayat modu: ${MODE_LABEL[input.lifeMode]}`}
        >
          {MODE_LABEL[input.lifeMode]}
        </Link>
        <label className="flex items-center gap-1 md:hidden">
          <span className="sr-only">Bağlam</span>
          <select
            aria-label="Bağlam"
            value={input.context}
            onChange={(event) => setDeviceContext(event.target.value as Context)}
            className="border-border bg-background h-9 rounded-md border px-2"
          >
            {(Object.keys(CONTEXT_LABEL) as Context[])
              .filter((context) => context !== "any")
              .map((context) => (
                <option key={context} value={context}>
                  {CONTEXT_LABEL[context]}
                </option>
              ))}
          </select>
        </label>
      </div>
    </header>
  );
}

/**
 * The day as a strip: fixed blocks, the planned work in its module's colour, the free slots, and
 * a line at the present moment. Scrolls sideways on the phone.
 */
export function DayStrip({
  input,
  plan,
  now,
  modules,
}: {
  input: PlanInput;
  plan: Plan;
  now: Date;
  modules: Map<string, KnownModule>;
}) {
  const from = Math.min(input.dayStart.getTime(), now.getTime());
  const to = Math.max(input.finishLine.getTime(), from + 60 * 60_000);
  const span = to - from;
  const left = (time: number) => `${Math.max(0, Math.min(100, ((time - from) / span) * 100))}%`;
  const width = (start: number, end: number) =>
    `${Math.max(0.5, ((Math.min(end, to) - Math.max(start, from)) / span) * 100)}%`;
  const blocks = blocksOfDay(input.blocks, input.date).filter(
    (block) =>
      block.status !== "cancelled" &&
      Date.parse(block.ends_at) > from &&
      Date.parse(block.starts_at) < to,
  );
  return (
    <section aria-label="Günün şeridi" className="flex flex-col gap-2">
      <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
        <span>{formatTime(new Date(from))}</span>
        <span>{formatTime(new Date(to))}</span>
      </div>
      <div className="overflow-x-auto">
        <div className="bg-muted relative h-8 min-w-[36rem] overflow-hidden rounded-lg">
          {plan.slots.map((slot) =>
            slot.assignment ? (
              <span
                key={`s-${slot.start.getTime()}`}
                title={`${formatTime(slot.start)}–${formatTime(slot.end)} ${slot.assignment.candidate.title}`}
                className="absolute inset-y-1 rounded-sm opacity-80"
                style={{
                  left: left(slot.start.getTime()),
                  width: width(slot.start.getTime(), slot.end.getTime()),
                  backgroundColor:
                    modules.get(slot.assignment.candidate.moduleId)?.row.color ??
                    "var(--muted-foreground)",
                }}
              />
            ) : null,
          )}
          {blocks.map((block) => (
            <span
              key={block.id}
              title={`${formatTime(new Date(block.starts_at))}–${formatTime(new Date(block.ends_at))} ${block.title}`}
              className="bg-foreground/25 text-foreground absolute inset-y-0 flex items-center overflow-hidden px-1 text-xs whitespace-nowrap"
              style={{
                left: left(Date.parse(block.starts_at)),
                width: width(Date.parse(block.starts_at), Date.parse(block.ends_at)),
              }}
            >
              {block.title}
            </span>
          ))}
          <span
            aria-hidden
            className="bg-foreground absolute inset-y-0 w-0.5"
            style={{ left: left(now.getTime()) }}
          />
        </div>
      </div>
      <ul className="sr-only">
        {blocks.map((block) => (
          <li key={block.id}>
            {formatTime(new Date(block.starts_at))}–{formatTime(new Date(block.ends_at))}{" "}
            {block.title}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** At most two warnings, each with one action (docs/05-arayuz.md, `AlertBar`). */
export function AlertBar({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null;
  return (
    <section aria-label="Uyarılar" className="flex flex-col gap-2">
      {warnings.map((warning) => (
        <p
          key={`${warning.kind}-${warning.subjectId}`}
          className="border-border flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2 text-sm"
        >
          <span>
            <span className="health-attention">Uyarı</span> · {warning.text}
          </span>
          <WarningAction warning={warning} />
        </p>
      ))}
    </section>
  );
}

function WarningAction({ warning }: { warning: Warning }) {
  if (warning.kind === "deadline" || warning.kind === "floor") {
    return (
      <Link
        href="/hafta"
        className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
      >
        Haftaya bak
      </Link>
    );
  }
  return (
    <Link
      href="/m"
      className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
    >
      Modüle git
    </Link>
  );
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
          className="h-11 w-28 text-base md:h-9"
        />
        <Button type="submit" className="h-11 md:h-9" disabled={!minutes}>
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
            className="h-11 md:h-9"
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
