import type { Metadata } from "next";
import { ConnectionsSection } from "@/core/ui/settings/sections";

export const metadata: Metadata = { title: "Bağlantılar" };

export default function Page() {
  return <ConnectionsSection />;
}
