"use client";

import { CalendarRange, CircleDot, Inbox, LayoutGrid, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Bugün", icon: CircleDot },
  { href: "/hafta", label: "Hafta", icon: CalendarRange },
  { href: "/m", label: "Modüller", icon: LayoutGrid },
  { href: "/gelen", label: "Gelen kutusu", icon: Inbox },
  { href: "/ayarlar", label: "Ayarlar", icon: Settings },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Main navigation. One component, two layouts: a side rail on wide screens
 * and a bottom bar within thumb reach on the phone.
 */
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
  return (
    <nav
      aria-label="Ana gezinme"
      className={cn(
        "border-border bg-background z-10",
        "fixed inset-x-0 bottom-0 border-t pb-[env(safe-area-inset-bottom)]",
        "md:static md:w-52 md:shrink-0 md:border-t-0 md:border-r md:pb-0",
      )}
    >
      <div className="hidden px-5 pt-5 pb-4 text-sm font-semibold tracking-tight md:block">
        Sherpa
      </div>
      <ul className="flex md:flex-col md:gap-0.5 md:px-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isActive(pathname, href);
          return (
            <li key={href} className="min-w-0 flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[0.6875rem] leading-none",
                  "md:min-h-10 md:flex-row md:justify-start md:gap-2.5 md:rounded-lg md:px-3 md:text-sm",
                  "text-muted-foreground focus-visible:ring-ring/50 transition-colors outline-none focus-visible:ring-3",
                  "hover:text-foreground md:hover:bg-muted",
                  active && "text-foreground md:bg-muted font-medium",
                )}
              >
                <Icon aria-hidden className="size-5 md:size-4" strokeWidth={active ? 2.25 : 1.75} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
