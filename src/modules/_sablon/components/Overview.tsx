"use client";

import { useModuleQuery } from "@/core/app/hooks";
import { EmptyState } from "@/core/ui/kit";
import { useModule } from "@/core/ui/module/ModuleProvider";
import { listOpenWork } from "../queries";

/** The module's first tab. Everything inside the body region is the module's own. */
export function Overview() {
  const { row } = useModule();
  const open = useModuleQuery(row, ["open-work"], listOpenWork);

  if (open.isLoading) return null;
  if ((open.data ?? []).length === 0) return <EmptyState>Bu modülde henüz bir şey yok.</EmptyState>;
  return <p className="text-sm">{open.data!.length} açık iş var.</p>;
}
