"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCorrectDay } from "@/core/app/frame-actions";
import { useTodayPlan } from "@/core/app/hooks";
import { bedInstant } from "@/core/planner";
import type { DayRow } from "@/core/types";
import { formatDayLabel, formatTime, istanbulInstant, shiftDay } from "@/lib/date";
import { normalizeClock } from "@/lib/clock-input";
import { ClientOnly } from "../ClientOnly";
import { TimeInput } from "../TimeInput";

// Ç3g: Ayarlar → Günün çerçevesi → "Uyanış ve yatış kayıtları" (docs/05-arayuz.md): today's and
// yesterday's waking and bedtime set right, or deleted, also after the scene's 10 minutes. A
// bedtime before 12:00 is that night's, past midnight. The plan is made again from the row.

export function DayRecords() {
  return (
    <ClientOnly>
      <DayRecordsBody />
    </ClientOnly>
  );
}

function DayRecordsBody() {
  const { input, rows } = useTodayPlan();
  if (!input || !rows) return null;
  const days = [input.date, shiftDay(input.date, -1)];
  return (
    <div className="flex flex-col gap-4 text-sm" data-testid="day-records">
      <p className="text-muted-foreground">
        Yanlış yazılan uyanışı ya da yatışı düzelt veya sil. Plan buna göre yeniden kurulur.
      </p>
      {days.map((date) => (
        <DayRecord
          key={date}
          date={date}
          row={rows.days.find((row) => row.date === date) ?? null}
          today={date === input.date}
        />
      ))}
    </div>
  );
}

function DayRecord({ date, row, today }: { date: string; row: DayRow | null; today: boolean }) {
  const label = `${today ? "Bugün" : "Dün"} · ${formatDayLabel(istanbulInstant(date, "12:00"))}`;
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <h3 className="font-medium">{label}</h3>
      <Record
        label="Uyanış"
        date={date}
        at={row?.woke_at ?? null}
        toInstant={(time) => istanbulInstant(date, time)}
        kind="wake"
      />
      <Record
        label="Yatış"
        date={date}
        at={row?.bed_at ?? null}
        toInstant={(time) => bedInstant(date, time)}
        kind="bed"
      />
    </section>
  );
}

function Record({
  label,
  date,
  at,
  toInstant,
  kind,
}: {
  label: string;
  date: string;
  at: string | null;
  toInstant: (time: string) => Date;
  kind: "wake" | "bed";
}) {
  const correct = useCorrectDay();
  const shown = at ? formatTime(new Date(at)) : "";
  const [value, setValue] = useState<string | null>(null);
  const text = value ?? shown;
  const clock = normalizeClock(text);
  const valid = /^\d{2}:\d{2}$/.test(clock) && clock !== "24:00";
  const save = (instant: Date | null) => {
    correct.mutate({ date, [kind]: instant });
    setValue(null);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16">{label}</span>
      <TimeInput
        aria-label={`${label} saati`}
        value={text}
        onChange={setValue}
        className="h-11 w-24 text-base md:h-9"
      />
      <Button
        variant="outline"
        className="h-11 md:h-9"
        disabled={!valid || clock === shown}
        onClick={() => save(toInstant(clock))}
      >
        Kaydet
      </Button>
      {at ? (
        <Button variant="ghost" className="h-11 md:h-9" onClick={() => save(null)}>
          {label === "Uyanış" ? "Uyanışı sil" : "Yatışı sil"}
        </Button>
      ) : (
        <span className="text-muted-foreground">kayıt yok</span>
      )}
    </div>
  );
}
