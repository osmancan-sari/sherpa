"use client";

import type { ReactNode } from "react";
import { CoreProvider } from "@/core/app/CoreProvider";
import { NoticeProvider } from "@/core/ui/Notices";
import { QuickAddProvider } from "@/core/ui/QuickAdd";
import { registry } from "@/modules/registry";

/**
 * Where the modules meet the core: this file, outside src/core, hands the registry in.
 * Everything below can use the data hooks, the notices and quick add.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <CoreProvider registry={registry}>
      <NoticeProvider>
        <QuickAddProvider>{children}</QuickAddProvider>
      </NoticeProvider>
    </CoreProvider>
  );
}
