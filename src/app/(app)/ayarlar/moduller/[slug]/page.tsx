import type { Metadata } from "next";
import { Suspense } from "react";
import { ModuleSettingsScreen } from "@/core/ui/settings/ModulesSettings";

export const metadata: Metadata = { title: "Modül ayarları" };

export default function ModuleSettingsPage() {
  return (
    <Suspense fallback={null}>
      <ModuleSettingsScreen />
    </Suspense>
  );
}
