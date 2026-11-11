import { Suspense } from "react";
import { ModuleScreen } from "@/core/ui/module/ModuleScreens";

/**
 * Every path under /m/<slug>/ belongs to the module: its page, its tabs, its sub pages.
 * The module is found and drawn in the browser; this route is only the static frame.
 */
export default function ModulePage() {
  return (
    <Suspense fallback={null}>
      <ModuleScreen />
    </Suspense>
  );
}
