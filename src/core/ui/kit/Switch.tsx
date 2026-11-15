"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The switch (docs/tasarim/parcalar.md, "Anahtar"): on is the opaque light with a dark knob on
// the right, off a faint track with a light knob on the left. The touch target is 44 px.

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Read by screen readers; the visible text sits next to it (SwitchRow). */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group/switch size-touch flex shrink-0 items-center justify-center rounded-full outline-none disabled:opacity-50",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "border-edge-button flex h-6 w-10.5 items-center rounded-full border p-0.5 transition-colors duration-(--motion-fast)",
          "group-focus-visible/switch:shadow-focus",
          checked ? "bg-light justify-end" : "bg-fill-off justify-start",
        )}
      >
        <span className={cn("size-4.5 rounded-full", checked ? "bg-ink-dark" : "bg-ink-2")} />
      </span>
    </button>
  );
}

/** A row with the text on the left and the switch on the right (at least 56 px). */
export function SwitchRow({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="min-h-row flex items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base">{label}</span>
        {description ? <span className="text-ink-2 text-sm">{description}</span> : null}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}
