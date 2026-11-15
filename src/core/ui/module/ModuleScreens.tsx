"use client";

import { ArrowLeft, ChevronRight, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useRegistry } from "@/core/app/CoreProvider";
import { type KnownModule, useModuleQuery, useModuleRows, useModules } from "@/core/app/hooks";
import { moduleColor } from "@/core/contract/colors";
import type { ChipData } from "@/core/contract/types";
import { ListRow } from "@/core/ui/kit/ListRow";
import { Panel } from "@/core/ui/kit/Panel";
import { resolveModulePath } from "@/core/contract/registry";
import { ClientOnly } from "../ClientOnly";
import { EmptyState, PageShell } from "../PageShell";
import { useBackdrop } from "@/core/ui/sky/Backdrop";
import { modulePageBackdrop } from "@/core/ui/sky/moduleBackdrop";
import { ModulePageShell } from "./ModulePageShell";
import { ModuleProvider } from "./ModuleProvider";

// The routes under /m: the list of modules, a module's page with its tabs, its sub pages and
// its full-screen views. Every path under /m/<slug>/ belongs to the module; the core only
// resolves it and puts the frame around it.

/** /m (docs/tasarim/ekranlar/moduller.md; frames MT1, MP1). */
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
  const shown = [
    ...modules.filter(({ row }) => row.status === "active"),
    ...modules.filter(({ row }) => row.status === "paused"),
  ];
  if (isLoading) return null;
  // Modules of an area together in the area's panel; the others in one panel of their own.
  const areas = new Map<string, { name: string; modules: KnownModule[] }>();
  const loose: KnownModule[] = [];
  for (const mod of shown) {
    const area = mod.definition?.area;
    if (!area) {
      loose.push(mod);
      continue;
    }
    const group = areas.get(area.slug) ?? { name: area.name, modules: [] };
    group.modules.push(mod);
    areas.set(area.slug, group);
  }
  return (
    <>
      {shown.length === 0 ? (
        <EmptyState>Henüz modül yok.</EmptyState>
      ) : (
        <div className="grid items-start gap-3.5 md:grid-cols-2 md:gap-5">
          {[...areas.values()].map((area) => (
            <Panel
              key={area.name}
              variant="dense"
              aria-label={area.name}
              className="overflow-hidden"
            >
              <div className="border-line flex flex-col gap-0.5 border-b px-4 pt-3 pb-2.5">
                <span className="panel-label text-ink">{area.name}</span>
                <span className="text-ink-2 text-sm">
                  {area.modules.map(({ row }) => row.name).join(" · ")}
                </span>
              </div>
              {area.modules.map((mod) => (
                <ModuleRow key={mod.row.id} mod={mod} />
              ))}
            </Panel>
          ))}
          {loose.length > 0 ? (
            <Panel variant="dense" aria-label="Modüller" className="overflow-hidden">
              {loose.map((mod) => (
                <ModuleRow key={mod.row.id} mod={mod} />
              ))}
            </Panel>
          ) : null}
        </div>
      )}
      <p className="px-1 pt-1.5">
        <Link href="/ayarlar/moduller" className="link-quiet text-note font-semibold">
          Modülleri aç, duraklat ya da arşivle
        </Link>
      </p>
    </>
  );
}

/** A module in the list: its colour, name and state line; a paused one is faded. */
function ModuleRow({ mod }: { mod: KnownModule }) {
  const chip = useModuleQuery<ChipData | null>(mod.row, ["chip"], async (ctx) =>
    mod.definition ? mod.definition.chip(ctx) : null,
  );
  const paused = mod.row.status === "paused";
  const health = chip.data && chip.data.health !== "ok" ? chip.data.health : null;
  return (
    <ListRow
      href={`/m/${mod.row.slug}`}
      dot={moduleColor(mod)}
      pending={paused}
      title={mod.row.name}
      subtitle={
        <>
          {chip.data?.text ?? null}
          {health ? (
            <span className={`health-${health}`}>
              {" "}
              · {health === "attention" ? "dikkat" : "geride"}
            </span>
          ) : null}
        </>
      }
      trailing={
        <>
          {paused ? <span className="text-ink-2 text-sm">duraklatıldı</span> : null}
          <ChevronRight aria-hidden className="text-ink-2 mx-1.5 size-4.5" />
        </>
      }
    />
  );
}

/** A module that cannot be shown: its name, one sentence in a dense panel and a link (XT10–XT13). */
function Message({
  title,
  sentence,
  link,
}: {
  title?: string;
  sentence?: string;
  link?: { href: Route; label: string };
}) {
  if (!title) return <div className="flex-1" />;
  return (
    <PageShell title={title} width="read">
      <Panel variant="dense" className="items-start gap-3 p-4 md:p-4.5">
        <p className="text-base">{sentence}</p>
        {link ? (
          <Link href={link.href} className="link-quiet text-note font-semibold">
            {link.label}
          </Link>
        ) : null}
      </Panel>
    </PageShell>
  );
}

/** Finds the module a path names, or says in one sentence why there is nothing to show. */
function useNamedModule(slug: string): { mod?: KnownModule; fallback?: ReactNode } {
  const registry = useRegistry();
  const rows = useModuleRows();
  const { modules } = useModules();
  const mod = modules.find(({ row }) => row.slug === slug);
  const definition = registry.get(slug);

  if (rows.isLoading) return { fallback: <Message /> };
  if (!mod || mod.row.status === "archived") {
    return {
      fallback: (
        <Message
          title={mod?.row.name ?? definition?.name ?? "Modül"}
          sentence={
            mod
              ? "Bu modül arşivde."
              : definition
                ? "Bu modül etkin değil."
                : "Böyle bir modül yok."
          }
          link={{ href: "/ayarlar/moduller", label: "Modüller Ayarlar’dan açılır" }}
        />
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
  // Ç4b: a module with a backdrop of its own stands on it on its page (decision 4).
  useBackdrop(mod ? modulePageBackdrop(mod) : null);
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
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm outline-none focus-visible:ring-3"
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
    <Message
      title={mod.row.name}
      sentence="Bu modülde böyle bir sayfa yok."
      link={{ href: `/m/${mod.row.slug}` as Route, label: "Modül sayfasına dön" }}
    />
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
  // Ç4b: a module with a backdrop of its own stands on it on its page (decision 4).
  useBackdrop(mod ? modulePageBackdrop(mod) : null);
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
