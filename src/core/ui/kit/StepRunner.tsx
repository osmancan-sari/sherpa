"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The step runner (docs/06-modul-sozlesmesi.md, "Sahne"; Ç3c): the steps of a routine, a
// recipe or a workout, a countdown for the timed ones, "Sonraki" and "Atla". Interface only:
// which step it is on is the module's to keep (controlled: `current` and `onStep`).

export type Step = {
  key: string;
  title: string;
  /** A timed step counts down; it moves on by itself at zero. */
  seconds?: number;
  /** Or a number of repetitions ("10 tekrar"). */
  reps?: number;
  note?: string;
};

export function StepRunner({
  steps,
  current,
  onStep,
  className,
}: {
  steps: Step[];
  /** The step the module says it is on; steps.length or more: all done. */
  current: number;
  /** A step was finished (Sonraki, or its countdown ran out) or skipped (Atla). */
  onStep: (index: number, outcome: "done" | "skipped") => void;
  className?: string;
}) {
  const step = steps[current];
  if (!step) {
    return (
      <div className={cn("flex flex-col gap-2", className)} data-testid="steps-done">
        <p className="text-2xl font-semibold">Adımlar tamam.</p>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <ol aria-label="Adımlar" className="flex flex-wrap gap-2 text-sm">
        {steps.map((row, index) => (
          <li
            key={row.key}
            aria-current={index === current ? "step" : undefined}
            className={cn(
              "border-border rounded-full border px-3 py-1",
              index < current && "text-muted-foreground line-through",
              index === current && "border-foreground font-medium",
            )}
          >
            {row.title}
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          Adım {current + 1} / {steps.length}
        </p>
        <h3 className="text-3xl leading-tight font-semibold md:text-5xl">{step.title}</h3>
        {step.seconds ? (
          // Keyed by the step: each step's countdown starts when it is first shown.
          <Countdown
            key={`${current}-${step.key}`}
            seconds={step.seconds}
            onZero={() => onStep(current, "done")}
          />
        ) : null}
        {step.reps ? <p className="text-2xl tabular-nums">{step.reps} tekrar</p> : null}
        {step.note ? <p className="text-muted-foreground md:text-lg">{step.note}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="h-12 px-6 text-base" onClick={() => onStep(current, "done")}>
          Sonraki
        </Button>
        <Button
          variant="outline"
          className="h-12 px-5 text-base"
          onClick={() => onStep(current, "skipped")}
        >
          Atla
        </Button>
      </div>
    </div>
  );
}

/** Counts a step down from when it was first shown; tells once at zero. */
function Countdown({ seconds, onZero }: { seconds: number; onZero: () => void }) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, seconds - Math.floor((now - startedAt) / 1000));
  const told = useRef(false);
  const latest = useRef(onZero);
  useEffect(() => {
    latest.current = onZero;
  });
  useEffect(() => {
    if (left === 0 && !told.current) {
      told.current = true;
      latest.current();
    }
  }, [left]);
  return (
    <p
      role="timer"
      aria-label="Kalan süre"
      className="text-5xl font-semibold tabular-nums md:text-7xl"
    >
      {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
    </p>
  );
}
