import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/core/ui/kit/Button";
import { Panel } from "@/core/ui/kit/Panel";
import { SettingsShell } from "@/core/ui/settings/SettingsShell";
import { getCurrentUser } from "@/lib/auth/session";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Ayarlar" };

/**
 * Ayarlar (docs/tasarim/ekranlar/ayarlar.md): the list of sections, and under it "Dışa aktarım"
 * and "Hesap", open; each section is a page of its own (/ayarlar/<bölüm>).
 */
export default function SettingsLayout({ children }: LayoutProps<"/ayarlar">) {
  return (
    // The shell reads the address, which only exists in the browser's request.
    <Suspense fallback={null}>
      <SettingsShell aside={<Aside />}>{children}</SettingsShell>
    </Suspense>
  );
}

function Aside() {
  return (
    <>
      <Panel variant="dense" label="Dışa aktarım" className="gap-3 px-0 pb-4">
        <div className="flex flex-col items-start gap-3 px-4 md:px-4.5">
          <p className="text-note leading-snug">Bütün veri tek bir JSON dosyası olarak iner.</p>
          {/* A plain link on purpose: this is a file download, not a page of the app. */}
          <a
            href="/api/export"
            download
            className="h-control-sm bg-fill-button border-edge-button shadow-button text-ink focus-visible:shadow-focus relative inline-flex items-center rounded-full border px-4 text-sm font-semibold outline-none after:absolute after:inset-x-0 after:-inset-y-0.75"
          >
            Tümünü dışa aktar
          </a>
        </div>
      </Panel>
      <Panel variant="dense" label="Hesap" className="gap-3 px-0 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-4.5">
          <p className="text-base break-all">
            <Suspense fallback={null}>
              <AccountEmail />
            </Suspense>
          </p>
          <form action={signOut}>
            <Button type="submit" size="sm" className="font-semibold">
              Çıkış yap
            </Button>
          </form>
        </div>
      </Panel>
      <Link
        href="/tasarim"
        className="link-quiet text-note text-ink-2 min-h-touch inline-flex w-fit items-center px-1"
      >
        Tasarım galerisi
      </Link>
    </>
  );
}

/** Reads the session, so it streams in behind the Suspense boundary. */
async function AccountEmail() {
  const user = await getCurrentUser();
  return user?.email ?? null;
}
