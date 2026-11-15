"use client";

import { Check, Clock, Sparkles, TriangleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Segmented choice, chips, tags and states (docs/tasarim/parcalar.md; frame Parca2). The selected
// part and the selected chip are the opaque light. A dashed tag is a value the AI set. The three
// states carry an icon and a word, never colour alone; there is no red and no "overdue".

/** A choice of a few parts ("Her gün | N günde bir"). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "bg-fill-chip inline-flex max-w-full [scrollbar-width:none] gap-0.5 overflow-x-auto rounded-2xl p-0.75",
        className,
      )}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-segment min-h-9 flex-1 px-3.5 text-center text-sm whitespace-nowrap outline-none",
              "focus-visible:shadow-focus relative after:absolute after:inset-x-0 after:-inset-y-1",
              on ? "bg-light text-ink-dark font-semibold" : "text-ink-soft hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** A chip: a module ("● Okul"), a kind ("İş"), a choice among few. */
export function Chip({
  selected,
  dot,
  children,
  className,
  ...props
}: ComponentProps<"button"> & { selected?: boolean; dot?: string | null }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "h-control-sm text-note relative inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 whitespace-nowrap outline-none",
        "focus-visible:shadow-focus after:absolute after:inset-x-0 after:-inset-y-0.75 disabled:opacity-50",
        selected
          ? "bg-light text-ink-dark border-edge-light font-semibold"
          : "bg-fill-chip text-ink border-edge hover:bg-fill-button",
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden
          className="size-2.25 shrink-0 rounded-full"
          style={{ backgroundColor: dot }}
        />
      ) : null}
      {children}
    </button>
  );
}

/** A small label ("temel", "bekliyor", "duraklatıldı"). */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "h-chip bg-fill-chip border-edge text-meta text-ink inline-flex items-center gap-2 rounded-full border px-3 whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A dashed tag: a value the AI set ("✦ 45 dk"). */
export function AiTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      data-ai=""
      className={cn(
        "h-chip border-edge-ai text-meta text-ink inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 whitespace-nowrap",
        className,
      )}
    >
      <Sparkles aria-hidden className="size-3.5" />
      {children}
    </span>
  );
}

export type Health = "ok" | "attention" | "behind";

const HEALTH: Record<Health, { label: string; className: string; Icon: typeof Check }> = {
  ok: { label: "Yolunda", className: "text-ok border-ok", Icon: Check },
  attention: { label: "Dikkat", className: "text-attention border-attention", Icon: TriangleAlert },
  behind: { label: "Geride", className: "text-behind border-behind", Icon: Clock },
};

/** A state: icon and word, in its colour. */
export function Status({ health, children }: { health: Health; children?: ReactNode }) {
  const { label, className, Icon } = HEALTH[health];
  return (
    <span
      data-health={health}
      className={cn(
        "h-chip bg-glass-dense text-meta inline-flex items-center gap-1.5 rounded-full border px-3 font-semibold whitespace-nowrap",
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {children ?? label}
    </span>
  );
}
