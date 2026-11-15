import { Suspense } from "react";
import { AreaScreen } from "@/core/ui/module/AreaScreen";

/** An area's page (Ç4c): found and drawn in the browser, like a module's page. */
export default function AreaPage() {
  return (
    <Suspense fallback={null}>
      <AreaScreen />
    </Suspense>
  );
}
