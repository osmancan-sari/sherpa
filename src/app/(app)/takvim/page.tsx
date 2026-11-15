import type { Metadata } from "next";
import { TakvimScreen } from "@/core/ui/takvim/TakvimScreen";

export const metadata: Metadata = { title: "Takvim" };

export default function TakvimPage() {
  return <TakvimScreen />;
}
