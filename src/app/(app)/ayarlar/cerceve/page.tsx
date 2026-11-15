import type { Metadata } from "next";
import { FrameSection } from "@/core/ui/settings/sections";

export const metadata: Metadata = { title: "Günün çerçevesi" };

export default function Page() {
  return <FrameSection />;
}
