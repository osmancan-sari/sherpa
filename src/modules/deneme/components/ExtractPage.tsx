"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRefreshAll } from "@/core/app/actions";
import { EmptyState } from "@/core/ui/kit";
import { useModule } from "@/core/ui/module/ModuleProvider";
import { SAVE_FAILED, useNotify } from "@/core/ui/Notices";
import { formatMinutes } from "@/lib/date";
import { EXTRACTOR, type ExtractedItem } from "../extract";
import { addItem } from "../rules";

const SAID = {
  skipped: "Yapay zeka şu an kapalı; kayıtları elle ekle.",
  failed: "Yapay zeka yanıt vermedi; kayıtları elle ekle.",
  unknown: "Bu modül şu an metin okuyamıyor.",
};

/** Sub page /m/deneme/metin: paste a list, keep the suggested records you want. */
export function ExtractPage() {
  const { ctx } = useModule();
  const notify = useNotify();
  const refreshAll = useRefreshAll();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<ExtractedItem[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const read = async () => {
    setBusy(true);
    setMessage(null);
    const result = await ctx.extract<ExtractedItem>(EXTRACTOR, text);
    setBusy(false);
    if (result.status === "ok") {
      setSuggestions(result.suggestions);
      setMessage(result.note);
    } else {
      setSuggestions(null);
      setMessage(SAID[result.status]);
    }
  };

  const keep = async (items: ExtractedItem[]) => {
    try {
      for (const item of items) {
        await addItem(ctx, { title: item.title, due_on: item.due_on, minutes: item.minutes });
      }
      setSuggestions((current) => (current ?? []).filter((item) => !items.includes(item)));
      notify(items.length === 1 ? "Kayıt eklendi." : `${items.length} kayıt eklendi.`);
    } catch {
      notify(SAVE_FAILED);
    } finally {
      await refreshAll();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Metin</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={6}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-3"
        />
      </label>
      <div>
        <Button className="h-11 md:h-9" disabled={busy || text.trim() === ""} onClick={read}>
          {busy ? "Okunuyor…" : "Oku"}
        </Button>
      </div>
      {message ? <p className="text-muted-foreground text-sm">{message}</p> : null}
      {suggestions === null ? null : suggestions.length === 0 ? (
        <EmptyState>Metinde kayıt bulunamadı.</EmptyState>
      ) : (
        <section aria-label="Öneriler" className="flex flex-col gap-3">
          <ul className="divide-border border-border divide-y rounded-xl border">
            {suggestions.map((item, index) => (
              <li key={`${item.title}-${index}`} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-muted-foreground text-sm tabular-nums">
                    {[item.due_on, item.minutes ? formatMinutes(item.minutes) : null]
                      .filter(Boolean)
                      .join(" · ") || "tarihsiz"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="h-11 md:h-9"
                  aria-label={`Ekle: ${item.title}`}
                  onClick={() => void keep([item])}
                >
                  Ekle
                </Button>
              </li>
            ))}
          </ul>
          <div>
            <Button className="h-11 md:h-9" onClick={() => void keep(suggestions)}>
              Hepsini ekle
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
