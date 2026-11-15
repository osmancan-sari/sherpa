"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Buttons (docs/tasarim/parcalar.md, "Düğmeler"; frame Parca1). Primary: the opaque light with
// dark text, at most one on a card or a screen. Secondary: clear glass. Quiet: text only. Danger:
// a coral edge. Disabled: faint. Heights 54 / 48 / 38; the touch target is at least 44 (the small
// one reaches past its edge). The older names (default, outline, ghost, destructive, link) are
// kept for screens Ç4c redraws; they map onto these.

export const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full border whitespace-nowrap outline-none select-none",
    "transition-[background-color,box-shadow,opacity] duration-(--motion-fast)",
    "focus-visible:shadow-focus disabled:pointer-events-none",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4.5",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-light text-ink-dark border-edge-light shadow-primary font-semibold hover:bg-ink",
        secondary:
          "bg-fill-button text-ink border-edge-button shadow-button hover:bg-fill-tab font-medium",
        quiet: "text-ink hover:bg-fill-field border-transparent bg-transparent font-semibold",
        danger: "bg-behind-fill text-ink-danger border-behind-edge font-semibold",
        link: "text-ink link-quiet h-auto! border-transparent bg-transparent px-0! font-semibold",
        // Older names.
        default:
          "bg-light text-ink-dark border-edge-light shadow-primary font-semibold hover:bg-ink",
        outline:
          "bg-fill-button text-ink border-edge-button shadow-button hover:bg-fill-tab font-medium",
        ghost: "text-ink hover:bg-fill-field border-transparent bg-transparent font-semibold",
        destructive: "bg-behind-fill text-ink-danger border-behind-edge font-semibold",
      },
      size: {
        lg: "h-control-lg px-5.5 text-base",
        md: "h-control px-5 text-base",
        sm: "h-control-sm after:-inset-y-0.75 px-3.75 text-sm after:absolute after:inset-x-0",
        icon: "size-touch p-0",
        // Older names.
        default: "h-control px-5 text-base",
        xs: "h-control-sm after:-inset-y-0.75 px-3.75 text-sm after:absolute after:inset-x-0",
        "icon-xs": "size-touch p-0",
        "icon-sm": "size-touch p-0",
        "icon-lg": "size-touch p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

/** The faint look of a button that cannot act yet ("Kaydet" of an invalid form). */
const DISABLED =
  "disabled:bg-fill-quiet disabled:text-ink-off disabled:border-edge-quiet disabled:shadow-none";

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), DISABLED, className)}
      {...props}
    />
  );
}

/**
 * A round 44 px icon button (row actions, "Kapat"): its name is its label. `pressed`: the state
 * of a toggle.
 */
export function IconButton({
  label,
  children,
  pressed,
  quiet,
  className,
  ...props
}: Omit<ComponentProps<"button">, "aria-label" | "children"> & {
  label: string;
  children: ReactNode;
  pressed?: boolean;
  /** No fill and no edge (Takvim's week chooser): the icon alone, the same touch target. */
  quiet?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        "size-touch text-ink flex shrink-0 items-center justify-center rounded-full border outline-none",
        "focus-visible:shadow-focus transition-colors duration-(--motion-fast) disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5",
        quiet
          ? "hover:bg-fill-field border-transparent bg-transparent"
          : pressed
            ? "bg-fill-active border-edge-pressed"
            : "bg-fill-field border-edge-icon hover:bg-fill-button",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
