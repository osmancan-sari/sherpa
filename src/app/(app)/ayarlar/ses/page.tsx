import type { Metadata } from "next";
import { VoiceSection } from "@/core/ui/settings/sections";

export const metadata: Metadata = { title: "Sesli anlatım" };

export default function Page() {
  return <VoiceSection />;
}
