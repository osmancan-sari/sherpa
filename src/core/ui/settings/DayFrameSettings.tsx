"use client";

import { Stepper } from "@/core/ui/kit/Stepper";
import { FieldError } from "@/core/ui/kit/Field";
import { SwitchRow } from "@/core/ui/kit/Switch";
import { ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  checkFrame,
  DEFAULT_FRAME,
  type FrameSettings,
  readFrame,
  SLEEP_MAX,
  SLEEP_MIN,
  toStoredFrame,
} from "@/core/contract/frame";
import { useSaveDayFrame } from "@/core/app/frame-actions";
import { useSettings } from "@/core/app/hooks";
import type { DayType } from "@/core/types";
import { ClientOnly } from "../ClientOnly";
import { useNotify } from "../Notices";
import { TimeInput } from "../TimeInput";
import { normalizeClock } from "@/lib/clock-input";

// Settings → Günün çerçevesi (docs/05-arayuz.md): the waking and bedtime ranges, the sleep
// target, ranges for a type of day, and whether "Uyandım" starts the first routine. What is
// typed goes through the same schema as the stored value (src/core/contract/frame.ts).

const DAY_TYPES: { type: DayType; label: string }[] = [
  { type: "home", label: "Ev günü" },
  { type: "office", label: "Ofis günü" },
  { type: "campus", label: "Kampüs günü" },
];

type Pair = [string, string];
type Draft = {
  on: boolean;
  wake: Pair;
  bed: Pair;
  /** The sleep target in minutes, changed half an hour at a time. */
  sleepMinutes: number;
  byDayType: Record<DayType, { wake: Pair; bed: Pair }>;
  startOnWake: boolean;
  chainAuto: boolean;
};

const EMPTY: Pair = ["", ""];

function draftOf(frame: FrameSettings | null): Draft {
  const source = frame ?? DEFAULT_FRAME;
  const byDayType = {} as Draft["byDayType"];
  for (const { type } of DAY_TYPES) {
    const own = source.byDayType[type];
    byDayType[type] = { wake: own?.wake ?? EMPTY, bed: own?.bed ?? EMPTY };
  }
  return {
    on: frame !== null,
    wake: source.wake,
    bed: source.bed,
    sleepMinutes: source.sleepMinutes,
    byDayType,
    startOnWake: source.startOnWake,
    chainAuto: source.chainAuto,
  };
}

/**
 * A range as typed, as the frame stores it: "800" is 08:00 (src/lib/clock-input.ts); midnight is
 * written 00:00 in the frame, so a bedtime typed as 24:00 is kept as 00:00.
 */
const clocks = (pair: Pair): Pair =>
  pair.map((value) => {
    const clock = normalizeClock(value);
    return clock === "24:00" ? "00:00" : clock;
  }) as Pair;

/** The draft as a stored value to check: empty day-type ranges left out. */
function valueOf(draft: Draft): unknown {
  const byDayType: Record<string, { wake?: Pair; bed?: Pair }> = {};
  for (const { type } of DAY_TYPES) {
    const own = draft.byDayType[type];
    const entry: { wake?: Pair; bed?: Pair } = {};
    if (own.wake[0] || own.wake[1]) entry.wake = clocks(own.wake);
    if (own.bed[0] || own.bed[1]) entry.bed = clocks(own.bed);
    if (entry.wake || entry.bed) byDayType[type] = entry;
  }
  return {
    wake: clocks(draft.wake),
    bed: clocks(draft.bed),
    sleep_minutes: draft.sleepMinutes,
    ...(Object.keys(byDayType).length > 0 ? { by_day_type: byDayType } : {}),
    ...(draft.startOnWake ? { start_on_wake: true } : {}),
    ...(draft.chainAuto ? {} : { chain_auto: false }),
  };
}

const PROBLEM: Record<string, string> = {
  wake: "Uyanış aralığı: başlangıç bitişten önce olmalı (SS:dd).",
  bed: "Yatış aralığı: başlangıç bitişten önce olmalı; gece yarısını aşabilir (SS:dd).",
  sleep_minutes: "Uyku hedefi 4 ile 12 saat arasında olmalı.",
  by_day_type: "Gün tipine özel aralıklardan biri geçersiz.",
};

export function DayFrameSettings() {
  return (
    <ClientOnly>
      <DayFrameBody />
    </ClientOnly>
  );
}

function DayFrameBody() {
  const settings = useSettings();
  if (settings.isLoading) return null;
  // Keyed by the stored value: a change from the other screen resets the draft.
  const stored = settings.data?.day_frame ?? null;
  return <DayFrameForm key={JSON.stringify(stored)} stored={readFrame(stored)} />;
}

function DayFrameForm({ stored }: { stored: FrameSettings | null }) {
  const save = useSaveDayFrame();
  const notify = useNotify();
  const [draft, setDraft] = useState(() => draftOf(stored));
  const { frame, issues } = checkFrame(valueOf(draft));
  const problem = issues[0] ? (PROBLEM[issues[0].path[0]] ?? PROBLEM.by_day_type) : null;
  const changed =
    draft.on !== (stored !== null) ||
    (draft.on &&
      frame !== null &&
      JSON.stringify(toStoredFrame(frame)) !==
        JSON.stringify(stored ? toStoredFrame(stored) : null));

  const bad = issues[0]?.path[0] ?? null;
  const pair = (value: Pair, onChange: (next: Pair) => void, label: string, invalid = false) => (
    <span className="flex items-center gap-1.5">
      <TimeInput
        aria-label={`${label} başlangıç`}
        aria-invalid={invalid || undefined}
        value={value[0]}
        className="h-12 w-19 px-2 text-center tabular-nums"
        onChange={(next) => onChange([next, value[1]])}
      />
      <span aria-hidden>–</span>
      <TimeInput
        aria-label={`${label} bitiş`}
        aria-invalid={invalid || undefined}
        value={value[1]}
        className="h-12 w-19 px-2 text-center tabular-nums"
        onChange={(next) => onChange([value[0], next])}
      />
    </span>
  );
  /** A row of the panel (AP2, AT03): the name at the left, its control at the right. */
  const row = (label: string, control: ReactNode) => (
    <div className="min-h-row flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
      <span className="text-base">{label}</span>
      {control}
    </div>
  );

  return (
    <form
      aria-label="Günün çerçevesi"
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.on && !frame) return;
        save.mutate(draft.on ? frame : null, { onSuccess: () => notify("Kaydedildi.") });
      }}
    >
      <p className="text-note text-ink-2 pb-2">
        Gün uyanışla başlar, yatışla biter. Planlayıcı bu aralıkların içinde bir uyanış ve yatış
        seçer; uykuyu iş yüküne feda etmez. Uygulama uyandırmaz.
      </p>
      <SwitchRow
        label="Günün çerçevesi açık"
        checked={draft.on}
        onChange={(on) => setDraft({ ...draft, on })}
      />
      {draft.on ? (
        <>
          <div className="border-line-soft border-t pt-1.5">
            {row(
              "Uyanış",
              pair(draft.wake, (wake) => setDraft({ ...draft, wake }), "Uyanış", bad === "wake"),
            )}
            {bad === "wake" && problem ? <FieldError>{problem}</FieldError> : null}
            {row(
              "Yatış",
              pair(draft.bed, (bed) => setDraft({ ...draft, bed }), "Yatış", bad === "bed"),
            )}
            {bad === "bed" && problem ? <FieldError>{problem}</FieldError> : null}
            {row(
              "Uyku hedefi",
              <Stepper
                label="Uyku hedefi"
                value={draft.sleepMinutes}
                min={SLEEP_MIN}
                max={SLEEP_MAX}
                step={30}
                format={(minutes) => String(minutes / 60).replace(".", ",")}
                unit="saat"
                onChange={(sleepMinutes) => setDraft({ ...draft, sleepMinutes })}
              />,
            )}
          </div>
          <details className="group border-line-soft border-t">
            <summary className="min-h-row flex cursor-pointer list-none items-center gap-2 text-base font-semibold [&::-webkit-details-marker]:hidden">
              <ChevronRight
                aria-hidden
                className="size-4 transition-transform duration-(--motion-fast) group-open:rotate-90"
              />
              Gün tipine göre (isteğe bağlı)
            </summary>
            <div className="flex flex-col pb-2">
              {DAY_TYPES.map(({ type, label }) => {
                const own = draft.byDayType[type];
                const set = (next: { wake: Pair; bed: Pair }) =>
                  setDraft({ ...draft, byDayType: { ...draft.byDayType, [type]: next } });
                return (
                  <div key={type} className="flex flex-col gap-1 py-2">
                    <span className="text-ink-2 text-sm font-semibold">{label}</span>
                    {row(
                      "Uyanış",
                      pair(own.wake, (wake) => set({ ...own, wake }), `${label} uyanış`),
                    )}
                    {row(
                      "Yatış",
                      pair(own.bed, (bed) => set({ ...own, bed }), `${label} yatış`),
                    )}
                  </div>
                );
              })}
              {bad === "by_day_type" && problem ? <FieldError>{problem}</FieldError> : null}
            </div>
          </details>
          <SwitchRow
            className="border-line-soft border-t"
            label={'"Uyandım"dan sonra ilk rutin kendiliğinden başlasın'}
            checked={draft.startOnWake}
            onChange={(startOnWake) => setDraft({ ...draft, startOnWake })}
          />
          <SwitchRow
            className="border-line-soft border-t"
            label="Dizide sıradaki iş kendiliğinden başlasın"
            checked={draft.chainAuto}
            onChange={(chainAuto) => setDraft({ ...draft, chainAuto })}
          />
        </>
      ) : null}
      {draft.on && problem && bad !== "wake" && bad !== "bed" && bad !== "by_day_type" ? (
        <p role="alert" className="text-sm">
          {problem}
        </p>
      ) : null}
      <div className="pt-3">
        <Button
          type="submit"
          variant="primary"
          disabled={!changed || (draft.on && !frame) || save.isPending}
        >
          Kaydet
        </Button>
      </div>
    </form>
  );
}
