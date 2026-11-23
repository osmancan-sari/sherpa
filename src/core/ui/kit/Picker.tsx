"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// The picker (docs/tasarim/parcalar.md, "Açılır seçici"; Okul çekirdek A, frames DersSecici and
// AnaSayfa): one entry out of many on the phone, where tabs would not fit (a module's six
// courses). Closed: a glass pill with the chosen entry's name, or its own word ("Ders seç"), and
// a down arrow. Open: a dense panel under it with the entries, each with its colour dot, its name
// and a line under it; the list scrolls inside when it is long. Every entry is a link; choosing
// one, Escape or a touch outside closes it.

export type PickerItem = {
  key: string;
  label: string;
  href: ComponentProps<typeof Link>["href"];
  /** The entry's colour (a facet's). */
  dot?: string | null;
  /** One short line under the name. */
  detail?: string | null;
};

export function Picker({
  label,
  items,
  selected,
  placeholder,
  className,
}: {
  /** The picker's accessible name ("Bölümler"). */
  label: string;
  items: PickerItem[];
  /** The chosen entry's key; none: the placeholder shows. */
  selected?: string | null;
  /** The closed pill's word while nothing is chosen ("Ders seç"). */
  placeholder: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const chosen = items.find((item) => item.key === selected) ?? null;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={cn("relative min-w-0", className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className={cn(
          "glass-soft rounded-tabs h-control text-ink flex w-full min-w-0 items-center gap-2.5 px-4.5 text-left outline-none",
          "focus-visible:shadow-focus",
        )}
      >
        {chosen?.dot ? (
          <span
            aria-hidden
            className="size-2.25 shrink-0 rounded-full"
            style={{ backgroundColor: chosen.dot }}
          />
        ) : null}
        <span className="text-note min-w-0 flex-1 truncate font-semibold">
          {chosen?.label ?? placeholder}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4.5 shrink-0 transition-transform duration-(--motion-fast)",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <ul
          id={listId}
          aria-label={label}
          className="glass-dense rounded-dense shadow-panel absolute inset-x-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto py-1.5"
        >
          {items.map((item) => (
            <li key={item.key} className="border-line not-first:border-t">
              <Link
                href={item.href}
                aria-current={item.key === selected ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "min-h-row flex items-center gap-3 px-4 py-2 outline-none md:px-4.5",
                  "focus-visible:shadow-focus",
                  item.key === selected && "bg-fill-selected",
                )}
              >
                {item.dot ? (
                  <span
                    aria-hidden
                    className="size-2.25 shrink-0 rounded-full"
                    style={{ backgroundColor: item.dot }}
                  />
                ) : null}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-base font-semibold">{item.label}</span>
                  {item.detail ? (
                    <span className="text-ink-2 truncate text-sm">{item.detail}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The first entry beside the picker ("Ana sayfa"): a tab-like pill, the opaque light when chosen. */
export function PickerHome({
  selected,
  children,
  className,
  ...props
}: ComponentProps<typeof Link> & { selected?: boolean }) {
  return (
    <Link
      aria-current={selected ? "page" : undefined}
      className={cn(
        "rounded-tabs h-control text-note flex shrink-0 items-center px-4.5 font-semibold whitespace-nowrap outline-none",
        "focus-visible:shadow-focus",
        selected ? "bg-light text-ink-dark border-edge-light border" : "glass-soft text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
