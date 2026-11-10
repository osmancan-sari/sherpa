import type { Metadata } from "next";
import { EmptyState, PageShell } from "@/core/ui/PageShell";

export const metadata: Metadata = { title: "Hafta" };

export default function WeekPage() {
  return (
    <PageShell title="Hafta">
      <EmptyState>Bu hafta için henüz bir şey yok.</EmptyState>
    </PageShell>
  );
}
