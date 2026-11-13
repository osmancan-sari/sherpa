"use client";

import { moduleColor } from "@/core/contract/colors";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRegistry } from "@/core/app/CoreProvider";
import { type KnownModule, useCoreMutation, useModules } from "@/core/app/hooks";
import type { ModuleDefinition } from "@/core/contract/types";
import { activateModule, archiveModule, setModuleStatus } from "@/core/data/module-rows";
import type { LifeMode, ModuleRow } from "@/core/types";
import { ClientOnly } from "../ClientOnly";
import { ModuleProvider } from "../module/ModuleProvider";
import { SAVE_FAILED, useNotify } from "../Notices";
import { PageShell } from "../PageShell";

// Settings → Modules: switch a module on, pause it, archive it; and each module's own settings.

const STATUS_LABEL: Record<ModuleRow["status"], string> = {
  active: "etkin",
  paused: "duraklatıldı",
  archived: "arşivde",
};

type Entry = { slug: string; name: string; row?: ModuleRow; definition?: ModuleDefinition };

/** /ayarlar/moduller */
export function ModulesSettingsScreen() {
  return (
    <PageShell title="Modüller">
      <BackToSettings />
      <ClientOnly>
        <ModulesSettingsList />
      </ClientOnly>
    </PageShell>
  );
}

export function BackToSettings() {
  return (
    <Link
      href="/ayarlar"
      className="text-muted-foreground hover:text-foreground -mt-3 w-fit text-sm underline underline-offset-4"
    >
      Ayarlar
    </Link>
  );
}

function ModulesSettingsList() {
  const registry = useRegistry();
  const { modules, isLoading } = useModules();
  if (isLoading) return null;

  // Every module that has code, switched on or not, then the rows that have no code.
  const entries: Entry[] = [
    ...registry.list.map((definition) => ({
      slug: definition.slug,
      name: definition.name,
      definition,
      row: modules.find(({ row }) => row.slug === definition.slug)?.row,
    })),
    ...modules
      .filter(({ definition }) => !definition)
      .map(({ row }) => ({ slug: row.slug, name: row.name, row })),
  ];

  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">Kurulu modül yok.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry) => (
        <ModuleSettingsRow key={entry.slug} entry={entry} />
      ))}
    </ul>
  );
}

function ModuleSettingsRow({ entry }: { entry: Entry }) {
  const registry = useRegistry();
  const notify = useNotify();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const { row, definition } = entry;
  const onError = () => notify(SAVE_FAILED);

  const activate = useCoreMutation({
    mutate: async (db) => {
      if (definition) return activateModule(db, registry, definition);
      return setModuleStatus(db, row!.id, "active");
    },
    onError,
  });
  const pause = useCoreMutation({
    mutate: (db) => setModuleStatus(db, row!.id, "paused"),
    onError,
  });
  const archive = useCoreMutation({
    mutate: (db) => archiveModule(db, registry, row!),
    onError,
  });

  const status = row?.status;
  return (
    <li className="border-border flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: moduleColor({ row, definition }) }}
          />
          <span className="font-medium">{entry.name}</span>
          <span className="text-muted-foreground text-sm">
            {status ? STATUS_LABEL[status] : "kapalı"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "active" ? (
            <>
              <Link
                href={`/ayarlar/moduller/${entry.slug}`}
                className="border-border hover:bg-muted flex h-11 items-center rounded-lg border px-2.5 text-sm font-medium md:h-9"
                aria-label={`${entry.name} ayarları`}
              >
                Ayarlar
              </Link>
              <Button
                variant="outline"
                className="h-11 md:h-9"
                aria-label={`${entry.name}: duraklat`}
                onClick={() => pause.mutate(undefined)}
              >
                Duraklat
              </Button>
            </>
          ) : (
            <Button
              className="h-11 md:h-9"
              aria-label={`${entry.name}: etkinleştir`}
              disabled={activate.isPending}
              onClick={() => activate.mutate(undefined)}
            >
              {status === "paused" ? "Sürdür" : "Etkinleştir"}
            </Button>
          )}
          {status === "active" || status === "paused" ? (
            <Button
              variant="ghost"
              className="h-11 md:h-9"
              aria-label={`${entry.name}: arşivle`}
              onClick={() => setConfirmArchive(true)}
            >
              Arşivle
            </Button>
          ) : null}
        </div>
      </div>

      {confirmArchive ? (
        <div
          role="alert"
          className="bg-muted/50 flex flex-wrap items-center justify-between gap-3 rounded-lg p-3"
        >
          <p className="text-sm">
            Açık işler bırakılır, ritimler ve blok serileri kapanır. Veri silinmez.
          </p>
          <div className="flex gap-2">
            <Button
              className="h-11 md:h-9"
              onClick={() => {
                archive.mutate(undefined);
                setConfirmArchive(false);
              }}
            >
              Arşivle
            </Button>
            <Button
              variant="ghost"
              className="h-11 md:h-9"
              onClick={() => setConfirmArchive(false)}
            >
              Vazgeç
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** /ayarlar/moduller/<slug>: how the module behaves per life mode, and its own settings form. */
export function ModuleSettingsScreen() {
  return (
    <ClientOnly>
      <ModuleSettingsRoute />
    </ClientOnly>
  );
}

const MODE_LABEL: Record<LifeMode, string> = {
  normal: "Normal",
  busy: "Yoğun",
  minimum: "Minimum",
  holiday: "Tatil",
};

function ModuleSettingsRoute() {
  const { slug } = useParams<{ slug: string }>();
  const { modules, isLoading } = useModules();
  const mod = modules.find(({ row }) => row.slug === slug);

  if (isLoading) return <PageShell title="Modül ayarları">{null}</PageShell>;
  if (!mod || mod.row.status === "archived") {
    return (
      <PageShell title="Modül ayarları">
        <p className="text-muted-foreground">Bu modül etkin değil.</p>
        <Link href="/ayarlar/moduller" className="w-fit underline underline-offset-4">
          Modüller
        </Link>
      </PageShell>
    );
  }
  return <ModuleSettingsBody mod={mod} />;
}

function ModuleSettingsBody({ mod }: { mod: KnownModule }) {
  const Form = mod.definition?.ui.settings;
  const behavior = mod.definition?.modeBehavior;

  return (
    <PageShell title={`${mod.row.name} ayarları`}>
      <Link
        href="/ayarlar/moduller"
        className="text-muted-foreground hover:text-foreground -mt-3 w-fit text-sm underline underline-offset-4"
      >
        Modüller
      </Link>

      <section
        aria-label="Modülün ayarları"
        className="border-border flex flex-col gap-4 rounded-xl border p-5"
      >
        <h2 className="text-sm font-medium">Modülün ayarları</h2>
        {Form ? (
          <ModuleProvider mod={mod}>
            <Form />
          </ModuleProvider>
        ) : (
          <p className="text-muted-foreground text-sm">Bu modülün kendi ayarı yok.</p>
        )}
      </section>

      {behavior ? (
        <section
          aria-label="Hayat modları"
          className="border-border flex flex-col gap-3 rounded-xl border p-5"
        >
          <h2 className="text-sm font-medium">Hayat modlarında</h2>
          <dl className="flex flex-col gap-2 text-sm">
            {(Object.keys(MODE_LABEL) as LifeMode[]).map((mode) => (
              <div key={mode} className="flex flex-wrap gap-x-3">
                <dt className="w-20 font-medium">{MODE_LABEL[mode]}</dt>
                <dd className="text-muted-foreground">
                  {behavior[mode].note ??
                    `önem ×${behavior[mode].weightMultiplier}, taban ×${behavior[mode].floorMultiplier}`}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </PageShell>
  );
}
