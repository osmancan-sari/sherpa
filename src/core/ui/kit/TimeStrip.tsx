"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import { useLayoutDevice } from "@/core/ui/sky/Backdrop";
import { token } from "@/core/ui/tokens";

// The day's flow as a strip of hours (docs/tasarim/parcalar.md, "Saatli şerit"; Today's "Günün
// akışı", docs/tasarim/ekranlar/bugun.md 4.2; frames ZT1–ZT5, ZP1–ZP3). Hour labels above the bar
// (every hour on the board, every third on the phone) with a thin line under each; work in its
// colour with dark text, fixed blocks grey and the bar's full height, travel hatched, a break the
// bar's own glass. Past pieces are faint. The present is a white line with a "şimdi 14:10" pill.
// On the board a piece wide enough shows its name inside; on the phone none does: a touch on a
// piece shows a balloon over it ("15:55–16:55 · İstatistik ödevi") and frames it in white; on the
// board the same balloon comes with the pointer. A narrow piece is touched through an area wider
// than itself (at least the touch target).

export type TimeStripPiece = {
  key: string;
  kind: "work" | "block" | "travel";
  start: Date;
  end: Date;
  /** The work's or the block's name; for travel its minutes ("yol 35 dk"). */
  label: string;
  /** The work's colour (work and travel). */
  color?: string;
  testId?: string;
  /** Okul çekirdek A: a piece that opens something (a block's view) instead of its balloon. */
  onOpen?: () => void;
};

/** A part of the day drawn one shade lighter: the wake-bound and the bed-bound work. */
export type TimeStripPart = { key: string; start: Date; end: Date; label: string };

const HOUR = 60 * 60_000;

/** The balloon's words for a piece. */
export function pieceText(piece: TimeStripPiece): string {
  if (piece.kind === "travel") return piece.label;
  return `${formatTime(piece.start)}–${formatTime(piece.end)} · ${piece.label}`;
}

/** The whole hours the strip shows: from the hour at or before `from` to the one at or after `to`. */
export function stripHours(from: Date, to: Date): { start: number; end: number } {
  const start = Math.floor(from.getTime() / HOUR) * HOUR;
  const end = Math.max(start + HOUR, Math.ceil(to.getTime() / HOUR) * HOUR);
  return { start, end };
}

export function TimeStrip({
  from,
  to,
  now,
  pieces,
  parts = [],
  label = "Günün şeridi",
  className,
}: {
  /** The day's ends (the waking and the expected bedtime); the strip rounds out to whole hours. */
  from: Date;
  to: Date;
  now: Date;
  pieces: TimeStripPiece[];
  parts?: TimeStripPart[];
  label?: string;
  className?: string;
}) {
  const device = useLayoutDevice();
  const board = device === "pano";
  const { start, end } = stripHours(from, to);
  const span = end - start;
  const at = (time: number) => Math.max(0, Math.min(100, ((time - start) / span) * 100));
  const widthOf = (a: number, b: number) =>
    Math.max(0, at(Math.min(b, end)) - at(Math.max(a, start)));
  const nowAt = at(now.getTime());
  const [chosen, setChosen] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const shown = board ? (hovered ?? chosen) : chosen;
  const shownPiece = pieces.find((piece) => piece.key === shown) ?? null;

  // The bar's width in pixels: a piece narrower than the touch target writes no name inside.
  const bar = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    const element = bar.current;
    if (!element) return;
    const measure = () => setBarWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const touch = parseFloat(token("spacing-touch"));

  // A touch anywhere else puts the balloon away.
  useEffect(() => {
    if (!chosen) return;
    const away = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-strip-piece]")) {
        setChosen(null);
      }
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [chosen]);

  // Every hour on the board (every second one when the day is longer than 16 hours, so the
  // labels never touch), every third on the phone; the board writes the two ends too.
  const hourCount = Math.round((end - start) / HOUR);
  const every = board ? (hourCount > 16 ? 2 : 1) : 3;
  const hours: number[] = [];
  for (let time = start; time <= end; time += HOUR) {
    // The hour in Istanbul, whatever the device's zone (CLAUDE.md).
    const hour = Number(formatTime(new Date(time)).slice(0, 2));
    const edge = time === start || time === end;
    if (board && (edge || hour % every === 0)) {
      // An end and a label one hour from it would touch: the inner one goes.
      const nearEdge =
        !edge && every > 1 && (time - start < every * HOUR || end - time < every * HOUR);
      if (!nearEdge) hours.push(time);
    } else if (!board && !edge && hour % every === 0) hours.push(time);
  }

  return (
    <div role="group" aria-label={label} className={cn("relative flex flex-col", className)}>
      {/* Hour labels. */}
      <div aria-hidden className="text-ink-2 text-meta relative h-5.5 tabular-nums md:text-sm">
        {hours.map((time) => {
          const left = at(time);
          return (
            <span
              key={time}
              className="absolute top-0 whitespace-nowrap"
              style={{
                left: `${left}%`,
                transform:
                  left <= 0 ? "none" : left >= 100 ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {formatTime(new Date(time))}
            </span>
          );
        })}
      </div>

      <div className="relative">
        <div
          ref={bar}
          className="bg-fill-field border-edge-quiet h-flow md:h-flow-board relative overflow-hidden rounded-xl border"
        >
          {parts
            .filter((part) => part.end > part.start)
            .map((part) => (
              <span
                key={part.key}
                data-testid={`strip-part-${part.key}`}
                title={`${part.label} ${formatTime(part.start)}–${formatTime(part.end)}`}
                className="bg-fill-field absolute inset-y-0"
                style={{
                  left: `${at(part.start.getTime())}%`,
                  width: `${widthOf(part.start.getTime(), part.end.getTime())}%`,
                }}
              />
            ))}
          {hours.map((time) =>
            time > start && time < end ? (
              <span
                key={time}
                aria-hidden
                className="bg-line absolute inset-y-0 w-px"
                style={{ left: `${at(time)}%` }}
              />
            ) : null,
          )}
        </div>
        {/* The pieces sit over the bar (not clipped by it) so a narrow one keeps its touch area. */}
        <div className="absolute inset-0">
          {pieces.map((piece) => {
            const startAt = piece.start.getTime();
            const endAt = piece.end.getTime();
            if (endAt <= start || startAt >= end) return null;
            const left = at(startAt);
            const width = widthOf(startAt, endAt);
            const pixels = (width / 100) * barWidth;
            const named = board && piece.kind !== "travel" && pixels >= touch;
            const past = endAt <= now.getTime();
            const selected = shown === piece.key;
            const text = pieceText(piece);
            return (
              <button
                key={piece.key}
                type="button"
                data-strip-piece=""
                data-testid={piece.testId}
                data-past={past || undefined}
                aria-label={text}
                aria-pressed={!board ? selected : undefined}
                title={board ? undefined : text}
                onClick={() =>
                  piece.onOpen ? piece.onOpen() : setChosen(selected && !board ? null : piece.key)
                }
                data-opens={piece.onOpen ? "" : undefined}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setHovered(piece.key);
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType === "mouse") setHovered(null);
                }}
                className={cn(
                  "text-meta absolute flex items-center font-semibold whitespace-nowrap outline-none",
                  "focus-visible:shadow-focus",
                  // The touch area: at least the touch target, centred on a narrow piece.
                  "after:absolute after:left-1/2 after:w-[max(100%,var(--spacing-touch))] after:-translate-x-1/2",
                  // ...and at least the touch target high: travel is the thinnest (20 px on the
                  // phone), so its area reaches 12 px above and below.
                  piece.kind === "travel" ? "after:-inset-y-3" : "after:-inset-y-2",
                  piece.kind === "work" && "text-ink-dark inset-y-1.25 rounded-md px-1.5",
                  piece.kind === "block" && "bg-fill-step text-ink inset-y-0 px-1.5",
                  piece.kind === "travel" && "inset-y-2.5 rounded-sm",
                  past && "opacity-45",
                  selected && "outline-flow-now outline-2 -outline-offset-2",
                )}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: piece.kind === "work" ? piece.color : undefined,
                  backgroundImage:
                    piece.kind === "travel"
                      ? "repeating-linear-gradient(135deg, var(--color-flow-travel) 0 calc(var(--spacing) * 0.75), transparent calc(var(--spacing) * 0.75) calc(var(--spacing) * 1.75))"
                      : undefined,
                }}
              >
                {/* The name is cut here, not the button: the button's touch area reaches past it. */}
                {named ? <span className="min-w-0 flex-1 truncate">{piece.label}</span> : null}
              </button>
            );
          })}
        </div>
        {/* The present moment. */}
        {now.getTime() >= start && now.getTime() <= end ? (
          <span
            aria-hidden
            className="bg-flow-now pointer-events-none absolute -inset-y-1 -ml-px w-0.5 rounded-full"
            style={{ left: `${nowAt}%` }}
          />
        ) : null}
        {shownPiece ? (
          <span
            role="tooltip"
            data-testid="strip-balloon"
            className="bg-balloon border-edge-balloon shadow-balloon text-ink pointer-events-none absolute -top-8.5 z-10 rounded-xl border px-3 py-1.5 text-sm whitespace-nowrap tabular-nums"
            style={balloonPlace(at((shownPiece.start.getTime() + shownPiece.end.getTime()) / 2))}
          >
            {pieceText(shownPiece)}
          </span>
        ) : null}
      </div>

      <div className="relative h-7.5">
        {now.getTime() >= start && now.getTime() <= end ? (
          <span
            data-testid="strip-now"
            className="bg-flow-now text-ink-dark md:text-meta absolute top-2 rounded-lg px-2.25 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums"
            style={balloonPlace(nowAt)}
          >
            şimdi {formatTime(now)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Centred over a point of the bar, but kept inside it near the ends. */
function balloonPlace(left: number): React.CSSProperties {
  if (left < 12) return { left: `${left}%`, transform: `translateX(-${left * 4}%)` };
  if (left > 88) return { left: `${left}%`, transform: `translateX(-${100 - (100 - left) * 4}%)` };
  return { left: `${left}%`, transform: "translateX(-50%)" };
}
