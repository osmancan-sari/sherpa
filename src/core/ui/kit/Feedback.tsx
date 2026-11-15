"use client";

import { CircleAlert, Info, TriangleAlert, WifiOff } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Progress, alert rows, the toast and the "no connection" pill (docs/tasarim/parcalar.md; frame
// Parca2).

/** The time bar, in the work's colour (8 px). */
export function ProgressBar({
  value,
  color,
  label,
  className,
}: {
  /** 0–1. */
  value: number;
  color: string;
  label?: string;
  className?: string;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("bg-fill-track h-2 overflow-hidden rounded-sm", className)}
    >
      <div className="h-full rounded-sm" style={{ width: `${percent}%`, backgroundColor: color }} />
    </div>
  );
}

/** The step lines, in the facet's colour (4 px); the ones not reached are faint. */
export function StepLines({
  total,
  done,
  color,
  className,
}: {
  total: number;
  done: number;
  color: string;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("flex gap-1.5", className)}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn("h-1 flex-1 rounded-xs", index < done ? "" : "bg-fill-step")}
          style={index < done ? { backgroundColor: color } : undefined}
        />
      ))}
    </div>
  );
}

/**
 * An alert row: soft glass, an icon, one sentence, one action; at most two lines. "attention"
 * draws its icon in the attention colour; "info" stays plain (the AI budget line uses no warning
 * colour).
 */
export function AlertRow({
  tone = "attention",
  children,
  action,
  className,
}: {
  tone?: "attention" | "info";
  children: ReactNode;
  action?: { label: string; href?: ComponentProps<typeof Link>["href"]; onClick?: () => void };
  className?: string;
}) {
  const Icon = tone === "attention" ? TriangleAlert : Info;
  return (
    <div
      className={cn(
        "glass-soft rounded-alert min-h-row flex items-center gap-3 py-2 pr-2 pl-4",
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn("size-4.5 shrink-0", tone === "attention" ? "text-attention" : "text-ink-2")}
      />
      <span className="text-note line-clamp-2 flex-1 leading-snug">{children}</span>
      {action ? (
        action.href ? (
          <Link
            href={action.href}
            className="text-note min-h-touch flex items-center px-2.5 font-semibold whitespace-nowrap underline underline-offset-(--underline-offset)"
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="text-note min-h-touch flex items-center px-2.5 font-semibold whitespace-nowrap underline underline-offset-(--underline-offset)"
          >
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );
}

/** The toast: a pill at the bottom centre; "Geri al" when the work can be taken back. */
export function Toast({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass-toast rounded-rail text-note text-ink flex min-h-13 items-center gap-2.5 py-1 pr-2 pl-4.5",
        "animate-in fade-in slide-in-from-bottom-2 duration-(--motion-base)",
        className,
      )}
    >
      <span className={action ? "" : "pr-2.5"}>{children}</span>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="min-h-touch pointer-events-auto ml-auto px-2.5 font-semibold underline underline-offset-(--underline-offset)"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

/** "bağlantı yok": a small pill at the right of a screen's top line; the last plan stays. */
export function OfflinePill({ className }: { className?: string }) {
  return (
    <span
      role="status"
      className={cn(
        "glass-soft h-chip text-meta text-ink-2 inline-flex items-center gap-1.5 rounded-full px-3",
        className,
      )}
    >
      <WifiOff aria-hidden className="size-3.5" />
      bağlantı yok
    </span>
  );
}

/** "Veri okunamadı…": the screen's main panel in its place, one sentence and "Yeniden dene". */
export function ReadError({
  onRetry,
  children = "Veri okunamadı. Bağlantı gelince kendiliğinden yenilenir.",
  className,
}: {
  onRetry?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("glass-dense rounded-dense flex flex-col items-start gap-4 p-5", className)}
    >
      <p className="flex items-start gap-2.5 text-base">
        <CircleAlert aria-hidden className="text-ink-2 mt-0.5 size-4.5 shrink-0" />
        {children}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="h-control bg-fill-button border-edge-button shadow-button text-ink rounded-full border px-5 text-base font-medium"
        >
          Yeniden dene
        </button>
      ) : null}
    </div>
  );
}
