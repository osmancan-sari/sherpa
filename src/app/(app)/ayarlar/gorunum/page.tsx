import type { Metadata } from "next";
import { LookSection } from "@/core/ui/settings/sections";

export const metadata: Metadata = { title: "Görünüm" };

export default function Page() {
  return <LookSection />;
}
