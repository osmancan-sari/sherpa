"use client";

import type { ReactNode } from "react";
import { useHydrated } from "@/core/app/hooks";

/**
 * Renders its children in the browser only. The signed-in screens are drawn from the user's
 * data and the current time, neither of which exists while a page is prerendered; the static
 * shell shows the fallback (a title, an empty frame) until the browser takes over.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return useHydrated() ? children : fallback;
}
