"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEditBlock, useEditSeries, useSetBlockCancelled } from "@/core/app/actions";
import { useBlocks, useCoreMutation, useNow, useSeries } from "@/core/app/hooks";
import {
  type BlockEdit,
  createBlock,
  createSeries,
  endSeries,
  type SeriesEdit,
} from "@/core/data/blocks";
import type { Block, BlockKind, BlockSeries, DayType } from "@/core/types";
import { dayKey, formatDayLabel, formatTime, istanbulInstant, shiftDay } from "@/lib/date";
import { cn } from "@/lib/utils";
import { ClientOnly } from "../ClientOnly";
import { EditDialog, type EditField } from "../EditDialog";
import { SAVE_FAILED, useNotify } from "../Notices";
import { PageShell } from "../PageShell";
import { BackToSettings } from "./ModulesSettings";

// Settings → Fixed blocks: weekly series (class timetable, working hours), one-off blocks,
// and the coming blocks, any single one of which can be cancelled.

const KINDS: { value: BlockKind; label: string }[] = [
  { value: "class", label: "Ders" },
  { value: "work", label: "İş" },
  { value: "appointment", label: "Randevu" },
  { value: "protected", label: "Korunan zaman" },
];
const KIND_LABEL = Object.fromEntries(KINDS.map((kind) => [kind.value, kind.label]));

const WEEKDAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

const DAY_TYPES: { value: DayType | ""; label: string }[] = [
  { value: "", label: "Belirtme" },
  { value: "home", label: "Ev" },
  { value: "office", label: "Ofis" },
  { value: "campus", label: "Kampüs" },
];

const TIME_FIELDS: EditField[] = [
  { name: "start", label: "Başlangıç", type: "time", required: true },
  { name: "end", label: "Bitiş", type: "time", required: true },
  { name: "location", label: "Yer", type: "text" },
];
const SERIES_FIELDS: EditField[] = [
  { name: "title", label: "Ad", type: "text", required: true },
  {
    name: "weekday",
    label: "Gün",
    type: "select",
    required: true,
    options: WEEKDAYS.map((name, index) => ({ value: String(index + 1), label: name })),
  },
  ...TIME_FIELDS,
];
const BLOCK_FIELDS: EditField[] = [
  { name: "title", label: "Ad", type: "text", required: true },
  { name: "day", label: "Tarih", type: "date", required: true },
  ...TIME_FIELDS,
];

const selectClass = "border-input bg-background h-11 rounded-lg border px-3 text-sm md:h-9";

/** /ayarlar/bloklar */
export function BlocksSettingsScreen() {
  return (
    <PageShell title="Sabit bloklar">
      <BackToSettings />
      <ClientOnly>
        <BlocksSettingsBody />
      </ClientOnly>
    </PageShell>
  );
}

function BlocksSettingsBody() {
  const now = useNow();
  const series = useSeries();
  const blocks = useBlocks();
  const today = dayKey(now);

  const coming = useMemo(
    () =>
      (blocks.data ?? []).filter(
        (block) =>
          Date.parse(block.ends_at) > now.getTime() &&
          dayKey(new Date(block.starts_at)) <= shiftDay(today, 28),
      ),
    [blocks.data, now, today],
  );

  return (
    <>
      <Panel title="Haftalık seriler">
        {(series.data ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">Seri yok.</p>
        ) : (
          <ul className="divide-border divide-y">
            {(series.data ?? []).map((item) => (
              <SeriesRow key={item.id} series={item} />
            ))}
          </ul>
        )}
        <SeriesForm />
      </Panel>

      <Panel title="Tek seferlik blok">
        <BlockForm />
      </Panel>

      <Panel title="Önümüzdeki 4 hafta">
        {coming.length === 0 ? (
          <p className="text-muted-foreground text-sm">Önümüzdeki 4 haftada sabit blok yok.</p>
        ) : (
          <ul aria-label="Yaklaşan bloklar" className="divide-border divide-y">
            {coming.map((block) => (
              <BlockRow key={block.id} block={block} />
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="border-border flex flex-col gap-4 rounded-xl border p-5">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
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

function SeriesRow({ series }: { series: BlockSeries }) {
  const notify = useNotify();
  const edit = useEditSeries();
  const [editing, setEditing] = useState(false);
  const end = useCoreMutation({
    mutate: (db) => endSeries(db, series.id, new Date()),
    onError: () => notify(SAVE_FAILED),
  });
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <div>
        <p className="font-medium">{series.title}</p>
        <p className="text-muted-foreground text-sm tabular-nums">
          {WEEKDAYS[series.weekday - 1]} {series.start_time.slice(0, 5)}–
          {series.end_time.slice(0, 5)}
          {` · ${KIND_LABEL[series.kind]}`}
          {series.location ? ` · ${series.location}` : ""}
        </p>
      </div>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          className="h-11 md:h-9"
          aria-label={`Seriyi düzenle: ${series.title}`}
          onClick={() => setEditing(true)}
        >
          Düzenle
        </Button>
        <Button
          variant="ghost"
          className="h-11 md:h-9"
          aria-label={`Seriyi bitir: ${series.title}`}
          onClick={() => end.mutate(undefined)}
        >
          Seriyi bitir
        </Button>
      </div>
      {editing ? (
        <EditDialog
          title="Seriyi düzenle"
          fields={SERIES_FIELDS}
          initial={{
            title: series.title,
            weekday: String(series.weekday),
            start: series.start_time.slice(0, 5),
            end: series.end_time.slice(0, 5),
            location: series.location ?? "",
          }}
          validate={(values) => values.end > values.start}
          onClose={() => setEditing(false)}
          onSave={(changed) => {
            const patch: SeriesEdit = {};
            if ("title" in changed) patch.title = changed.title.trim();
            if ("weekday" in changed) patch.weekday = Number(changed.weekday);
            if ("start" in changed) patch.start_time = changed.start;
            if ("end" in changed) patch.end_time = changed.end;
            if ("location" in changed) patch.location = changed.location.trim() || null;
            edit.mutate({ id: series.id, patch });
          }}
        />
      ) : null}
    </li>
  );
}

function SeriesForm() {
  const notify = useNotify();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<BlockKind>("class");
  const [weekday, setWeekday] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");
  const [location, setLocation] = useState("");
  const [dayType, setDayType] = useState<DayType | "">("");

  const create = useCoreMutation({
    mutate: (db) =>
      createSeries(
        db,
        {
          title,
          kind,
          weekday: Number(weekday),
          start_time: start,
          end_time: end,
          location: location.trim() || null,
          day_type: dayType || null,
        },
        new Date(),
      ),
    onError: () => notify(SAVE_FAILED),
  });

  const ready = title.trim() !== "" && end > start;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    create.mutate(undefined, {
      onSuccess: () => {
        setTitle("");
        setLocation("");
        notify("Seri eklendi; önümüzdeki 8 haftanın blokları üretildi.");
      },
    });
  };

  return (
    <form onSubmit={submit} aria-label="Yeni seri" className="flex flex-wrap items-end gap-3">
      <Labelled label="Ad">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-11 w-48 md:h-9"
        />
      </Labelled>
      <Labelled label="Tür">
        <select
          aria-label="Tür"
          value={kind}
          onChange={(event) => setKind(event.target.value as BlockKind)}
          className={selectClass}
        >
          {KINDS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Labelled>
      <Labelled label="Gün">
        <select
          aria-label="Gün"
          value={weekday}
          onChange={(event) => setWeekday(event.target.value)}
          className={selectClass}
        >
          {WEEKDAYS.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
      </Labelled>
      <Labelled label="Başlangıç">
        <Input
          type="time"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          className="h-11 w-32 md:h-9"
        />
      </Labelled>
      <Labelled label="Bitiş">
        <Input
          type="time"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          className="h-11 w-32 md:h-9"
        />
      </Labelled>
      <Labelled label="Yer (isteğe bağlı)">
        <Input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className="h-11 w-36 md:h-9"
        />
      </Labelled>
      <Labelled label="Gün tipi">
        <select
          aria-label="Gün tipi"
          value={dayType}
          onChange={(event) => setDayType(event.target.value as DayType | "")}
          className={selectClass}
        >
          {DAY_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Labelled>
      <Button type="submit" className="h-11 md:h-9" disabled={!ready || create.isPending}>
        Seri ekle
      </Button>
    </form>
  );
}

function BlockForm() {
  const notify = useNotify();
  const now = useNow();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<BlockKind>("appointment");
  const [day, setDay] = useState(dayKey(now));
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:00");

  const create = useCoreMutation({
    mutate: (db) =>
      createBlock(db, {
        title,
        kind,
        starts_at: istanbulInstant(day, start).toISOString(),
        ends_at: istanbulInstant(day, end).toISOString(),
      }),
    onError: () => notify(SAVE_FAILED),
  });

  const ready = title.trim() !== "" && day !== "" && end > start;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    create.mutate(undefined, {
      onSuccess: () => {
        setTitle("");
        notify("Blok eklendi.");
      },
    });
  };

  return (
    <form onSubmit={submit} aria-label="Yeni blok" className="flex flex-wrap items-end gap-3">
      <Labelled label="Ad">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-11 w-48 md:h-9"
        />
      </Labelled>
      <Labelled label="Tür">
        <select
          aria-label="Tür"
          value={kind}
          onChange={(event) => setKind(event.target.value as BlockKind)}
          className={selectClass}
        >
          {KINDS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Labelled>
      <Labelled label="Tarih">
        <Input
          type="date"
          value={day}
          onChange={(event) => setDay(event.target.value)}
          className="h-11 w-44 md:h-9"
        />
      </Labelled>
      <Labelled label="Başlangıç">
        <Input
          type="time"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          className="h-11 w-32 md:h-9"
        />
      </Labelled>
      <Labelled label="Bitiş">
        <Input
          type="time"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          className="h-11 w-32 md:h-9"
        />
      </Labelled>
      <Button type="submit" className="h-11 md:h-9" disabled={!ready || create.isPending}>
        Blok ekle
      </Button>
    </form>
  );
}

function BlockRow({ block }: { block: Block }) {
  const setCancelled = useSetBlockCancelled();
  const edit = useEditBlock();
  const [editing, setEditing] = useState(false);
  const cancelled = block.status === "cancelled";
  const start = new Date(block.starts_at);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2">
      <p className={cn("text-sm", cancelled && "text-muted-foreground line-through")}>
        <span className="tabular-nums">
          {formatDayLabel(start)} {formatTime(start)}–{formatTime(new Date(block.ends_at))}
        </span>{" "}
        · {block.title}
        {block.location ? ` · ${block.location}` : ""}
      </p>
      <div className="flex gap-1">
        {cancelled ? null : (
          <Button
            variant="ghost"
            className="h-11 md:h-8"
            aria-label={`Düzenle: ${block.title}, ${formatDayLabel(start)}`}
            onClick={() => setEditing(true)}
          >
            Düzenle
          </Button>
        )}
        <Button
          variant="ghost"
          className="h-11 md:h-8"
          aria-label={`${cancelled ? "Geri al" : "İptal et"}: ${block.title}, ${formatDayLabel(start)}`}
          onClick={() => setCancelled.mutate({ blockId: block.id, cancelled: !cancelled })}
        >
          {cancelled ? "Geri al" : "İptal et"}
        </Button>
      </div>
      {editing ? (
        <EditDialog
          title="Bloğu düzenle"
          fields={BLOCK_FIELDS}
          initial={{
            title: block.title,
            day: dayKey(start),
            start: formatTime(start),
            end: formatTime(new Date(block.ends_at)),
            location: block.location ?? "",
          }}
          validate={(values) => values.end > values.start}
          onClose={() => setEditing(false)}
          onSave={(changed, values) => {
            const patch: BlockEdit = {};
            if ("title" in changed) patch.title = changed.title.trim();
            if ("location" in changed) patch.location = changed.location.trim() || null;
            if ("day" in changed || "start" in changed || "end" in changed) {
              patch.starts_at = istanbulInstant(values.day, values.start).toISOString();
              patch.ends_at = istanbulInstant(values.day, values.end).toISOString();
            }
            edit.mutate({ id: block.id, patch });
          }}
        />
      ) : null}
    </li>
  );
}
