import type { Metadata } from "next";
import { EmptyState, PageShell } from "@/core/ui/PageShell";

export const metadata: Metadata = { title: "Gelen kutusu" };

export default function InboxPage() {
  return (
    <PageShell title="Gelen kutusu">
      <EmptyState>Gelen kutusu boş.</EmptyState>
    </PageShell>
  );
}
