"use client";

import type { ReactNode } from "react";
import { type BackdropKind, BackdropProvider, useBackdrop } from "./Backdrop";

/**
 * The app shell's backdrop: the calm backdrop on every screen (docs/tasarim/ilkeler.md, decision
 * 2) unless the screen asks for another while it is shown: Today the full landscape
 * (`<AskBackdrop kind={{ kind: "full" }} />`), a scene its tone, a module its own backdrop.
 */
export function ShellBackdrop({ children }: { children: ReactNode }) {
  return <BackdropProvider fallback={{ kind: "calm" }}>{children}</BackdropProvider>;
}

/** A page's request for its backdrop, as an element (for server pages). */
export function AskBackdrop({ kind }: { kind: BackdropKind }) {
  useBackdrop(kind);
  return null;
}
