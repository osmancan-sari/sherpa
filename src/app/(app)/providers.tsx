"use client";

import type { ReactNode } from "react";
import { CoreProvider } from "@/core/app/CoreProvider";
import { PlanKeeper } from "@/core/app/PlanKeeper";
import { NoticeProvider } from "@/core/ui/Notices";
import { QuickAddProvider } from "@/core/ui/QuickAdd";
import { BedAskDialog } from "@/core/ui/today/BedAsk";
import { registry } from "@/modules/registry";

/**
 * Where the modules meet the core: this file, outside src/core, hands the registry in.
 * Everything below can use the data hooks, the notices and quick add.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <CoreProvider registry={registry}>
      <PlanKeeper />
      <NoticeProvider>
        <QuickAddProvider>
          {children}
          <BedAskDialog />
        </QuickAddProvider>
      </NoticeProvider>
    </CoreProvider>
  );
}
