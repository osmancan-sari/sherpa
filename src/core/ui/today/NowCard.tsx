"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEndSession, useStartSession } from "@/core/app/actions";
import type { KnownModule } from "@/core/app/hooks";
import type { NowCardContent } from "@/core/contract/types";
import { type Candidate, elapsedMinutes, type NowState } from "@/core/today/select";
import { formatMinutes, formatTime } from "@/lib/date";
import { QuickAddButton } from "../QuickAdd";

// The "now" card: the largest thing on the Today screen. Its first form has four states
// (running, fixed block, suggestion, nothing); the planner's states arrive in Ç3.

export function sessionTargetOf(candidate: Candidate) {
  if (candidate.type === "task") return { taskId: candidate.id };
  if (candidate.type === "item") return { workItemId: candidate.id };
  return { rhythmId: candidate.id };
}

export function NowCard({
  state,
  now,
  modules,
}: {
  state: NowState;
  now: Date;
  modules: Map<string, KnownModule>;
}) {
  const start = useStartSession();
  const end = useEndSession();
  const [unplanned, setUnplanned] = useState(false);

  const frame = (children: React.ReactNode) => (
    <section
      aria-label="Şimdi"
      className="border-border bg-card flex min-h-56 flex-col justify-between gap-6 rounded-2xl border p-6 md:min-h-72 md:p-8"
    >
      <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">Şimdi</p>
      {children}
    </section>
  );

  if (state.kind === "running") {
    const { session, task, rhythm } = state;
    const mod = session.module_id ? modules.get(session.module_id) : undefined;
    const title = task?.title ?? rhythm?.title ?? session.title ?? "Oturum";
    const estimate = task?.est_minutes ?? rhythm?.est_minutes ?? null;
    const elapsed = elapsedMinutes(session.started_at, now);
    const extra: NowCardContent | null = task ? (mod?.definition?.nowCard?.(task) ?? null) : null;
    // A session that has not reached the server yet has no id to end.
    const pending = session.id === "pending";

    return frame(
      <>
        <div className="flex flex-col gap-2">
          {mod ? <ModuleLine mod={mod} /> : null}
          <h2 className="text-3xl leading-tight font-semibold tracking-tight md:text-5xl">
            {title}
          </h2>
          {extra?.detail ? (
            <p className="text-muted-foreground md:text-lg">{extra.detail}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground tabular-nums">
            {formatMinutes(elapsed)} geçti
            {estimate ? ` · tahmin ${formatMinutes(estimate)}` : ""}
          </p>
          {estimate ? (
            <div
              role="progressbar"
              aria-label="Geçen süre"
              aria-valuemin={0}
              aria-valuemax={estimate}
              aria-valuenow={Math.min(elapsed, estimate)}
              className="bg-muted h-2 overflow-hidden rounded-full"
            >
              <div
                className="bg-foreground h-full rounded-full transition-[width]"
                style={{ width: `${Math.min(100, (elapsed / estimate) * 100)}%` }}
              />
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="h-12 px-6 text-base"
            disabled={pending}
            onClick={() => end.mutate({ session, outcome: "done" })}
          >
            Bitti
          </Button>
          <Button
            variant="outline"
            className="h-12 px-5 text-base"
            disabled={pending}
            onClick={() => end.mutate({ session, outcome: "stopped" })}
          >
            Durdur
          </Button>
          {(extra?.links ?? []).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="border-border hover:bg-muted flex h-12 items-center rounded-lg border px-5 text-base"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </>,
    );
  }

  if (state.kind === "block") {
    return frame(
      <>
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">Sabit blok</p>
          <h2 className="text-3xl leading-tight font-semibold tracking-tight md:text-5xl">
            {state.block.title}
          </h2>
          <p className="text-muted-foreground tabular-nums md:text-lg">
            {formatTime(new Date(state.block.ends_at))} bitiyor
            {state.block.location ? ` · ${state.block.location}` : ""}
          </p>
        </div>
        <div>
          <QuickAddButton />
        </div>
      </>,
    );
  }

  const unplannedForm = (
    <UnplannedForm
      onCancel={() => setUnplanned(false)}
      onStart={(title) => {
        start.mutate({ title });
        setUnplanned(false);
      }}
    />
  );

  if (state.kind === "suggest") {
    const { candidate } = state;
    const mod = modules.get(candidate.moduleId);
    return frame(
      <>
        <div className="flex flex-col gap-2">
          {mod ? <ModuleLine mod={mod} /> : null}
          <h2 className="text-3xl leading-tight font-semibold tracking-tight md:text-5xl">
            {candidate.title}
          </h2>
          <p className="text-muted-foreground tabular-nums md:text-lg">
            {formatMinutes(candidate.minutes)}
          </p>
        </div>
        {unplanned ? (
          unplannedForm
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              className="h-12 px-6 text-base"
              onClick={() => start.mutate(sessionTargetOf(candidate))}
            >
              Başla
            </Button>
            <Button
              variant="outline"
              className="h-12 px-5 text-base"
              onClick={() => setUnplanned(true)}
            >
              Başka bir şey yapıyorum
            </Button>
          </div>
        )}
      </>,
    );
  }

  return frame(
    <>
      <p className="text-muted-foreground text-lg md:text-2xl">Bugün için planlanan bir şey yok.</p>
      {unplanned ? (
        unplannedForm
      ) : (
        <div className="flex flex-wrap gap-2">
          <QuickAddButton />
          <Button variant="outline" className="h-11 md:h-9" onClick={() => setUnplanned(true)}>
            Başka bir şey yapıyorum
          </Button>
        </div>
      )}
    </>,
  );
}

function ModuleLine({ mod }: { mod: KnownModule }) {
  return (
    <p className="text-muted-foreground flex items-center gap-2 text-sm md:text-base">
      <span
        aria-hidden
        className="size-2.5 rounded-full"
        style={{ backgroundColor: mod.row.color }}
      />
      {mod.row.name}
    </p>
  );
}

/** "Başka bir şey yapıyorum": one line, and a session without a plan starts. */
function UnplannedForm({
  onStart,
  onCancel,
}: {
  onStart: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim()) onStart(title.trim());
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2">
      <Input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        aria-label="Ne yapıyorsun?"
        placeholder="Ne yapıyorsun?"
        className="h-12 min-w-0 flex-1 basis-56 text-base"
      />
      <Button type="submit" className="h-12 px-6 text-base" disabled={!title.trim()}>
        Başla
      </Button>
      <Button type="button" variant="ghost" className="h-12 px-4 text-base" onClick={onCancel}>
        Vazgeç
      </Button>
    </form>
  );
}
