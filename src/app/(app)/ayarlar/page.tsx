import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/core/ui/PageShell";
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border flex flex-col gap-3 rounded-xl border p-5">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}
