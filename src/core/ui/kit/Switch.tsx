"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The switch (docs/tasarim/parcalar.md, "Anahtar"; frame Parca2): on is the opaque light with a
// dark knob on the right, off a faint track with a light knob on the left. The touch target is
// 44 px. Underneath it is a native checkbox (role "switch"): forms, labels and keyboard work as
// with any checkbox.

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Read by screen readers when no visible label names it (SwitchRow gives one). */
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "size-touch relative flex shrink-0 items-center justify-center",
        disabled && "opacity-50",
        className,
      )}
    >
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-full outline-none disabled:cursor-default"
      />
      <span
        aria-hidden
        className={cn(
          "border-edge-button pointer-events-none flex h-6 w-10.5 items-center rounded-full border p-0.5 transition-colors duration-(--motion-fast)",
          "peer-focus-visible:shadow-focus",
          checked ? "bg-light justify-end" : "bg-fill-off justify-start",
        )}
      >
        <span className={cn("size-4.5 rounded-full", checked ? "bg-ink-dark" : "bg-ink-2")} />
      </span>
    </span>
  );
}

/** A row with the text on the left and the switch on the right (at least 56 px). */
export function SwitchRow({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("min-h-row flex cursor-pointer items-center gap-3", className)}>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base">{label}</span>
        {description ? <span className="text-ink-2 text-sm">{description}</span> : null}
      </span>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </label>
  );
}
