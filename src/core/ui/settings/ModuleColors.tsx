"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFacets } from "@/core/app/facets";
import { type KnownModule, keys, list, useCoreMutation } from "@/core/app/hooks";
import {
  facetColor,
  moduleColor,
  normalizeColor,
  PALETTE,
  readable,
  userFacetColors,
} from "@/core/contract/colors";
import { setFacetColor, updateModule } from "@/core/data/module-rows";
import type { ModuleRow } from "@/core/types";
import { cn } from "@/lib/utils";
import { SAVE_FAILED, useNotify } from "../Notices";

// Settings → Modules → <module>: the module's colour and each facet's (docs/05-arayuz.md,
// "Renkler ve bölümler"; Ç3e). A ready colour is saved with one touch; a colour of one's own is
// typed or picked and saved; "Varsayılana dön" takes it back to the module's own. The change
// shows at once here and reaches the other device live. "Görüşün gerek": the palette, the rows.

type Entry = {
  /** null: the module itself. */
  facet: string | null;
  name: string;
  color: string;
  /** The definition's colour; null when the module has no code (nothing to go back to). */
  initial: string | null;
};

export function ModuleColors({ mod }: { mod: KnownModule }) {
  const facets = useFacets().get(mod.row.id) ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const notify = useNotify();
  const onError = () => notify(SAVE_FAILED);

  const patchRow = (patch: Partial<ModuleRow>) => [
    { key: keys.modules, update: list.patch<ModuleRow>(mod.row.id, patch) },
  ];
  const saveModule = useCoreMutation({
    mutate: (db, color: string) => updateModule(db, mod.row.id, { color }),
    optimistic: (color) => patchRow({ color }),
    onError,
  });
  const saveFacet = useCoreMutation({
    mutate: (db, { key, color }: { key: string; color: string | null }) =>
      setFacetColor(db, mod.row.id, key, color),
    optimistic: ({ key, color }) => {
      const colors = { ...userFacetColors(mod.row) };
      if (color === null) delete colors[key];
      else colors[key] = color;
      return patchRow({ facet_colors: colors });
    },
    onError,
  });

  const entries: Entry[] = [
    {
      facet: null,
      name: mod.row.name,
      color: moduleColor(mod),
      initial: mod.definition?.color.toLowerCase() ?? null,
    },
    ...facets.map((facet) => ({
      facet: facet.key,
      name: facet.name,
      color: facetColor(mod.row, facet),
      initial: facet.color.toLowerCase(),
    })),
  ];

  const save = (entry: Entry, color: string | null) => {
    if (entry.facet === null) saveModule.mutate(color ?? entry.initial!);
    else saveFacet.mutate({ key: entry.facet, color });
  };

  return (
    <section
      aria-label="Renkler"
      className="border-border flex flex-col gap-4 rounded-xl border p-5"
    >
      <h2 className="text-sm font-medium">Renkler</h2>
      <ul className="flex flex-col gap-3">
        {entries.map((entry) => {
          const id = entry.facet ?? "";
          return (
            <ColorRow
              key={id}
              entry={entry}
              isModule={entry.facet === null}
              open={open === id}
              onToggle={() => setOpen(open === id ? null : id)}
              onSave={(color) => save(entry, color)}
            />
          );
        })}
      </ul>
    </section>
  );
}

function ColorRow({
  entry,
  isModule,
  open,
  onToggle,
  onSave,
}: {
  entry: Entry;
  isModule: boolean;
  open: boolean;
  onToggle: () => void;
  /** null: back to the default. */
  onSave: (color: string | null) => void;
}) {
  const [draft, setDraft] = useState(entry.color);
  const custom = normalizeColor(draft);
  const current = entry.color.toLowerCase();
  const changed = entry.initial !== null && current !== entry.initial;

  return (
    <li data-testid={`color-row-${entry.facet ?? "module"}`} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          data-testid="color-dot"
          className="ring-border size-4 shrink-0 rounded-full ring-1"
          style={{ backgroundColor: entry.color }}
        />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium">{entry.name}</span>
          {isModule ? <span className="text-muted-foreground text-sm"> · modül</span> : null}
        </span>
        <Button
          variant="outline"
          className="h-11 md:h-9"
          aria-expanded={open}
          aria-label={`${entry.name}: rengi değiştir`}
          onClick={onToggle}
        >
          Değiştir
        </Button>
      </div>

      {open ? (
        <div className="bg-muted/40 flex flex-col gap-3 rounded-lg p-3">
          <div
            role="group"
            aria-label={`${entry.name}: hazır renkler`}
            className="flex flex-wrap gap-2"
          >
            {PALETTE.map((color) => (
              <button
                key={color.value}
                type="button"
                aria-label={color.name}
                aria-pressed={current === color.value}
                title={color.name}
                onClick={() => {
                  setDraft(color.value);
                  onSave(color.value);
                }}
                className={cn(
                  "focus-visible:ring-ring/50 size-11 rounded-full outline-none focus-visible:ring-3 md:size-8",
                  current === color.value &&
                    "ring-foreground ring-offset-background ring-2 ring-offset-2",
                )}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (custom) onSave(custom);
            }}
          >
            <span className="text-muted-foreground text-sm">Özel</span>
            <input
              type="color"
              aria-label={`${entry.name}: renk seç`}
              value={custom ?? current}
              onChange={(event) => setDraft(event.target.value)}
              className="border-border h-11 w-14 cursor-pointer rounded-lg border bg-transparent md:h-9"
            />
            <Input
              aria-label={`${entry.name}: renk kodu`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-invalid={custom === null || undefined}
              className="h-11 w-32 font-mono md:h-9"
            />
            <Button
              type="submit"
              variant="outline"
              className="h-11 md:h-9"
              disabled={!custom || custom === current}
            >
              Kaydet
            </Button>
            {changed ? (
              <Button
                type="button"
                variant="ghost"
                className="h-11 md:h-9"
                onClick={() => {
                  setDraft(entry.initial!);
                  onSave(null);
                }}
              >
                Varsayılana dön
              </Button>
            ) : null}
          </form>
          {custom && !readable(custom) ? (
            <p role="note" className="text-muted-foreground text-sm">
              Bu renk açık ya da koyu temada zor seçilir.
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
