import { AppNav } from "@/core/ui/AppNav";
import { AppProviders } from "./providers";

/** Shell of the signed-in app. The proxy lets nobody in here without a session. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppProviders>
      <div className="flex min-h-dvh flex-1 flex-col md:flex-row">
        <AppNav />
        {/* On the phone the page ends with room for the menu bar it scrolls under. */}
        <main className="flex min-w-0 flex-1 flex-col pb-[calc(var(--spacing-nav-space)+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>
    </AppProviders>
  );
}
