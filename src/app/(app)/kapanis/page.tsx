import type { Metadata } from "next";
import { ClosingScreen } from "@/core/ui/closing/ClosingScreen";

export const metadata: Metadata = { title: "Kapanış" };

export default function ClosingPage() {
  return <ClosingScreen />;
}
