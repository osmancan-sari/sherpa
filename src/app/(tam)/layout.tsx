import { AppProviders } from "../(app)/providers";

/**
 * Full-screen module views (/m/<slug>/tam/<key>): the same data and session as the rest of
 * the app, without the shell. No navigation, no quick add button; the view has the screen.
 */
export default function FullscreenLayout({ children }: LayoutProps<"/">) {
  return <AppProviders>{children}</AppProviders>;
}
