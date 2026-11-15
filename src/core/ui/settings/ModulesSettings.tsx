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
import type { ModuleRow } from "@/core/types";
import { ClientOnly } from "../ClientOnly";
import { ModuleProvider } from "../module/ModuleProvider";
import { SAVE_FAILED, useNotify } from "../Notices";
import { Panel } from "../kit/Panel";
import { SettingsSection } from "./SettingsShell";
import { ModuleColors } from "./ModuleColors";

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
    <SettingsSection title="Modüller">
      <ClientOnly>
        <ModulesSettingsList />
      </ClientOnly>
    </SettingsSection>
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
    <ul className="flex flex-col">
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
    <li className="border-line flex flex-col gap-3 border-b py-3.5 last:border-b-0">
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
                className="border-border hover:bg-muted flex h-11 items-center rounded-lg border px-2.5 text-sm font-medium"
                aria-label={`${entry.name} ayarları`}
              >
                Ayarlar
              </Link>
              <Button
                variant="outline"
                className="h-11"
                aria-label={`${entry.name}: duraklat`}
                onClick={() => pause.mutate(undefined)}
              >
                Duraklat
              </Button>
            </>
          ) : (
            <Button
              className="h-11"
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
              className="h-11"
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
              className="h-11"
              onClick={() => {
                archive.mutate(undefined);
                setConfirmArchive(false);
              }}
            >
              Arşivle
            </Button>
            <Button variant="ghost" className="h-11" onClick={() => setConfirmArchive(false)}>
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

function ModuleSettingsRoute() {
  const { slug } = useParams<{ slug: string }>();
  const { modules, isLoading } = useModules();
  const mod = modules.find(({ row }) => row.slug === slug);

  if (isLoading) return null;
  if (!mod || mod.row.status === "archived") {
    return (
      <SettingsSection title="Modül ayarları" back="/ayarlar/moduller">
        <p className="text-base">Bu modül etkin değil.</p>
        <Link
          href="/ayarlar/moduller"
          className="link-quiet min-h-touch inline-flex w-fit items-center font-semibold"
        >
          Modüller
        </Link>
      </SettingsSection>
    );
  }
  return <ModuleSettingsBody mod={mod} />;
}

function ModuleSettingsBody({ mod }: { mod: KnownModule }) {
  const Form = mod.definition?.ui.settings;

  return (
    <SettingsSection title={`${mod.row.name} ayarları`} back="/ayarlar/moduller" bare>
      {/* Ç3e: the module's colour and its facets' (docs/05, "Renkler ve bölümler"). */}
      <ModuleColors mod={mod} />

      <Panel variant="dense" label="Modülün ayarları" className="gap-4 pb-4">
        <div className="flex flex-col gap-4 px-4 md:px-4.5">
          {Form ? (
            <ModuleProvider mod={mod}>
              <Form />
            </ModuleProvider>
          ) : (
            <p className="text-ink-2 text-note">Bu modülün kendi ayarı yok.</p>
          )}
        </div>
      </Panel>
    </SettingsSection>
  );
}
