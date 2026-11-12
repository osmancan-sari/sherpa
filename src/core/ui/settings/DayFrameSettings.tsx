"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  checkFrame,
  DEFAULT_FRAME,
  type FrameSettings,
  readFrame,
  toStoredFrame,
} from "@/core/contract/frame";
import { useSaveDayFrame } from "@/core/app/frame-actions";
import { useSettings } from "@/core/app/hooks";
import type { DayType } from "@/core/types";
import { ClientOnly } from "../ClientOnly";
import { useNotify } from "../Notices";

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
  hours: string;
  byDayType: Record<DayType, { wake: Pair; bed: Pair }>;
  startOnWake: boolean;
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
    hours: String(source.sleepMinutes / 60).replace(".", ","),
    byDayType,
    startOnWake: source.startOnWake,
  };
}

/** The draft as a stored value to check: empty day-type ranges left out. */
function valueOf(draft: Draft): unknown {
  const byDayType: Record<string, { wake?: Pair; bed?: Pair }> = {};
  for (const { type } of DAY_TYPES) {
    const own = draft.byDayType[type];
    const entry: { wake?: Pair; bed?: Pair } = {};
    if (own.wake[0] || own.wake[1]) entry.wake = own.wake;
    if (own.bed[0] || own.bed[1]) entry.bed = own.bed;
    if (entry.wake || entry.bed) byDayType[type] = entry;
  }
  const hours = Number(draft.hours.replace(",", "."));
  return {
    wake: draft.wake,
    bed: draft.bed,
    sleep_minutes: Number.isFinite(hours) ? Math.round(hours * 60) : NaN,
    ...(Object.keys(byDayType).length > 0 ? { by_day_type: byDayType } : {}),
    ...(draft.startOnWake ? { start_on_wake: true } : {}),
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

  const pair = (value: Pair, onChange: (next: Pair) => void, label: string) => (
    <span className="flex items-center gap-1">
      <Input
        aria-label={`${label} başlangıç`}
        value={value[0]}
        placeholder="SS:dd"
        inputMode="numeric"
        className="h-11 w-20 text-center tabular-nums md:h-9"
        onChange={(event) => onChange([event.target.value, value[1]])}
      />
      –
      <Input
        aria-label={`${label} bitiş`}
        value={value[1]}
        placeholder="SS:dd"
        inputMode="numeric"
        className="h-11 w-20 text-center tabular-nums md:h-9"
        onChange={(event) => onChange([value[0], event.target.value])}
      />
    </span>
  );

  return (
    <form
      aria-label="Günün çerçevesi"
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.on && !frame) return;
        save.mutate(draft.on ? frame : null, { onSuccess: () => notify("Kaydedildi.") });
      }}
    >
      <p className="text-muted-foreground text-sm">
        Gün uyanışla başlar, yatışla biter. Planlayıcı bu aralıkların içinde bir uyanış ve yatış
        seçer; uykuyu iş yüküne feda etmez. Uygulama uyandırmaz.
      </p>
      <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-9">
        <input
          type="checkbox"
          checked={draft.on}
          onChange={(event) => setDraft({ ...draft, on: event.target.checked })}
        />
        Günün çerçevesi açık
      </label>
      {draft.on ? (
        <>
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 text-sm">
            <span>Uyanış</span>
            {pair(draft.wake, (wake) => setDraft({ ...draft, wake }), "Uyanış")}
            <span>Yatış</span>
            {pair(draft.bed, (bed) => setDraft({ ...draft, bed }), "Yatış")}
            <span>Uyku hedefi</span>
            <span className="flex items-center gap-2">
              <Input
                aria-label="Uyku hedefi (saat)"
                value={draft.hours}
                inputMode="decimal"
                className="h-11 w-20 text-center tabular-nums md:h-9"
                onChange={(event) => setDraft({ ...draft, hours: event.target.value })}
              />
              saat
            </span>
          </div>
          <details className="text-sm">
            <summary className="text-muted-foreground hover:text-foreground flex min-h-11 cursor-pointer items-center md:min-h-9">
              Gün tipine göre (isteğe bağlı)
            </summary>
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 pt-2">
              {DAY_TYPES.map(({ type, label }) => {
                const own = draft.byDayType[type];
                const set = (next: { wake: Pair; bed: Pair }) =>
                  setDraft({ ...draft, byDayType: { ...draft.byDayType, [type]: next } });
                return (
                  <div key={type} className="contents">
                    <span>{label}</span>
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="flex items-center gap-2">
                        uyanış {pair(own.wake, (wake) => set({ ...own, wake }), `${label} uyanış`)}
                      </span>
                      <span className="flex items-center gap-2">
                        yatış {pair(own.bed, (bed) => set({ ...own, bed }), `${label} yatış`)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </details>
          <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-9">
            <input
              type="checkbox"
              checked={draft.startOnWake}
              onChange={(event) => setDraft({ ...draft, startOnWake: event.target.checked })}
            />
            &quot;Uyandım&quot;dan sonra ilk rutin kendiliğinden başlasın
          </label>
        </>
      ) : null}
      {draft.on && problem ? (
        <p role="alert" className="text-sm">
          {problem}
        </p>
      ) : null}
      <div>
        <Button
          type="submit"
          variant="outline"
          className="h-11 md:h-9"
          disabled={!changed || (draft.on && !frame) || save.isPending}
        >
          Kaydet
        </Button>
      </div>
    </form>
  );
}
