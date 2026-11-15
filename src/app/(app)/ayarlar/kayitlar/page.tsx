import type { Metadata } from "next";
import { RecordsSection } from "@/core/ui/settings/sections";

export const metadata: Metadata = { title: "Uyanış ve yatış kayıtları" };

export default function Page() {
  return <RecordsSection />;
}
