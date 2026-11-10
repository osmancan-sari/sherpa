import { AppNav } from "@/core/ui/AppNav";
import { QuickAddButton } from "@/core/ui/QuickAdd";
import { AppProviders } from "./providers";

/** Shell of the signed-in app. The proxy lets nobody in here without a session. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppProviders>
      <div className="flex min-h-dvh flex-1 flex-col md:flex-row">
        <AppNav />
        <main className="flex min-w-0 flex-1 flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
        <QuickAddButton floating />
      </div>
    </AppProviders>
  );
}
