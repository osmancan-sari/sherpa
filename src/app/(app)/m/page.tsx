import type { Metadata } from "next";
import { ModulesScreen } from "@/core/ui/module/ModuleScreens";

export const metadata: Metadata = { title: "Modüller" };

export default function ModulesPage() {
  return <ModulesScreen />;
}
