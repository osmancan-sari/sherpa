"use client";

import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The counter (docs/tasarim/parcalar.md, "Sayaç"; Rutin's step sheet, rutin-degerler.md): a value
// between "−" and "+" circles. Small (the drawn one, in a form or a settings row): 32 px circles,
// each with a 44 px touch area reaching past its edge. Large (a full-screen view, made for the
// thumb): 44 px circles. At its least or greatest value the circle is faded and does nothing.

/** The next value: a fixed step, or one that depends on the value (15 s under a minute, …). */
export type StepperStep = number | ((value: number, direction: -1 | 1) => number);

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  format,
  unit,
  size = "sm",
  className,
}: {
  /** The name of the value: the group's name and the buttons' ("Süre: azalt", "Süre: artır"). */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: StepperStep;
  /** How the value reads ("süresiz", "1 dk 30 sn"); the number itself otherwise. */
  format?: (value: number) => ReactNode;
  /** A word after the number ("dk", "saat"), smaller and secondary. */
  unit?: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const next = (direction: -1 | 1) => {
    const moved = typeof step === "function" ? step(value, direction) : value + direction * step;
    return Math.min(max, Math.max(min, moved));
  };
  const round = cn(
    "bg-fill-button text-ink focus-visible:shadow-focus relative flex shrink-0 items-center justify-center rounded-full outline-none",
    "transition-opacity duration-(--motion-fast) disabled:opacity-40",
    size === "sm" ? "size-8 after:absolute after:-inset-1.5" : "size-touch",
  );
  const icon = size === "sm" ? "size-4" : "size-5";
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex items-center", size === "sm" ? "gap-3" : "gap-4", className)}
    >
      <button
        type="button"
        aria-label={`${label}: azalt`}
        disabled={value <= min}
        onClick={() => onChange(next(-1))}
        className={round}
      >
        <Minus aria-hidden className={icon} />
      </button>
      <output
        aria-live="polite"
        className={cn(
          "text-center font-semibold tabular-nums",
          size === "sm" ? "min-w-14 text-base" : "min-w-20 text-lg",
        )}
      >
        {format ? format(value) : value}
        {unit ? <span className="text-ink-2 text-sm font-normal"> {unit}</span> : null}
      </output>
      <button
        type="button"
        aria-label={`${label}: artır`}
        disabled={value >= max}
        onClick={() => onChange(next(1))}
        className={round}
      >
        <Plus aria-hidden className={icon} />
      </button>
    </div>
  );
}
