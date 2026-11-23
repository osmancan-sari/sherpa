import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// The list row (docs/tasarim/parcalar.md, "Liste satırı"; frame Parca1): at least 56 px (52 on
// the board), a 16 px semibold title and a 14 px line under it, dividers of 14% between rows. A
// selected row has a faint light fill; a waiting one is faded (55%). Row actions are 44 px round
// icon buttons (IconButton) at the right.

export function ListRow({
  dot,
  title,
  subtitle,
  trailing,
  selected,
  pending,
  href,
  onClick,
  className,
  titleProps,
  dotTestId = "color-dot",
  block,
  lead,
  ...props
}: {
  /**
   * Okul 1: something in the dot's place, the row's own column before its text (a date's day
   * and month, "24" over "Kas Sal"; frame okul/AnaSayfa). Takes the place of the dot and the block.
   */
  lead?: ReactNode;
  /** A fixed block: a small grey square instead of the colour dot ("18:30–19:15 · sabit"). */
  block?: boolean;
  /** The work's or the module's colour: a 9 px dot before the text. */
  dot?: string | null;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Actions, a switch, a chevron, a small label. */
  trailing?: ReactNode;
  selected?: boolean;
  /** Waiting work: faded. */
  pending?: boolean;
  /** The whole row is a link (the trailing part stays outside it). */
  href?: ComponentProps<typeof Link>["href"];
  onClick?: () => void;
  className?: string;
  titleProps?: ComponentProps<"span">;
  dotTestId?: string;
} & Omit<ComponentProps<"div">, "title" | "onClick">) {
  const body = (
    <>
      {lead ? (
        <span className="flex w-11 shrink-0 flex-col items-center text-center">{lead}</span>
      ) : block ? (
        <span aria-hidden className="bg-ink-off size-2.25 shrink-0 rounded-xs" />
      ) : dot ? (
        <span
          aria-hidden
          data-testid={dotTestId}
          className="size-2.25 shrink-0 rounded-full"
          style={{ backgroundColor: dot }}
        />
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-2 text-left">
        <span {...titleProps} className={cn("text-base font-semibold", titleProps?.className)}>
          {title}
        </span>
        {subtitle ? <span className="text-ink-2 text-sm">{subtitle}</span> : null}
      </span>
    </>
  );
  const main = href ? (
    <Link
      href={href}
      className="rounded-step focus-visible:shadow-focus flex min-w-0 flex-1 items-center gap-3 self-stretch outline-none"
    >
      {body}
    </Link>
  ) : onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="rounded-step focus-visible:shadow-focus flex min-w-0 flex-1 items-center gap-3 self-stretch outline-none"
    >
      {body}
    </button>
  ) : (
    <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
  );
  return (
    <div
      aria-selected={selected || undefined}
      data-pending={pending || undefined}
      className={cn(
        "min-h-row md:min-h-row-board border-line flex items-center gap-3 border-b pr-2.5 pl-4 last:border-b-0",
        selected && "bg-fill-selected",
        pending && "opacity-55",
        className,
      )}
      {...props}
    >
      {main}
      {trailing ? <div className="flex shrink-0 items-center gap-1.5">{trailing}</div> : null}
    </div>
  );
}

/**
 * The last row of a list that opens downward ("Hepsini göster") and closes again ("Küçült"):
 * the whole width, a divider above it (docs/tasarim/ekranlar/bugun.md, 4.2; frames ZT1, ZT2).
 */
export function ListMore({
  open,
  onToggle,
  className,
  controls,
}: {
  open: boolean;
  onToggle: () => void;
  className?: string;
  /** The id of the list it opens. */
  controls?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={cn(
        "border-line text-note focus-visible:shadow-focus flex h-11.5 w-full shrink-0 items-center justify-center gap-1.5 border-t font-semibold outline-none",
        className,
      )}
    >
      {open ? "Küçült" : "Hepsini göster"}
      <ChevronDown
        aria-hidden
        className={cn("size-4 transition-transform duration-(--motion-fast)", open && "rotate-180")}
      />
    </button>
  );
}
