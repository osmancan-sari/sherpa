import type { Metadata } from "next";
import { BlocksSettingsScreen } from "@/core/ui/settings/BlocksSettings";

export const metadata: Metadata = { title: "Sabit bloklar" };

export default function BlocksSettingsPage() {
  return <BlocksSettingsScreen />;
}
