import { Suspense } from "react";
import { ModuleFullscreenScreen } from "@/core/ui/module/ModuleScreens";

export default function ModuleFullscreenPage() {
  return (
    <Suspense fallback={null}>
      <ModuleFullscreenScreen />
    </Suspense>
  );
}
