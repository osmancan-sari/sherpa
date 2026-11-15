import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { LOOK_BOOT_SCRIPT } from "@/core/ui/look/look";
import { token } from "@/core/ui/tokens";
import "./globals.css";

const fontSans = Geist({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: { default: "Sherpa", template: "%s · Sherpa" },
  description: "Bütün işler tek havuzda; her an sıradaki iş.",
  applicationName: "Sherpa",
  // Private app: never indexed (also sent as an X-Robots-Tag header and in robots.txt).
  robots: { index: false, follow: false },
  // One colour system: the status bar sits over the dark sky at every hour.
  appleWebApp: { capable: true, title: "Sherpa", statusBarStyle: "black-translucent" },
  // Next.js writes the standard "mobile-web-app-capable"; older iOS only knows this one.
  other: { "apple-mobile-web-app-capable": "yes" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: token("color-solid"),
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {/* Before the first paint: "Saydamlığı azalt" and "Hareketi azalt" of this device. */}
        <Script id="look" strategy="beforeInteractive">
          {LOOK_BOOT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
