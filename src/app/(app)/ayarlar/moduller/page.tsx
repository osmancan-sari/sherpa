import type { Metadata } from "next";
import { ModulesSettingsScreen } from "@/core/ui/settings/ModulesSettings";

export const metadata: Metadata = { title: "Modüller" };

export default function ModulesSettingsPage() {
  return <ModulesSettingsScreen />;
}
