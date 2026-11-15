"use client";

import { CalendarDays, CircleDot, Inbox, LayoutGrid, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { QuickAddButton } from "./QuickAdd";

// The main navigation (docs/tasarim/ekranlar/menu.md). On the phone a glass bar at the bottom,
// within thumb reach, with the "+" of quick add as a circle of its own beside it; the selected
// page is wider, the one opaque light pill. On the board a glass rail on the left; the selected
// page is the opaque light. "Hafta" is called "Takvim" (the page itself is Ç4c's).

const items = [
  { href: "/", label: "Bugün", short: "Bugün", icon: CircleDot },
  { href: "/hafta", label: "Takvim", short: "Takvim", icon: CalendarDays },
  { href: "/m", label: "Modüller", short: "Modüller", icon: LayoutGrid },
  { href: "/gelen", label: "Gelen kutusu", short: "Gelen", icon: Inbox },
  { href: "/ayarlar", label: "Ayarlar", short: "Ayarlar", icon: Settings },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  // On routes with a dynamic segment the path is only known in the browser; until then the
  // same bar is drawn with no item marked.
  return (
    <Suspense fallback={<AppNavView pathname={null} />}>
      <CurrentAppNav />
    </Suspense>
  );
}

function CurrentAppNav() {
  return <AppNavView pathname={usePathname()} />;
}

function AppNavView({ pathname }: { pathname: string | null }) {
  const active = (href: string) => pathname !== null && isActive(pathname, href);
  return (
    <>
      {/* The board: a glass rail on the left, standing beside the page. */}
      <div className="hidden shrink-0 md:sticky md:top-0 md:block md:h-dvh md:pt-[calc(--spacing(4)+env(safe-area-inset-top))] md:pb-4 md:pl-4">
        <nav
          aria-label="Ana gezinme"
          className="glass-rail rounded-rail w-rail flex h-full flex-col gap-1 px-2 py-4.5 text-sm"
        >
          <div className="px-3 pb-3.5 font-bold">Sherpa</div>
          <ul className="flex flex-col gap-1">
            {items.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active(href) ? "page" : undefined}
                  className={cn(
                    "rounded-step focus-visible:shadow-focus min-h-touch flex items-center px-3 outline-none",
                    active(href)
                      ? "bg-light text-ink-dark shadow-selected-rail font-semibold"
                      : "text-ink hover:bg-fill-field",
                  )}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* The phone: a glass bar and the "+" circle, over the bottom of the page. */}
      <div className="fixed inset-x-4 bottom-[calc(--spacing(5.5)+env(safe-area-inset-bottom))] z-20 flex items-center gap-2.5 md:hidden">
        <nav
          aria-label="Ana gezinme"
          className="glass-nav h-nav text-nav flex min-w-0 flex-1 rounded-full p-1.5"
        >
          {items.map(({ href, label, short, icon: Icon }) => {
            const on = active(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "focus-visible:shadow-focus flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-full leading-none outline-none",
                  on
                    ? "bg-light text-ink-dark shadow-selected flex-[1.55] font-semibold"
                    : "text-ink-nav flex-1",
                )}
              >
                <Icon aria-hidden className="size-5" strokeWidth={2} />
                <span className="max-w-full truncate">{short}</span>
              </Link>
            );
          })}
        </nav>
        <QuickAddButton floating />
      </div>
    </>
  );
}
