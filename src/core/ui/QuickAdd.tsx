"use client";

import { Plus } from "lucide-react";
import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddInboxEntry, useAddTask, useAddWorkItem, useRefreshAll } from "@/core/app/actions";
import { useDb, useRegistry } from "@/core/app/CoreProvider";
import { type KnownModule, useModules, useNow } from "@/core/app/hooks";
import type { FieldSpec, IntakeType } from "@/core/contract/types";
import { createModuleContext } from "@/core/data/context";
import { markRouted } from "@/core/data/inbox";
import { findStructuredBlocks, routeStructuredBlocks } from "@/core/intake/blocks";
import { dueAtEndOfDay, fitsOneSitting, parseQuickText } from "@/core/intake/parse";
import { TASK_DEFAULT_MINUTES, TASK_MAX_MINUTES, TASK_MIN_MINUTES } from "@/core/types";
import { cn } from "@/lib/utils";
import { Dialog } from "./Dialog";
import { SAVE_FAILED, useNotify } from "./Notices";

// Quick add: one box, two uses (docs/05-arayuz.md).
//   Structured: type, pick a module with Tab, Enter. Date and duration can be typed as short
//               words at the end of the line; a module's own entry types appear next to "İş".
//   Free:       Enter without picking anything; the text goes to the inbox.

type Preset = { moduleSlug?: string; intakeKey?: string };

const QuickAddContext = createContext<{ open: (preset?: Preset) => void } | null>(null);

export function useQuickAdd() {
  const value = useContext(QuickAddContext);
  if (!value) throw new Error("QuickAddProvider is missing above this component.");
  return value;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; preset: Preset; round: number }>({
    open: false,
    preset: {},
    round: 0,
  });

  const open = useCallback(
    (preset: Preset = {}) =>
      setState((current) => ({ open: true, preset, round: current.round + 1 })),
    [],
  );

  // "N" opens quick add from every screen. While it is open the key belongs to the dialog.
  const isOpen = state.open;
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== "n" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isOpen || isTyping(event.target)) return;
      event.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isOpen]);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      {/* Mounted on first use: nothing of the dialog exists while the page is prerendered. */}
      {state.round > 0 ? (
        <QuickAddDialog
          key={state.round}
          open={state.open}
          preset={state.preset}
          onClose={() => setState((current) => ({ ...current, open: false }))}
        />
      ) : null}
    </QuickAddContext.Provider>
  );
}

/**
 * The button that opens quick add. On the phone there is exactly one, floating above the
 * navigation bar on every screen (the app layout places it); the inline ones are for wide
 * screens only.
 */
export function QuickAddButton({ floating = false }: { floating?: boolean }) {
  const { open } = useQuickAdd();
  if (floating) {
    return (
      <button
        type="button"
        onClick={() => open()}
        aria-label="Yeni giriş"
        className="bg-primary text-primary-foreground focus-visible:ring-ring/50 fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full shadow-lg outline-none focus-visible:ring-3 md:hidden"
      >
        <Plus aria-hidden className="size-6" />
      </button>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      className="hidden h-9 gap-2 md:inline-flex"
      onClick={() => open()}
    >
      <Plus aria-hidden />
      Yeni giriş
      <kbd className="text-muted-foreground hidden font-mono text-xs md:inline">N</kbd>
    </Button>
  );
}

const TASK = "task";

function QuickAddDialog({
  open,
  preset,
  onClose,
}: {
  open: boolean;
  preset: Preset;
  onClose: () => void;
}) {
  const db = useDb();
  const registry = useRegistry();
  const now = useNow();
  const notify = useNotify();
  const refreshAll = useRefreshAll();
  const { modules } = useModules();
  const active = useMemo(() => modules.filter(({ row }) => row.status === "active"), [modules]);

  const addTask = useAddTask();
  const addWorkItem = useAddWorkItem();
  const addInboxEntry = useAddInboxEntry();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [moduleSlug, setModuleSlug] = useState<string | null>(preset.moduleSlug ?? null);
  const [typeKey, setTypeKey] = useState<string>(preset.intakeKey ?? TASK);
  const [dayOverride, setDayOverride] = useState<string | null>(null);
  const [minutesOverride, setMinutesOverride] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [overLimit, setOverLimit] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected: KnownModule | undefined = active.find(({ row }) => row.slug === moduleSlug);
  const intakeTypes: IntakeType[] = selected?.definition?.intake ?? [];
  const intake = intakeTypes.find((type) => type.key === typeKey);

  const parsed = useMemo(() => parseQuickText(text, now), [text, now]);
  const dueDay = dayOverride ?? parsed.dueDay ?? "";
  const minutesText = minutesOverride ?? String(parsed.minutes ?? TASK_DEFAULT_MINUTES);
  const minutes = Number(minutesText);

  const selectModule = (slug: string | null) => {
    setModuleSlug(slug);
    setTypeKey(TASK);
    setOverLimit(false);
  };

  /** Tab walks through the modules: none, first, second, …, none. */
  const cycleModule = (step: 1 | -1) => {
    const slugs: (string | null)[] = [null, ...active.map(({ row }) => row.slug)];
    const index = slugs.indexOf(moduleSlug);
    selectModule(slugs[(index + step + slugs.length) % slugs.length]);
  };

  const onInputKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter saves; a pasted block keeps its own line breaks, and Shift+Enter adds one by hand.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    } else if (event.key === "Tab" && active.length > 0) {
      event.preventDefault();
      cycleModule(event.shiftKey ? -1 : 1);
    } else if (event.key === "ArrowDown" && !text.includes("\n")) {
      const next = detailsRef.current?.querySelector<HTMLElement>("button, input, select");
      if (next) {
        event.preventDefault();
        next.focus();
      }
    }
  };

  const done = (message: string) => {
    notify(message);
    onClose();
  };

  /** A pasted structured block goes straight to the module that knows it. */
  async function routeBlocks(): Promise<boolean> {
    const { routed } = routeStructuredBlocks(findStructuredBlocks(text), registry.list);
    if (routed.length === 0) return false;
    const handled: { type: string; module: string }[] = [];
    for (const route of routed) {
      const row = active.find((mod) => mod.row.slug === route.module.slug)?.row;
      if (!row) continue;
      await route.handler.handle(
        route.block.payload,
        createModuleContext({ db, registry, module: row }),
      );
      handled.push({ type: `block:${route.handler.key}`, module: row.slug });
    }
    if (handled.length === 0) return false;
    const entry = await addInboxEntry.mutateAsync({ id: crypto.randomUUID(), text });
    await markRouted(db, entry.id, handled);
    await refreshAll();
    const names = [...new Set(handled.map((item) => registry.get(item.module)?.name))];
    done(`${names.join(", ")} modülüne işlendi.`);
    return true;
  }

  async function submit(asWorkItem = false) {
    if (busy) return;
    setBusy(true);
    try {
      if (await routeBlocks()) return;

      // Free use: nothing picked, the text goes to the inbox as it is.
      if (!selected) {
        if (!text.trim()) return;
        addInboxEntry.mutate({ id: crypto.randomUUID(), text });
        done("Gelen kutusuna eklendi.");
        return;
      }

      // One of the module's own entry types.
      if (intake) {
        const values: Record<string, unknown> = {};
        intake.fields.forEach((field, index) => {
          const raw =
            fieldValues[field.name] ??
            (index === 0 && field.type === "text" ? parsed.title : String(field.default ?? ""));
          if (raw === "") return;
          values[field.name] = field.type === "number" ? Number(raw) : raw;
        });
        await intake.handle(values, createModuleContext({ db, registry, module: selected.row }));
        await refreshAll();
        done("Kaydedildi.");
        return;
      }

      // A task of the chosen module.
      const title = parsed.title.trim();
      if (!title) return;
      const due_at = dueDay ? dueAtEndOfDay(dueDay) : null;

      if (!fitsOneSitting(minutes) && !asWorkItem) {
        // Longer than one sitting: it cannot be a task. Offer the work item instead.
        setOverLimit(true);
        return;
      }
      if (asWorkItem) {
        await addWorkItem.mutateAsync({
          module_id: selected.row.id,
          title,
          due_at,
          effort_total_minutes: minutes,
        });
        done("İş kalemi olarak eklendi.");
        return;
      }
      addTask.mutate({
        id: crypto.randomUUID(),
        module_id: selected.row.id,
        title,
        due_at,
        est_minutes: Math.max(TASK_MIN_MINUTES, minutes || TASK_DEFAULT_MINUTES),
      });
      done("Eklendi.");
    } catch {
      notify(SAVE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  const missingRequired =
    intake?.fields.some((field, index) => {
      if (!field.required) return false;
      const value =
        fieldValues[field.name] ??
        (index === 0 && field.type === "text" ? parsed.title : String(field.default ?? ""));
      return value.trim() === "";
    }) ?? false;
  const canSubmit = intake ? !missingRequired : text.trim() !== "";

  const submitLabel = !selected ? "Gelen kutusuna ekle" : intake ? "Kaydet" : "Ekle";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Yeni giriş"
      initialFocus={inputRef}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(overLimit);
        }}
      >
        {/* A text area, one line tall until it needs more: a pasted block keeps its lines. */}
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOverLimit(false);
          }}
          onKeyDown={onInputKey}
          aria-label="Giriş"
          placeholder="Sunum slaytları cuma 45dk"
          autoComplete="off"
          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 field-sizing-content max-h-48 min-h-12 w-full resize-none rounded-lg border bg-transparent px-3 py-3 text-base outline-none focus-visible:ring-3"
        />

        <div ref={detailsRef} className="flex flex-col gap-4">
          {active.length > 0 ? (
            <div role="group" aria-label="Modül" className="flex flex-wrap gap-2">
              {active.map(({ row }) => (
                <Chip
                  key={row.id}
                  pressed={row.slug === moduleSlug}
                  color={row.color}
                  onClick={() => selectModule(row.slug === moduleSlug ? null : row.slug)}
                >
                  {row.name}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Etkin modül yok; giriş gelen kutusuna düşer. Modüller Ayarlar’dan açılır.
            </p>
          )}

          {selected && intakeTypes.length > 0 ? (
            <div role="group" aria-label="Kayıt türü" className="flex flex-wrap gap-2">
              <Chip pressed={typeKey === TASK} onClick={() => setTypeKey(TASK)}>
                İş
              </Chip>
              {intakeTypes.map((type) => (
                <Chip
                  key={type.key}
                  pressed={typeKey === type.key}
                  onClick={() => {
                    setTypeKey(type.key);
                    setOverLimit(false);
                  }}
                >
                  {type.label}
                </Chip>
              ))}
            </div>
          ) : null}

          {selected && !intake ? (
            <div className="flex flex-wrap gap-4">
              <Field label="Tarih">
                <Input
                  type="date"
                  value={dueDay}
                  onChange={(event) => setDayOverride(event.target.value)}
                  className="h-11 w-44 md:h-9"
                />
              </Field>
              <Field label="Süre (dk)">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={TASK_MIN_MINUTES}
                  step={5}
                  value={minutesText}
                  onChange={(event) => {
                    setMinutesOverride(event.target.value);
                    setOverLimit(false);
                  }}
                  className="h-11 w-28 md:h-9"
                />
              </Field>
            </div>
          ) : null}

          {selected && intake ? (
            <IntakeFields
              fields={intake.fields}
              values={fieldValues}
              fallbackText={parsed.title}
              onChange={(name, value) =>
                setFieldValues((current) => ({ ...current, [name]: value }))
              }
            />
          ) : null}
        </div>

        {overLimit ? (
          <div
            role="alert"
            className="border-border bg-muted/50 flex flex-col gap-3 rounded-xl border p-4"
          >
            <p className="text-sm">
              {TASK_MAX_MINUTES} dakikadan uzun iş tek oturuma sığmaz. İş kalemi olarak kaydedilirse
              toplam efor {minutes} dk olur ve oturumlara bölünür.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="h-11 md:h-9" disabled={busy}>
                İş kalemi olarak kaydet
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 md:h-9"
                onClick={() => {
                  setMinutesOverride(String(TASK_MAX_MINUTES));
                  setOverLimit(false);
                }}
              >
                Süreyi {TASK_MAX_MINUTES} dk yap
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground hidden text-xs md:block">
              Tab: modül · Enter: kaydet · Modül seçmeden Enter: gelen kutusu
            </p>
            <Button type="submit" className="h-11 md:h-9" disabled={!canSubmit || busy}>
              {submitLabel}
            </Button>
          </div>
        )}
      </form>
    </Dialog>
  );
}

function Chip({
  pressed,
  color,
  onClick,
  children,
}: {
  pressed: boolean;
  color?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "border-border focus-visible:ring-ring/50 flex h-11 items-center gap-2 rounded-full border px-4 text-sm outline-none focus-visible:ring-3 md:h-9 md:px-3",
        pressed ? "bg-foreground text-background border-transparent" : "hover:bg-muted",
      )}
    >
      {color ? (
        <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color }} />
      ) : null}
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** The form of a module's entry type, drawn from its field list. */
export function IntakeFields({
  fields,
  values,
  fallbackText = "",
  onChange,
}: {
  fields: FieldSpec[];
  values: Record<string, string>;
  /** What was typed into the quick add box; fills the first text field until it is edited. */
  fallbackText?: string;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4">
      {fields.map((field, index) => {
        const value =
          values[field.name] ??
          (index === 0 && field.type === "text" ? fallbackText : String(field.default ?? ""));
        const label = field.required ? field.label : `${field.label} (isteğe bağlı)`;
        if (field.type === "select") {
          return (
            <Field key={field.name} label={label}>
              <select
                // Named on its own: inside a label a select would also read out its value.
                aria-label={label}
                value={value}
                onChange={(event) => onChange(field.name, event.target.value)}
                className="border-input bg-background h-11 rounded-lg border px-3 text-sm md:h-9"
              >
                {!field.required ? <option value="">—</option> : null}
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          );
        }
        return (
          <Field key={field.name} label={label}>
            <Input
              type={field.type}
              inputMode={field.type === "number" ? "numeric" : undefined}
              min={field.min}
              max={field.max}
              value={value}
              onChange={(event) => onChange(field.name, event.target.value)}
              className={cn("h-11 md:h-9", field.type === "text" ? "w-64" : "w-40")}
            />
          </Field>
        );
      })}
    </div>
  );
}
