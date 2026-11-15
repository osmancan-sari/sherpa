import { ChartLine } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Tabs and the history button (docs/tasarim/parcalar.md; docs/moduller/ORTAK.md, section 4; frame
// Parca2). Tabs are a module's facets in a pill of soft glass, the selected one lighter; when they
// do not fit they scroll sideways. The history view is not a tab: a button of its own on the same
// line (a chart icon and its name), the opaque light while open, and then no tab looks selected.

export function TabBar({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "glass-soft rounded-tabs flex max-w-full min-w-0 [scrollbar-width:none] gap-1 overflow-x-auto p-1",
        className,
      )}
    >
      {children}
    </nav>
  );
}

export function TabLink({
  selected,
  children,
  className,
  ...props
}: ComponentProps<typeof Link> & { selected?: boolean }) {
  return (
    <Link
      aria-current={selected ? "page" : undefined}
      className={cn(
        "text-note relative flex h-9 shrink-0 items-center rounded-full px-5.5 whitespace-nowrap outline-none",
        "focus-visible:shadow-focus after:absolute after:inset-x-0 after:-inset-y-1",
        selected ? "bg-fill-tab text-ink font-semibold" : "text-ink-soft hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

/** The module's history view (Rutin: "Düzenlilik"; the core's: "Geçmiş"). */
export function HistoryLink({
  open,
  children,
  className,
  ...props
}: ComponentProps<typeof Link> & { open?: boolean }) {
  return (
    <Link
      aria-current={open ? "page" : undefined}
      className={cn(
        "h-touch rounded-tabs text-note flex shrink-0 items-center gap-2 px-4 font-semibold whitespace-nowrap outline-none",
        "focus-visible:shadow-focus",
        open ? "bg-light text-ink-dark border-edge-light border" : "glass-soft text-ink",
        className,
      )}
      {...props}
    >
      <ChartLine aria-hidden className="size-4.5" />
      {children}
    </Link>
  );
}
