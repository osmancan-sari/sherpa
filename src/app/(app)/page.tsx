import { EmptyState, PageShell } from "@/core/ui/PageShell";

export default function TodayPage() {
  return (
    <PageShell title="Bugün">
      <EmptyState>Bugün için planlanan bir şey yok.</EmptyState>
    </PageShell>
  );
}
