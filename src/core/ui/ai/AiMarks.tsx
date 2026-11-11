"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { aiField, currentMark, readMark } from "@/core/ai/marks";
import type { Task, WorkItem } from "@/core/types";
import { cn } from "@/lib/utils";

// The AI's values carry a small mark (docs/05-arayuz.md): a tap or a hover shows why, and the
// pencil next to it changes them. A value the user changed loses the mark for good.

const LABELS: Record<string, string> = {
  module_id: "Modül",
  est_minutes: "Süre",
  effort_total_minutes: "Toplam efor",
  session_minutes: "Oturum",
  importance: "Önem",
  energy: "Enerji",
  context: "Yer",
  due_at: "Son tarih",
};

export type AiNote = { column: string; label: string; reason: string; confidence: number };

/** The values of a task or work item that are still the AI's, with their reasons. */
export function aiNotesOf(row: Pick<Task, "ai"> | Pick<WorkItem, "ai" | "provenance">): AiNote[] {
  const provenance = "provenance" in row ? row.provenance : null;
  const mark = currentMark(readMark(row.ai), provenance);
  if (!mark) return [];
  return Object.keys(LABELS).flatMap((column) => {
    const field = aiField(mark, column);
    if (!field) return [];
    return [
      {
        column,
        label: LABELS[column],
        reason: field.reason || "gerekçe yok",
        confidence: field.confidence,
      },
    ];
  });
}

/** For an edit form: field name → the AI's reason, for the fields that are still the AI's. */
export function aiHints(
  row: Pick<Task, "ai"> | Pick<WorkItem, "ai" | "provenance">,
  fieldOfColumn: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    aiNotesOf(row)
      .filter((note) => fieldOfColumn[note.column])
      .map((note) => [fieldOfColumn[note.column], note.reason]),
  );
}

/** The mark next to a row of work; a tap opens the reasons. Nothing when no value is the AI's. */
export function AiBadge({
  row,
  className,
  align = "left",
}: {
  row: Pick<Task, "ai"> | Pick<WorkItem, "ai" | "provenance">;
  className?: string;
  /** Which edge of the mark the panel lines up with; "right" at the end of a row. */
  align?: "left" | "right";
}) {
  const notes = aiNotesOf(row);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number; width: number } | null>(null);
  const panelId = useId();
  const ref = useRef<HTMLSpanElement>(null);

  // The panel is placed against the window, not the row: on a phone the mark sits near the
  // left edge and a panel hung from it would run off the screen. It follows the mark when the
  // page scrolls or the window changes size.
  const measure = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const gutter = 16;
    const width = Math.min(288, window.innerWidth - 2 * gutter);
    const wanted = align === "right" ? rect.right - width : rect.left;
    const left = Math.max(gutter, Math.min(wanted, window.innerWidth - gutter - width));
    setPlace({ top: rect.bottom + 4, left, width });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !ref.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  if (notes.length === 0) return null;
  const summary = notes.map((note) => `${note.label}: ${note.reason}`).join("\n");

  return (
    <span ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Yapay zekanın koyduğu değerler"
        title={summary}
        onClick={() => {
          if (!open) measure();
          setOpen(!open);
        }}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex size-6 items-center justify-center rounded-md outline-none focus-visible:ring-3"
      >
        <Sparkles aria-hidden className="size-3.5" />
      </button>
      {open && place ? (
        <span
          id={panelId}
          role="note"
          style={{ top: place.top, left: place.left, width: place.width }}
          className="bg-popover text-popover-foreground border-border fixed z-30 flex flex-col gap-1 rounded-lg border p-3 text-left text-sm font-normal shadow-lg"
        >
          <span className="text-muted-foreground text-xs">Yapay zeka koydu; kalemle değişir.</span>
          {notes.map((note) => (
            <span key={note.column}>
              <span className="font-medium">{note.label}:</span> {note.reason}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/** The mark inside a form, under a field the AI filled. */
export function AiHint({ reason }: { reason: string }) {
  return (
    <span className="text-muted-foreground flex max-w-60 items-start gap-1 text-xs">
      <Sparkles aria-hidden className="mt-0.5 size-3 shrink-0" />
      <span>
        <span className="sr-only">Yapay zeka: </span>
        {reason}
      </span>
    </span>
  );
}
