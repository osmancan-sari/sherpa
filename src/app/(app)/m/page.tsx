import type { Metadata } from "next";
import { EmptyState, PageShell } from "@/core/ui/PageShell";

export const metadata: Metadata = { title: "Modüller" };

export default function ModulesPage() {
  return (
    <PageShell title="Modüller">
      <EmptyState>Henüz modül yok.</EmptyState>
    </PageShell>
  );
}
