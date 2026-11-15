"use client";

import { CircleAlert, ChevronDown, Sparkles } from "lucide-react";
import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

// Fields (docs/tasarim/parcalar.md, "Alan"; frame Parca1): 50 px high, radius 16, 16 px text (no
// zoom on the phone). In focus a white edge and a ring; in error a coral edge and one sentence
// under it, with an icon. A value the AI set has a dashed edge and its reason under it, until the
// user changes it.

export const fieldClass = cn(
  "h-field bg-fill-field border-edge-field text-ink w-full min-w-0 rounded-field border px-3.5 text-base outline-none",
  "transition-[border-color,box-shadow] duration-(--motion-fast)",
  "focus-visible:border-focus focus-visible:shadow-focus focus:border-focus focus:shadow-focus",
  "aria-invalid:border-behind disabled:opacity-50",
  "[color-scheme:dark]",
);

/** A dashed edge: the value was set by the AI. */
export const aiFieldClass = "border-dashed border-edge-ai";

export function Input({ className, ai, ...props }: ComponentProps<"input"> & { ai?: boolean }) {
  return (
    <input
      data-slot="input"
      data-ai={ai || undefined}
      className={cn(fieldClass, ai && aiFieldClass, className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(fieldClass, "h-auto min-h-21 py-3 leading-snug", className)}
      {...props}
    />
  );
}

/** A native select drawn as a field, with its chevron. */
export function Select({
  className,
  ai,
  children,
  ...props
}: ComponentProps<"select"> & { ai?: boolean }) {
  return (
    <span className={cn("relative flex w-full min-w-0", className)}>
      <select
        data-ai={ai || undefined}
        className={cn(fieldClass, ai && aiFieldClass, "appearance-none pr-10")}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="text-ink-2 pointer-events-none absolute top-1/2 right-3.5 size-4.5 -translate-y-1/2"
      />
    </span>
  );
}

/**
 * A field with its label above (14 px, secondary), and under it a hint, the AI's reason or the
 * error. Children get the id and the description through the render function, or the label wraps
 * them.
 */
export function Field({
  label,
  hint,
  error,
  aiReason,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  aiReason?: ReactNode;
  children: ReactNode | ((ids: { id: string; describedBy?: string }) => ReactNode);
  className?: string;
}) {
  const id = useId();
  const note = error ? `${id}-error` : aiReason || hint ? `${id}-note` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="text-ink-2 text-sm">
          {label}
        </label>
      ) : null}
      {typeof children === "function" ? children({ id, describedBy: note }) : children}
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : aiReason ? (
        <AiReason id={note}>{aiReason}</AiReason>
      ) : hint ? (
        <span id={note} className="text-meta text-ink-2">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** One sentence under a field in error, coral, with its icon. */
export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span id={id} role="alert" className="text-meta text-behind flex items-start gap-1.5">
      <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </span>
  );
}

/** The AI's reason under a value it set. */
export function AiReason({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span id={id} className="text-meta text-ink-2 flex items-start gap-1.5">
      <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>
        <span className="sr-only">Yapay zeka: </span>
        {children}
      </span>
    </span>
  );
}
