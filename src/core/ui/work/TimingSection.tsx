"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  checkTiming,
  daysLabel,
  normalizeTiming,
  outsideDay,
  readTiming,
  type TimeWindow,
  type Timing,
  type TimingForm,
  type TimingIssue,
  timingSummary,
} from "@/core/contract/timing";

// The "Zaman" section of the work forms (docs/05-arayuz.md, "Zaman kısıtları"): windows,
// preferred and avoided hours, travel and, for a rhythm, rest days. Closed by default; closed,
// it shows the constraint in one line. What is typed here goes through the envelope's schema.

type ListName = "windows" | "prefer" | "avoid";
type DraftRange = { days: string; from: string; to: string };
export type TimingDraft = Record<ListName, DraftRange[]> & {
  before: string;
  after: string;
  rest: string;
};

const LISTS: { name: ListName; label: string }[] = [
  { name: "windows", label: "Yalnızca şu saatlerde" },
  { name: "prefer", label: "Tercih edilen saatler" },
  { name: "avoid", label: "Kaçınılan saatler" },
];

const DAY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Her gün" },
  { value: "1,2,3,4,5", label: "Hafta içi" },
  { value: "6,7", label: "Hafta sonu" },
  { value: "1", label: "Pazartesi" },
  { value: "2", label: "Salı" },
  { value: "3", label: "Çarşamba" },
  { value: "4", label: "Perşembe" },
  { value: "5", label: "Cuma" },
  { value: "6", label: "Cumartesi" },
  { value: "7", label: "Pazar" },
];

const daysKey = (days: number[] | undefined) =>
  !days || days.length === 7 ? "all" : [...days].sort((a, b) => a - b).join(",");

export function draftOf(timing: Timing | null): TimingDraft {
  const ranges = (list: TimeWindow[] | undefined) =>
    (list ?? []).map((range) => ({ days: daysKey(range.days), from: range.from, to: range.to }));
  return {
    windows: ranges(timing?.windows),
    prefer: ranges(timing?.prefer),
    avoid: ranges(timing?.avoid),
    before: timing?.travel?.before ? String(timing.travel.before) : "",
    after: timing?.travel?.after ? String(timing.travel.after) : "",
    rest: timing?.rest_days ? String(timing.rest_days) : "",
  };
}

/** The draft as a timing value to check: empty fields left out, numbers as typed. */
export function valueOf(draft: TimingDraft): unknown {
  const list = (ranges: DraftRange[]) =>
    ranges.length === 0
      ? undefined
      : ranges.map((range) => ({
          ...(range.days === "all" ? {} : { days: range.days.split(",").map(Number) }),
          from: range.from,
          to: range.to,
        }));
  const number = (text: string) => (text.trim() === "" ? undefined : Number(text));
  const before = number(draft.before);
  const after = number(draft.after);
  return {
    windows: list(draft.windows),
    prefer: list(draft.prefer),
    avoid: list(draft.avoid),
    travel:
      before === undefined && after === undefined
        ? undefined
        : {
            ...(before !== undefined ? { before } : {}),
            ...(after !== undefined ? { after } : {}),
          },
    rest_days: number(draft.rest),
  };
}

/** The value without its empty parts, for the "did it change" test. */
export const cleanValue = (value: unknown) =>
  JSON.parse(JSON.stringify(value ?? null)) as Timing | null;

/** Whether the checked value differs from what is stored (key order aside). */
export function timingChanged(stored: unknown, next: Timing | null): boolean {
  const canonical = (timing: Timing | null) => JSON.stringify(sortKeys(normalizeTiming(timing)));
  return canonical(readTiming(stored)) !== canonical(next);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((key) => [key, sortKeys(source[key])]),
    );
  }
  return value;
}

/** The section's state: the draft, the checked value, and whether it may be and should be saved. */
export function useTimingDraft(stored: unknown) {
  const [draft, setDraft] = useState(() => draftOf(readTiming(stored)));
  const check = (form: TimingForm) => {
    const { timing, issues } = checkTiming(cleanValue(valueOf(draft)), form);
    return {
      timing,
      issues,
      valid: issues.length === 0,
      changed: issues.length === 0 && timingChanged(stored, timing),
    };
  };
  return { draft, setDraft, check };
}

/** One plain sentence for the first problem of an entry. */
export function issueText(issue: TimingIssue): string {
  switch (issue.reason) {
    case "order":
      return "Bitiş saati başlangıçtan sonra olmalı.";
    case "clock":
      return "Saatleri SS:dd biçiminde yaz.";
    case "too_many":
      return "Bir listede en çok 14 aralık olabilir.";
    case "travel":
      return "Yol süresi 0 ile 180 dakika arasında olmalı.";
    case "rest_days":
      return "Dinlenme 1 ile 26 gün arasında olmalı.";
    case "rest_fit":
      return "Bu kadar dinlenme günüyle hedef döneme sığmıyor.";
    case "not_used":
      return "Günlük ritimde dinlenme günü olmaz.";
    default:
      return "Aralıklardan biri geçersiz.";
  }
}

export function TimingSection({
  draft,
  onChange,
  form,
  issues,
  timing,
  dayStart,
  finishLine,
  inherited,
  note,
}: {
  draft: TimingDraft;
  onChange: (draft: TimingDraft) => void;
  form: TimingForm;
  issues: TimingIssue[];
  /** The checked value (null when empty or invalid). */
  timing: Timing | null;
  dayStart: string;
  finishLine: string;
  /** A sitting without its own: the item's constraint, which then holds. */
  inherited?: Timing | null;
  /** Where the stored value came from ("Modülün ayarından"), or the AI's reason. */
  note?: string | null;
}) {
  const setList = (name: ListName, ranges: DraftRange[]) => onChange({ ...draft, [name]: ranges });
  const empty =
    draft.windows.length + draft.prefer.length + draft.avoid.length === 0 &&
    !draft.before &&
    !draft.after &&
    !draft.rest;
  const summary = timing
    ? timingSummary(timing)
    : empty && inherited !== undefined
      ? `kalemin saatleri geçerli${inherited ? `: ${timingSummary(inherited)}` : ""}`
      : "";
  const rhythm = form.kind === "recurrence";

  return (
    <details className="border-border w-full rounded-lg border px-3 py-2 text-sm">
      <summary className="cursor-pointer select-none">
        <span className="font-medium">Zaman</span>
        {summary ? (
          <span className="text-muted-foreground" data-testid="timing-summary">
            {" "}
            · {summary}
          </span>
        ) : null}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {note ? <p className="text-muted-foreground text-xs">{note}</p> : null}
        {LISTS.map((list) => (
          <fieldset key={list.name} className="flex flex-col gap-2">
            <legend className="text-muted-foreground mb-1">{list.label}</legend>
            {draft[list.name].map((range, index) => {
              const name = `${list.label} ${index + 1}`;
              const update = (patch: Partial<DraftRange>) =>
                setList(
                  list.name,
                  draft[list.name].map((row, at) => (at === index ? { ...row, ...patch } : row)),
                );
              const known = DAY_OPTIONS.some((option) => option.value === range.days);
              return (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`${name}: günler`}
                    value={range.days}
                    onChange={(event) => update({ days: event.target.value })}
                    className="border-input bg-background h-11 rounded-lg border px-2 md:h-9"
                  >
                    {known ? null : (
                      <option value={range.days}>
                        {daysLabel(range.days.split(",").map(Number))}
                      </option>
                    )}
                    {DAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="SS:dd"
                    aria-label={`${name}: başlangıç`}
                    value={range.from}
                    onChange={(event) => update({ from: event.target.value })}
                    className="h-11 w-24 md:h-9"
                  />
                  <span aria-hidden>–</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="SS:dd"
                    aria-label={`${name}: bitiş`}
                    value={range.to}
                    onChange={(event) => update({ to: event.target.value })}
                    className="h-11 w-24 md:h-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="size-11 md:size-9"
                    aria-label={`${name}: kaldır`}
                    onClick={() =>
                      setList(
                        list.name,
                        draft[list.name].filter((_, at) => at !== index),
                      )
                    }
                  >
                    <X aria-hidden />
                  </Button>
                </div>
              );
            })}
            <div>
              <Button
                type="button"
                variant="outline"
                className="h-11 md:h-9"
                aria-label={`${list.label}: aralık ekle`}
                onClick={() =>
                  setList(list.name, [
                    ...draft[list.name],
                    { days: "all", from: "09:00", to: "17:00" },
                  ])
                }
              >
                + aralık ekle
              </Button>
            </div>
          </fieldset>
        ))}
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="text-muted-foreground mb-1">Yol</legend>
          <span>gidiş</span>
          <Input
            inputMode="numeric"
            aria-label="Yol: gidiş (dk)"
            value={draft.before}
            onChange={(event) =>
              onChange({ ...draft, before: event.target.value.replace(/\D/g, "") })
            }
            className="h-11 w-20 md:h-9"
          />
          <span>dk</span>
          <span className="ml-2">dönüş</span>
          <Input
            inputMode="numeric"
            aria-label="Yol: dönüş (dk)"
            value={draft.after}
            onChange={(event) =>
              onChange({ ...draft, after: event.target.value.replace(/\D/g, "") })
            }
            className="h-11 w-20 md:h-9"
          />
          <span>dk</span>
        </fieldset>
        {rhythm ? (
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="text-muted-foreground mb-1">Dinlenme</legend>
            <span>iki yapılış arasında en az</span>
            <Input
              inputMode="numeric"
              aria-label="Dinlenme (gün)"
              value={draft.rest}
              onChange={(event) =>
                onChange({ ...draft, rest: event.target.value.replace(/\D/g, "") })
              }
              className="h-11 w-16 md:h-9"
            />
            <span>gün</span>
          </fieldset>
        ) : null}
        {issues.length > 0 ? (
          <p role="alert" className="health-behind">
            {issueText(issues[0])}
          </p>
        ) : null}
        {outsideDay(timing, dayStart, finishLine) ? (
          <p className="health-attention">
            Bu saatler bitiş çizgisinden ({finishLine}) sonra; planlayıcı bu işi yerleştiremez.
          </p>
        ) : null}
      </div>
    </details>
  );
}
