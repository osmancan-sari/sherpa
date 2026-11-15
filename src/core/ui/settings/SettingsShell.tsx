"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { Panel } from "@/core/ui/kit/Panel";
import { cn } from "@/lib/utils";

// Ayarlar (docs/tasarim/ekranlar/ayarlar.md): on the phone a list of sections and each section
// on a page of its own (a back arrow in its title); on the board the list on the left (the
// selected section the opaque light) and the selected section on the right. "Dışa aktarım" and
// "Hesap" are short: they stay open under the list. Links such as /ayarlar#kayitlar open their
// section.

export const SECTIONS = [
  { key: "gorunum", title: "Görünüm" },
  { key: "cerceve", title: "Günün çerçevesi" },
  { key: "kayitlar", title: "Uyanış ve yatış kayıtları" },
  { key: "ses", title: "Sesli anlatım (bu cihaz)" },
  { key: "moduller", title: "Modüller" },
  { key: "bloklar", title: "Sabit bloklar" },
  { key: "yapay-zeka", title: "Yapay zeka" },
  { key: "baglantilar", title: "Bağlantılar" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

const hrefOf = (key: SectionKey) => `/ayarlar/${key}` as Route;

/** The section the address names; null on /ayarlar itself. */
function sectionOf(pathname: string): SectionKey | null {
  const key = pathname.split("/")[2];
  return SECTIONS.some((section) => section.key === key) ? (key as SectionKey) : null;
}

/** Whether the page is a section of its own (its title is the page's heading). */
const OwnPage = createContext(false);

export function SettingsShell({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const section = sectionOf(pathname);

  // Old links (/ayarlar#kayitlar) open their section.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (section === null && SECTIONS.some((item) => item.key === hash)) {
      router.replace(hrefOf(hash as SectionKey));
    }
  }, [section, router]);

  const selected = section ?? "gorunum";
  return (
    <div className="flex w-full flex-1 flex-col gap-4 px-4 py-5.5 md:px-10 md:py-6">
      {section === null ? (
        <h1 className="text-title tracking-title font-bold md:text-3xl">Ayarlar</h1>
      ) : (
        <p className="tracking-title hidden text-3xl font-bold md:block">Ayarlar</p>
      )}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,var(--spacing-settings-list))_minmax(0,var(--spacing-settings-body))] md:items-start md:gap-5">
        <div className={cn("flex flex-col gap-4", section !== null && "hidden md:flex")}>
          <Panel as="nav" variant="dense" aria-label="Ayarlar bölümleri" className="md:p-2">
            <ul className="flex flex-col md:gap-0.5">
              {SECTIONS.map((item) => {
                const on = item.key === selected;
                return (
                  <li key={item.key} className="border-line border-b last:border-b-0 md:border-b-0">
                    <Link
                      href={hrefOf(item.key)}
                      aria-current={section === item.key ? "page" : undefined}
                      className={cn(
                        "focus-visible:shadow-focus flex min-h-12.75 items-center gap-3 px-4 text-base outline-none",
                        "md:rounded-step md:text-note md:min-h-11 md:px-3.5",
                        on
                          ? "md:bg-light md:text-ink-dark md:font-semibold"
                          : "md:hover:bg-fill-field",
                      )}
                    >
                      <span className="flex-1">{item.title}</span>
                      <ChevronRight aria-hidden className="text-ink-2 size-4.5 md:hidden" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
          {aside}
        </div>
        <div className={cn("min-w-0", section === null && "hidden md:block")}>
          <OwnPage.Provider value={section !== null}>{children}</OwnPage.Provider>
        </div>
      </div>
    </div>
  );
}

/**
 * A section of the settings: its title (with a back arrow on the phone) and its content in a
 * dense panel. A section that draws its own panels passes `bare`.
 */
export function SettingsSection({
  title,
  description,
  back = "/ayarlar",
  bare = false,
  children,
}: {
  title: string;
  description?: ReactNode;
  /** Where the phone's back arrow goes. */
  back?: Route;
  bare?: boolean;
  children: ReactNode;
}) {
  const own = useContext(OwnPage);
  const Heading = own ? "h1" : "h2";
  return (
    <section aria-label={title} className="flex flex-col gap-3 md:gap-3.5">
      <div className="flex items-center gap-1 md:pt-1">
        <Link
          href={back}
          aria-label="Geri"
          className="size-touch focus-visible:shadow-focus -ml-2.5 flex shrink-0 items-center justify-center rounded-full outline-none md:hidden"
        >
          <ChevronLeft aria-hidden className="size-5.5" />
        </Link>
        <Heading className="text-section tracking-title font-bold md:text-xl">{title}</Heading>
      </div>
      {bare ? (
        children
      ) : (
        <Panel variant="dense" className="gap-3 px-4 py-4 md:px-4 md:py-4.5">
          {description ? (
            <p className="text-note text-ink-2 leading-relaxed">{description}</p>
          ) : null}
          {children}
        </Panel>
      )}
    </section>
  );
}
