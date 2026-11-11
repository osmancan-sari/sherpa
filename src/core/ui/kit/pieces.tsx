"use client";

import { Minus, Plus } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/core/app/hooks";
import { cn } from "@/lib/utils";

// The smaller pieces of the module component kit: stepper, choice chips, timer, timeline,
// grid, and the empty and error states. Modules use these and write their own only where
// these do not reach (docs/06-modul-sozlesmesi.md, "Modül arayüzü").

/** A number changed with two large buttons; made for the thumb. */
export function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  unit,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        className="size-11"
        aria-label={`${label}: azalt`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
      >
        <Minus aria-hidden />
      </Button>
      <output aria-live="polite" className="min-w-16 text-center text-lg font-medium tabular-nums">
        {value}
        {unit ? <span className="text-muted-foreground text-sm"> {unit}</span> : null}
      </output>
      <Button
        type="button"
        variant="outline"
        className="size-11"
        aria-label={`${label}: artır`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}

/** One of a few options, as chips. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(option.value)}
            className={cn(
              "border-border focus-visible:ring-ring/50 h-11 rounded-full border px-4 text-sm outline-none focus-visible:ring-3 md:h-9 md:px-3",
              checked ? "bg-foreground text-background border-transparent" : "hover:bg-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function clock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * A timer that counts from a start time kept in the data, so it shows the same on every
 * screen. With `durationSeconds` it counts down to zero; without, it counts up.
 */
export function Timer({
  label,
  startedAt,
  durationSeconds,
}: {
  label: string;
  startedAt: string | Date | null;
  durationSeconds?: number;
}) {
  // The shared clock gives the first reading; a ticker of its own then moves it every second.
  const base = useNow().getTime();
  const [live, setLive] = useState<number | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setLive(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const start = startedAt === null ? null : new Date(startedAt).getTime();
  const elapsed = start === null ? 0 : Math.max(0, ((live ?? base) - start) / 1000);
  const shown = durationSeconds === undefined ? elapsed : Math.max(0, durationSeconds - elapsed);
  const over = durationSeconds !== undefined && start !== null && elapsed >= durationSeconds;
  return (
    <div role="timer" aria-label={label} className="flex flex-col items-center gap-1">
      <span className="font-mono text-5xl font-semibold tabular-nums md:text-7xl">
        {clock(shown)}
      </span>
      <span className="text-muted-foreground text-sm">
        {start === null ? "Başlamadı" : over ? "Süre doldu" : label}
      </span>
    </div>
  );
}

export type TimelineItem = {
  key: string;
  /** Short date text: "12 Kas", "Cuma". */
  when: string;
  title: string;
  detail?: string;
  /** Marks the entry as done or past. */
  muted?: boolean;
  color?: string;
};

/** Dated entries down a line, in the order given. */
export function Timeline({ label, items }: { label: string; items: TimelineItem[] }) {
  return (
    <ol aria-label={label} className="border-border ml-1.5 flex flex-col gap-4 border-l pl-5">
      {items.map((item) => (
        <li key={item.key} className={cn("relative", item.muted && "text-muted-foreground")}>
          <span
            aria-hidden
            className="ring-background absolute top-1.5 -left-[1.5625rem] size-2.5 rounded-full ring-2"
            style={{ backgroundColor: item.color ?? "var(--muted-foreground)" }}
          />
          <p className="text-muted-foreground text-xs tabular-nums">{item.when}</p>
          <p className="font-medium">{item.title}</p>
          {item.detail ? <p className="text-muted-foreground text-sm">{item.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export type GridCell = {
  key: string;
  /** Full description of the cell: "12 Kasım: 2 kayıt". */
  label: string;
  /** 0 (nothing) to 4 (most). An empty day stays grey; it is not a failure. */
  level: 0 | 1 | 2 | 3 | 4;
};

/** A grid of days or weeks, shaded by how much happened. One hue, light to dark. */
export function HeatGrid({
  label,
  columns,
  cells,
  columnLabels,
}: {
  label: string;
  /** Cells per row. */
  columns: number;
  cells: GridCell[];
  columnLabels?: string[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {columnLabels ? (
        <div
          aria-hidden
          className="text-muted-foreground grid gap-0.5 text-center text-[11px]"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 2rem))` }}
        >
          {columnLabels.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      ) : null}
      <ul
        aria-label={label}
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 2rem))` }}
      >
        {cells.map((cell) => (
          <li
            key={cell.key}
            title={cell.label}
            aria-label={cell.label}
            tabIndex={0}
            className="focus-visible:ring-ring/50 aspect-square rounded-[4px] outline-none focus-visible:ring-3"
            style={{
              backgroundColor: cell.level === 0 ? "var(--muted)" : `var(--seq-${cell.level})`,
            }}
          />
        ))}
      </ul>
    </div>
  );
}

/** What a module screen shows while it has nothing to show. */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="border-border text-muted-foreground flex flex-col items-center gap-4 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
      <p>{children}</p>
      {action}
    </div>
  );
}

/** What a module screen shows when its data could not be read. */
export function ErrorState({
  children = "Veri okunamadı.",
  onRetry,
}: {
  children?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-border flex flex-col items-center gap-4 rounded-xl border px-5 py-10 text-center text-sm"
    >
      <p>{children}</p>
      {onRetry ? (
        <Button variant="outline" className="h-11 md:h-9" onClick={onRetry}>
          Yeniden dene
        </Button>
      ) : null}
    </div>
  );
}
