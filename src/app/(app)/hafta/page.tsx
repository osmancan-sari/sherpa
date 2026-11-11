import type { Metadata } from "next";
import { WeekScreen } from "@/core/ui/week/WeekScreen";

export const metadata: Metadata = { title: "Hafta" };

export default function WeekPage() {
  return <WeekScreen />;
}
