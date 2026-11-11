"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";
import { readSuggestion } from "@/core/ai/flows/enrich-apply";
import { useConfirmSuggestion, useDismissEntry, useRouteEntry } from "@/core/app/actions";
import { type KnownModule, useInbox, useModules, useNow } from "@/core/app/hooks";
import { dueAtEndOfDay, parseQuickText } from "@/core/intake/parse";
import {
  type InboxEntry,
  TASK_DEFAULT_MINUTES,
  TASK_MAX_MINUTES,
  TASK_MIN_MINUTES,
} from "@/core/types";
import { dayKey, formatDue, formatMinutes, istanbulInstant } from "@/lib/date";
import { cn } from "@/lib/utils";
import { ClientOnly } from "../ClientOnly";
import { EmptyState, PageShell } from "../PageShell";
import { QuickAddButton } from "../QuickAdd";
import { useNotify } from "../Notices";
import { LoadFailed } from "../today/TodayScreen";

// Inbox: entries that have not been routed yet. An entry the AI read but was not sure about
// shows its suggestion: one touch confirms it (the module can be changed first). Every entry can
// also be routed by hand: one touch to open "işe çevir" or "bloğa çevir", one to confirm; or
// "sil".

export function InboxScreen() {
  return (
    <PageShell title="Gelen kutusu">
      <ClientOnly>
        <InboxBody />
      </ClientOnly>
    </PageShell>
  );
}

function InboxBody() {
  const inbox = useInbox();
  const { modules } = useModules();
  const active = modules.filter(({ row }) => row.status === "active");
  const entries = inbox.data ?? [];

  return (
    <>
      {inbox.isError && inbox.data === undefined ? (
        <LoadFailed onRetry={() => void inbox.refetch()} />
      ) : inbox.isLoading ? null : entries.length === 0 ? (
        <EmptyState>Gelen kutusu boş.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} modules={active} />
          ))}
        </ul>
      )}
      <div>
        <QuickAddButton />
      </div>
    </>
  );
}

type Mode = "idle" | "task" | "block";

function EntryRow({ entry, modules }: { entry: InboxEntry; modules: KnownModule[] }) {
  const now = useNow();
  const dismiss = useDismissEntry();
  const route = useRouteEntry();
  const [mode, setMode] = useState<Mode>("idle");

  const parsed = useMemo(() => parseQuickText(entry.raw_text, now), [entry.raw_text, now]);
  const [moduleSlug, setModuleSlug] = useState<string | null>(null);
  const [day, setDay] = useState(parsed.dueDay ?? "");
  const [minutes, setMinutes] = useState(String(parsed.minutes ?? TASK_DEFAULT_MINUTES));
  const [blockDay, setBlockDay] = useState(parsed.dueDay ?? dayKey(now));
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");

  const chosen =
    modules.find(({ row }) => row.slug === moduleSlug) ??
    (modules.length === 1 ? modules[0] : undefined);
  const minutesValue = Number(minutes);
  // Longer than one sitting: it cannot be a task; it is saved as a work item instead.
  const overLimit = minutesValue > TASK_MAX_MINUTES;
  const taskReady = chosen !== undefined && minutesValue >= TASK_MIN_MINUTES;
  const blockReady = blockDay !== "" && endTime > startTime;

  const toTask = () => {
    if (!chosen || !taskReady) return;
    if (overLimit) {
      route.mutate({
        entryId: entry.id,
        module: chosen.row.slug,
        workItem: {
          module_id: chosen.row.id,
          title: parsed.title,
          effort_total_minutes: minutesValue,
          due_at: day ? dueAtEndOfDay(day) : null,
        },
      });
      return;
    }
    route.mutate({
      entryId: entry.id,
      module: chosen.row.slug,
      task: {
        id: crypto.randomUUID(),
        module_id: chosen.row.id,
        title: parsed.title,
        est_minutes: minutesValue,
        due_at: day ? dueAtEndOfDay(day) : null,
      },
    });
  };

  const toBlock = () => {
    if (!blockReady) return;
    route.mutate({
      entryId: entry.id,
      block: {
        id: crypto.randomUUID(),
        title: parsed.title,
        starts_at: istanbulInstant(blockDay, startTime).toISOString(),
        ends_at: istanbulInstant(blockDay, endTime).toISOString(),
      },
    });
  };

  return (
    <li className="border-border flex flex-col gap-3 rounded-xl border p-4">
      <p className="break-words whitespace-pre-wrap">{entry.raw_text}</p>

      {mode === "idle" && entry.status === "needs_confirm" ? (
        <SuggestionCard entry={entry} modules={modules} />
      ) : null}

      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 md:h-9" onClick={() => setMode("task")}>
            İşe çevir
          </Button>
          <Button variant="outline" className="h-11 md:h-9" onClick={() => setMode("block")}>
            Bloğa çevir
          </Button>
          <Button
            variant="ghost"
            className="h-11 md:h-9"
            onClick={() => dismiss.mutate(entry.id)}
            aria-label={`Sil: ${entry.raw_text}`}
          >
            Sil
          </Button>
        </div>
      ) : null}

      {mode === "task" ? (
        <div className="flex flex-col gap-3">
          {modules.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              İşin bir modülü olmalı.{" "}
              <Link href="/ayarlar/moduller" className="underline underline-offset-4">
                Modüller Ayarlar’dan açılır.
              </Link>
            </p>
          ) : (
            <div role="group" aria-label="Modül" className="flex flex-wrap gap-2">
              {modules.map(({ row }) => (
                <button
                  key={row.id}
                  type="button"
                  aria-pressed={chosen?.row.id === row.id}
                  onClick={() => setModuleSlug(row.slug)}
                  className={cn(
                    "border-border focus-visible:ring-ring/50 flex h-11 items-center gap-2 rounded-full border px-4 text-sm outline-none focus-visible:ring-3 md:h-9 md:px-3",
                    chosen?.row.id === row.id
                      ? "bg-foreground text-background border-transparent"
                      : "hover:bg-muted",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  {row.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <Labelled label="Tarih">
              <Input
                type="date"
                value={day}
                onChange={(event) => setDay(event.target.value)}
                className="h-11 w-44 md:h-9"
              />
            </Labelled>
            <Labelled label="Süre (dk)">
              <Input
                type="number"
                inputMode="numeric"
                min={TASK_MIN_MINUTES}
                step={5}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                className="h-11 w-28 md:h-9"
              />
            </Labelled>
            <Button className="h-11 md:h-9" disabled={!taskReady} onClick={toTask}>
              {overLimit ? "İş kalemi olarak kaydet" : "Kaydet"}
            </Button>
            <Button variant="ghost" className="h-11 md:h-9" onClick={() => setMode("idle")}>
              Vazgeç
            </Button>
          </div>
          {overLimit ? (
            <p role="note" className="text-muted-foreground text-sm">
              {TASK_MAX_MINUTES} dakikadan uzun iş tek oturuma sığmaz; iş kalemi olarak kaydedilir
              ve oturumlara bölünür.
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "block" ? (
        <div className="flex flex-wrap items-end gap-3">
          <Labelled label="Gün">
            <Input
              type="date"
              value={blockDay}
              onChange={(event) => setBlockDay(event.target.value)}
              className="h-11 w-44 md:h-9"
            />
          </Labelled>
          <Labelled label="Başlangıç">
            <Input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="h-11 w-32 md:h-9"
            />
          </Labelled>
          <Labelled label="Bitiş">
            <Input
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              className="h-11 w-32 md:h-9"
            />
          </Labelled>
          <Button className="h-11 md:h-9" disabled={!blockReady} onClick={toBlock}>
            Kaydet
          </Button>
          <Button variant="ghost" className="h-11 md:h-9" onClick={() => setMode("idle")}>
            Vazgeç
          </Button>
        </div>
      ) : null}
    </li>
  );
}

const IMPORTANCE = ["", "düşük önem", "normal önem", "yüksek önem", "çok yüksek önem"];

/** The AI's reading of the entry, to confirm with one tap. */
function SuggestionCard({ entry, modules }: { entry: InboxEntry; modules: KnownModule[] }) {
  const now = useNow();
  const confirm = useConfirmSuggestion();
  const notify = useNotify();
  const suggestion = readSuggestion(entry);
  const aiSlug = suggestion?.output.module.value ?? null;
  const [slug, setSlug] = useState<string | null>(
    modules.some(({ row }) => row.slug === aiSlug) ? aiSlug : null,
  );
  if (!suggestion) return null;

  const { output, parsed } = suggestion;
  const minutes = parsed.minutes ?? output.est_minutes.value;
  const asItem = output.target.value === "work_item" || (minutes ?? 0) > TASK_MAX_MINUTES;
  const day = parsed.dueDay ?? output.due.value;
  const parts = [
    asItem ? "iş kalemi" : "iş",
    minutes ? formatMinutes(minutes) : null,
    day ? formatDue(dueAtEndOfDay(day), now) : null,
    output.importance.value ? IMPORTANCE[output.importance.value] : null,
  ].filter(Boolean);
  const chosen = modules.find(({ row }) => row.slug === slug);
  const reason = output.module.reason || output.target.reason;

  return (
    <div className="bg-muted/40 flex flex-col gap-3 rounded-lg p-3">
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-sm">
          <Sparkles aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
          <span>
            <span className="text-muted-foreground">Öneri:</span> {parts.join(" · ")}
          </span>
        </p>
        {reason ? <p className="text-muted-foreground text-sm">{reason}</p> : null}
      </div>
      {modules.length > 0 ? (
        <div role="group" aria-label="Önerilen modül" className="flex flex-wrap gap-2">
          {modules.map(({ row }) => (
            <button
              key={row.id}
              type="button"
              aria-pressed={slug === row.slug}
              onClick={() => setSlug(row.slug)}
              className={cn(
                "border-border focus-visible:ring-ring/50 flex h-11 items-center gap-2 rounded-full border px-4 text-sm outline-none focus-visible:ring-3 md:h-9 md:px-3",
                slug === row.slug
                  ? "bg-foreground text-background border-transparent"
                  : "hover:bg-muted",
              )}
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              {row.name}
            </button>
          ))}
        </div>
      ) : null}
      <div>
        <Button
          className="h-11 md:h-9"
          disabled={!chosen || confirm.isPending}
          onClick={() => {
            if (!chosen) return;
            // On the promise, not on mutate's callbacks: the card leaves the list at once
            // (optimistic) and its callbacks would never run.
            void confirm
              .mutateAsync({ entry, module: chosen.row })
              .then((outcome) => {
                if (outcome.status === "applied") {
                  notify(outcome.target === "task" ? "İş eklendi." : "İş kalemi eklendi.");
                }
              })
              .catch(() => {
                // The failure notice comes from the mutation itself.
              });
          }}
        >
          Onayla
        </Button>
      </div>
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
