import type { ComponentProps, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Panels (docs/tasarim/parcalar.md, "Paneller"; frame Parca1). Main: over the full landscape,
// radius 28. Dense: lists, tables, forms (fill 50%), radius 24. Soft: notes, summaries and small
// boxes (fill 34%), radius 22. "Saydamlığı azalt" turns them flat and opaque (glass.css).

export type PanelVariant = "main" | "dense" | "soft";

const VARIANT: Record<PanelVariant, string> = {
  main: "glass-main rounded-panel",
  dense: "glass-dense rounded-dense",
  soft: "glass-soft rounded-soft",
};

export function Panel<T extends ElementType = "section">({
  as,
  variant = "dense",
  label,
  action,
  className,
  children,
  ...props
}: {
  as?: T;
  variant?: PanelVariant;
  /** The panel's uppercase label ("YAKLAŞANLAR"); also its accessible name on a section. */
  label?: string;
  /** Something at the right of the label ("Alan sayfası"). */
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentProps<T>, "as" | "children" | "className">) {
  const Tag: ElementType = as ?? "section";
  return (
    <Tag
      aria-label={Tag === "section" && label ? capitalised(label) : undefined}
      className={cn("text-ink flex flex-col", VARIANT[variant], className)}
      {...props}
    >
      {label ? (
        <div className="flex min-h-11 items-center gap-3 px-4 pt-3 pb-1.5 md:px-4.5">
          <PanelLabel className="flex-1">{label}</PanelLabel>
          {action}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}

/** "ŞİMDİ", "YAKLAŞANLAR": 12 px, uppercase, tracked, secondary. */
export function PanelLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("panel-label", className)}>{children}</span>;
}

function capitalised(label: string): string {
  const lower = label.toLocaleLowerCase("tr-TR");
  return lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1);
}
