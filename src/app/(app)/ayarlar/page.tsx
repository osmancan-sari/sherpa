import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/core/ui/PageShell";
import { AiSettings } from "@/core/ui/settings/AiSettings";
import { DayFrameSettings } from "@/core/ui/settings/DayFrameSettings";
import { getCurrentUser } from "@/lib/auth/session";
import { signOut } from "./actions";
import { ThemeSwitch } from "./theme-switch";

export const metadata: Metadata = { title: "Ayarlar" };

export default function SettingsPage() {
  return (
    <PageShell title="Ayarlar">
      <Section title="Görünüm">
        <ThemeSwitch />
      </Section>

      <Section title="Günün çerçevesi">
        <DayFrameSettings />
      </Section>

      <Section title="Modüller">
        <SettingsLink href="/ayarlar/moduller">Modülleri aç, duraklat ya da arşivle</SettingsLink>
      </Section>

      <Section title="Sabit bloklar">
        <SettingsLink href="/ayarlar/bloklar">
          Haftalık seriler ve tek seferlik bloklar
        </SettingsLink>
      </Section>

      <Section title="Yapay zeka">
        <AiSettings />
      </Section>

      <Section title="Dışa aktarım">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            Bütün veri tek bir JSON dosyası olarak iner.
          </p>
          {/* A plain link on purpose: this is a file download, not a page of the app. */}
          <a
            href="/api/export"
            download
            className="border-border hover:bg-muted flex h-11 items-center rounded-lg border px-2.5 text-sm font-medium md:h-9"
          >
            Tümünü dışa aktar
          </a>
        </div>
      </Section>

      <Section title="Hesap">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground min-h-5 text-sm break-all">
            <Suspense fallback={null}>
              <AccountEmail />
            </Suspense>
          </p>
          <form action={signOut}>
            <Button type="submit" variant="outline" className="h-11 md:h-9">
              Çıkış yap
            </Button>
          </form>
        </div>
      </Section>
    </PageShell>
  );
}

/** Reads the session, so it streams in behind the Suspense boundary. */
async function AccountEmail() {
  const user = await getCurrentUser();
  return user?.email ?? null;
}

function SettingsLink({ href, children }: { href: Route; children: ReactNode }) {
  return (
    <Link href={href} className="w-fit text-sm underline underline-offset-4">
      {children}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border flex flex-col gap-3 rounded-xl border p-5">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}
