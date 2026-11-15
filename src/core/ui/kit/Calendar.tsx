"use client";

import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// Takvim's pieces (docs/tasarim/parcalar.md, "Gün kutusu", "Yük çubuğu", "Hafta çubukları";
// docs/tasarim/ekranlar/takvim.md; frames TT1–TT7, TP1–TP5). Drawn from data the screen gives;
// they know nothing of the planner.

export type DayBoxDue = { key: string; title: string; color: string };

/**
 * A day of the week to touch: its name and date, a dot per deadline (on the phone); on the board
 * its time left and its first deadline. Today has a light edge, the selected day is the opaque
 * light, a day gone by is fainter (its glass, not its text: the text keeps 4.5:1).
 */
export function DayBox({
  name,
  date,
  label,
  today,
  past,
  selected,
  board,
  time,
  due,
  onClick,
}: {
  name: string;
  date: number;
  /** Its accessible name ("Pzt 9 Kasım, teslim var"). */
  label: string;
  today: boolean;
  past: boolean;
  selected: boolean;
  board: boolean;
  /** "4 sa 10 dk vakit" on the board; none for a day gone by. */
  time?: string | null;
  due: DayBoxDue[];
  onClick: () => void;
}) {
  const second = selected ? "text-ink-dark-2" : past ? "text-ink-3" : "text-ink-2";
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-current={today ? "date" : undefined}
      aria-label={label}
      data-past={past || undefined}
      onClick={onClick}
      className={cn(
        "focus-visible:shadow-focus flex h-18 w-full flex-col items-center justify-center gap-px rounded-2xl border outline-none md:h-23 md:items-start md:justify-start md:gap-0.5 md:px-3.5 md:py-2.5 md:text-left",
        selected
          ? "bg-light text-ink-dark shadow-selected border-transparent"
          : past
            ? "bg-glass-soft text-ink-2 border-edge-quiet"
            : "bg-glass-dense text-ink border-edge-soft",
        today && !selected && "border-ink border-2",
      )}
    >
      {board ? (
        <>
          <span className="text-lead font-semibold tabular-nums">
            {name} {date}
          </span>
          {time ? <span className={cn("text-note tabular-nums", second)}>{time}</span> : null}
          {due[0] ? (
            <span className="mt-auto flex w-full min-w-0 items-center gap-1.5 text-sm">
              <span
                aria-hidden
                className="size-1.75 shrink-0 rounded-full"
                style={{ backgroundColor: due[0].color }}
              />
              <span className="truncate">{due[0].title}</span>
            </span>
          ) : null}
        </>
      ) : (
        <>
          <span className={cn("text-sm", second)}>{name}</span>
          <span className="text-lg font-semibold tabular-nums">{date}</span>
          <span className="flex h-1.75 gap-0.75">
            {due.slice(0, 3).map((deadline) => (
              <span
                key={deadline.key}
                aria-hidden
                data-testid="due-dot"
                className="size-1.75 rounded-full"
                style={{ backgroundColor: deadline.color }}
              />
            ))}
          </span>
        </>
      )}
    </button>
  );
}

/**
 * The week's load: the work in its modules' colours on a thin track, the week's time a white
 * line. Over the time, the work runs past the line.
 */
export function LoadBar({
  parts,
  demand,
  capacity,
  label,
}: {
  parts: { key: string; color: string; minutes: number; title?: string }[];
  demand: number;
  capacity: number;
  label: string;
}) {
  const scale = Math.max(capacity, demand, 1);
  return (
    <div
      role="img"
      aria-label={label}
      className="bg-fill-track relative h-1.5 overflow-hidden rounded-xs"
    >
      <div
        className="absolute inset-y-0 left-0 flex"
        style={{ width: `${(demand / scale) * 100}%` }}
      >
        {parts
          .filter((part) => part.minutes > 0)
          .map((part) => (
            <span
              key={part.key}
              title={part.title}
              className="h-full"
              style={{
                width: `${(part.minutes / Math.max(1, demand)) * 100}%`,
                backgroundColor: part.color,
              }}
            />
          ))}
      </div>
      <span
        aria-hidden
        className="bg-flow-now absolute inset-y-0 w-0.5"
        style={{ left: `calc(${(capacity / scale) * 100}% - var(--spacing) * 0.5)` }}
      />
    </div>
  );
}

export type WeekBar = {
  key: string;
  /** The week's first day's date; the month's short name when it changes. */
  date: number;
  month: string;
  demand: number;
  capacity: number;
  over: boolean;
  /** Its accessible name ("30 Kas haftası: 34 sa iş, 30 sa vakit"). */
  label: string;
};

/**
 * The coming weeks: a small bar each, its work as the bar and its time as a white line; a week
 * that asks more than its time in the attention colour, with the sign over it. A bar is a
 * button the whole column wide (at least the touch target on a phone of 390 px: the panel lends
 * the list its side padding).
 */
export function WeekBars({ weeks, onPick }: { weeks: WeekBar[]; onPick: (key: string) => void }) {
  const scale = Math.max(1, ...weeks.flatMap((week) => [week.capacity, week.demand]));
  return (
    <ol className="-mx-3 flex md:-mx-4">
      {weeks.map((week) => (
        <li key={week.key} className="min-w-0 flex-1">
          <button
            type="button"
            aria-label={week.label}
            title={week.label}
            onClick={() => onPick(week.key)}
            className="focus-visible:shadow-focus flex w-full flex-col items-center gap-1 rounded-md outline-none"
          >
            <span className={cn("flex h-4", week.over && "text-attention")}>
              {week.over ? <TriangleAlert aria-hidden className="size-3.5" /> : null}
            </span>
            <span className="bg-fill-chip relative h-16 w-[62%] overflow-hidden rounded-md">
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 rounded-md",
                  week.over ? "bg-attention" : "bg-fill-bar",
                )}
                style={{ height: `${Math.min(100, (week.demand / scale) * 100)}%` }}
              />
              <span
                aria-hidden
                className="bg-flow-now absolute inset-x-0 h-0.5"
                style={{ bottom: `${Math.min(100, (week.capacity / scale) * 100)}%` }}
              />
            </span>
            <span className="flex flex-col items-center leading-tight">
              <span className="text-note tabular-nums">{week.date}</span>
              <span className="text-ink-2 min-h-4.25 text-sm">{week.month}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
