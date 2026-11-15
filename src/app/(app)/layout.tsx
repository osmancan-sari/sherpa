import { AppNav } from "@/core/ui/AppNav";
import { AppProviders } from "./providers";

/** Shell of the signed-in app. The proxy lets nobody in here without a session. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppProviders>
      <div className="flex min-h-dvh flex-1 flex-col md:flex-row">
        <AppNav />
        {/* Every screen starts under the phone's clock and island (the app on the home screen
            draws under them); the sky still reaches up behind them (Backdrop, SafeTopBand).
            This is the one place that room is made: screens do not add it. On the phone the
            page ends with room for the menu bar it scrolls under. */}
        <main className="flex min-w-0 flex-1 flex-col pt-[env(safe-area-inset-top)] pb-[calc(var(--spacing-nav-space)+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>
    </AppProviders>
  );
}
