"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BackdropProvider } from "./Backdrop";

/**
 * The app shell's backdrop: the full landscape on Today, the calm backdrop on every other screen
 * (docs/tasarim/ilkeler.md, decision 2). A screen may ask for another while it is shown
 * (`useBackdrop`: a scene's tone, a module's own backdrop).
 */
export function ShellBackdrop({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <BackdropProvider fallback={{ kind: pathname === "/" ? "full" : "calm" }}>
      {children}
    </BackdropProvider>
  );
}
