"use client";

import { ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useRegistry } from "@/core/app/CoreProvider";
import { type KnownModule, useModuleRows, useModules } from "@/core/app/hooks";
import { resolveModulePath } from "@/core/contract/registry";
import { ClientOnly } from "../ClientOnly";
import { EmptyState, PageShell } from "../PageShell";
import { ModuleChip } from "../today/TodayScreen";
import { ModulePageShell } from "./ModulePageShell";
import { ModuleProvider } from "./ModuleProvider";

// The routes under /m: the list of modules, a module's page with its tabs, its sub pages and
// its full-screen views. Every path under /m/<slug>/ belongs to the module; the core only
// resolves it and puts the frame around it.

/** /m */
export function ModulesScreen() {
  return (
    <PageShell title="Modüller">
      <ClientOnly>
        <ModulesList />
      </ClientOnly>
    </PageShell>
  );
}

function ModulesList() {
  const { modules, isLoading } = useModules();
  const active = modules.filter(({ row }) => row.status === "active");
  const paused = modules.filter(({ row }) => row.status === "paused");
  if (isLoading) return null;
  return (
    <>
      {active.length + paused.length === 0 ? (
        <EmptyState>Henüz modül yok.</EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {[...active, ...paused].map((mod) => (
            <div key={mod.row.id} className="flex items-center gap-3">
              <ModuleChip mod={mod} />
              {mod.row.status === "paused" ? (
                <span className="text-muted-foreground text-sm">duraklatıldı</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <p className="text-sm">
        <Link
          href="/ayarlar/moduller"
          className="text-muted-foreground underline underline-offset-4"
        >
          Modülleri aç, duraklat ya da arşivle
        </Link>
      </p>
    </>
  );
}

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-5 py-6 md:px-10 md:py-8">
      {children}
    </div>
  );
}

/** Finds the module a path names, or says in one sentence why there is nothing to show. */
function useNamedModule(slug: string): { mod?: KnownModule; fallback?: ReactNode } {
  const registry = useRegistry();
  const rows = useModuleRows();
  const { modules } = useModules();
  const mod = modules.find(({ row }) => row.slug === slug);
  const definition = registry.get(slug);

  if (rows.isLoading) return { fallback: <Message>{null}</Message> };
  if (!mod || mod.row.status === "archived") {
    return {
      fallback: (
        <Message>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            {mod?.row.name ?? definition?.name ?? "Modül"}
          </h1>
          <p className="text-muted-foreground">
            {mod
              ? "Bu modül arşivde."
              : definition
                ? "Bu modül etkin değil."
                : "Böyle bir modül yok."}
          </p>
          <p>
            <Link href="/ayarlar/moduller" className="underline underline-offset-4">
              Modüller Ayarlar’dan açılır
            </Link>
          </p>
        </Message>
      ),
    };
  }
  return { mod };
}

/** /m/<slug>/<...path>: a tab of the module page, or one of the module's sub pages. */
export function ModuleScreen() {
  return (
    <ClientOnly>
      <ModuleRoute />
    </ClientOnly>
  );
}

function ModuleRoute() {
  const params = useParams<{ slug: string; path?: string[] }>();
  const segments = (params.path ?? []).map(decodeURIComponent);
  const { mod, fallback } = useNamedModule(params.slug);
  if (!mod) return fallback;

  // A module row without code behind it has a page with the core's defaults and nothing else.
  if (!mod.definition) {
    return segments.length === 0 ? (
      <ModuleProvider mod={mod}>
        <ModulePageShell mod={mod} tabKey={null} />
      </ModuleProvider>
    ) : (
      <NotFound mod={mod} />
    );
  }

  const resolved = resolveModulePath(mod.definition, segments);
  if (resolved.kind === "missing") return <NotFound mod={mod} />;

  if (resolved.kind === "tab") {
    return (
      <ModuleProvider mod={mod}>
        <ModulePageShell mod={mod} tabKey={resolved.tabKey} />
      </ModuleProvider>
    );
  }

  const route = mod.definition.ui.routes![resolved.index];
  const View = route.component;
  return (
    <ModuleProvider mod={mod}>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-6 md:px-10 md:py-8">
        <Link
          href={`/m/${mod.row.slug}`}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm outline-none focus-visible:ring-3 md:min-h-9"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {mod.row.name}
        </Link>
        {route.title ? (
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{route.title}</h1>
        ) : null}
        <View params={resolved.params} />
      </div>
    </ModuleProvider>
  );
}

function NotFound({ mod }: { mod: KnownModule }) {
  return (
    <Message>
      <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{mod.row.name}</h1>
      <p className="text-muted-foreground">Bu modülde böyle bir sayfa yok.</p>
      <p>
        <Link href={`/m/${mod.row.slug}`} className="underline underline-offset-4">
          Modül sayfasına dön
        </Link>
      </p>
    </Message>
  );
}

/**
 * /m/<slug>/tam/<key>: a view that takes the whole screen. The app shell (navigation, quick
 * add button) is not drawn; one small button leads back to the module page.
 */
export function ModuleFullscreenScreen() {
  return (
    <ClientOnly>
      <FullscreenRoute />
    </ClientOnly>
  );
}

function FullscreenRoute() {
  const params = useParams<{ slug: string; key: string }>();
  const { mod, fallback } = useNamedModule(params.slug);
  if (!mod) return fallback;

  const view = mod.definition?.ui.fullscreen?.find((candidate) => candidate.key === params.key);
  if (!view) return <NotFound mod={mod} />;
  const View = view.component;

  return (
    <ModuleProvider mod={mod}>
      <div className="flex min-h-dvh flex-1 flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <header className="flex items-center justify-between gap-4 px-5 py-3 md:px-8">
          <h1 className="text-muted-foreground text-sm">
            {mod.row.name} · {view.label}
          </h1>
          <Link
            href={`/m/${mod.row.slug}`}
            aria-label="Kapat"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex size-11 items-center justify-center rounded-lg outline-none focus-visible:ring-3"
          >
            <X aria-hidden className="size-5" />
          </Link>
        </header>
        <main className="flex flex-1 flex-col px-5 pb-6 md:px-8">
          <View params={{}} />
        </main>
      </div>
    </ModuleProvider>
  );
}
