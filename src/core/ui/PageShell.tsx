import { ChevronLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ConnectionPill } from "./look/Connection";

// The frame of a list screen (docs/tasarim/ekranlar/menu.md, "Sayfa başlığı"): the title, an
// action at its right on the board, and the content under it on the calm backdrop.

const WIDTH = {
  /** One column of cards (Gelen kutusu). */
  read: "md:max-w-read",
  /** The whole width beside the menu: panels side by side (Modüller), like the module page. */
  full: "",
} as const;

export function PageShell({
  title,
  back,
  action,
  width = "full",
  children,
}: {
  title: string;
  /** On the phone, an arrow at the title's left that goes back (the board has its menu). */
  back?: { href: Route; label: string };
  /** At the title's right on the board ("+ Yeni giriş"). */
  action?: ReactNode;
  width?: keyof typeof WIDTH;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-1 flex-col gap-3.5 px-4 pt-4.5 pb-6 md:gap-4 md:px-10 md:pt-6">
      <header className={cn("flex items-center gap-3 px-1 md:px-0", WIDTH[width])}>
        {back ? (
          <Link
            href={back.href}
            aria-label={back.label}
            className="size-touch focus-visible:shadow-focus -my-2.5 -mr-1 -ml-2.5 flex shrink-0 items-center justify-center rounded-full outline-none md:hidden"
          >
            <ChevronLeft aria-hidden className="size-5.5" />
          </Link>
        ) : null}
        <h1 className="text-title tracking-title flex-1 font-bold md:text-3xl">{title}</h1>
        <ConnectionPill />
        {action ? <div className="hidden md:block">{action}</div> : null}
      </header>
      <div className={cn("flex flex-col gap-3.5 md:gap-4", WIDTH[width])}>{children}</div>
    </div>
  );
}

/** What a screen shows while it has nothing to show. One plain sentence, nothing to feel bad about. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-ink-2 p-1 text-base">{children}</p>;
}
