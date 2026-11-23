"use client";

import { useState } from "react";
import { useNow } from "@/core/app/hooks";
import type { ModuleViewProps } from "@/core/contract/types";
import {
  BarChart,
  EmptyState,
  ErrorState,
  ListRow,
  Panel,
  PanelLabel,
  useLayoutDevice,
} from "@/core/ui/kit";
import { dayKey, shiftDay } from "@/lib/date";
import { courseSummary, termOf, type WeekGroup } from "../server/pages";
import { decimal, dayMonth, nearDay } from "../server/text";
import { useTerm, withOkul } from "./useTerm";
import { WorkRow } from "./WorkRow";

// The module's home entry (okul-sayfalar.md, "Ana sayfa"; frames AnaSayfa, PanoAna): the term's
// work by week from this week on, the weeks gone by folded, the undated last; the weight of the
// weeks; the courses. Not drawn in step 1: the "n değişiklik · Ninova · Kepler" line, "duyurudan"
// and the documents' state beyond "hazır" or their day (step 2 and 3).

function Week({ group }: { group: WeekGroup }) {
  return (
    <section aria-label={group.label} data-testid="okul-week" className="border-line border-t">
      <div className="flex items-baseline gap-2 px-4 pt-3 pb-1 md:px-4.5">
        <PanelLabel className="flex-1">{group.label}</PanelLabel>
        <span className="text-ink-2 text-sm tabular-nums">
          {group.rows.length} iş{group.weight ? ` · ${group.weight}` : ""}
        </span>
      </div>
      <div>
        {group.rows.map((row) => (
          <WorkRow key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}

function OkulHomeInner(props: ModuleViewProps) {
  void props;
  const term = useTerm();
  const now = useNow();
  const device = useLayoutDevice();
  const [pastOpen, setPastOpen] = useState(false);
  if (term.isError) return <ErrorState onRetry={() => void term.refetch()} />;
  if (term.isLoading || !term.data) return null;
  const { data, rows } = term.data;
  if (!data.term) {
    return (
      <EmptyState>Henüz bir dönem yok. Notion aktarımı ya da örnek veri dönemi kurar.</EmptyState>
    );
  }
  const byWeek = termOf(rows, data.term, now);
  const today = dayKey(now);
  const soon = rows.filter(
    (row) => row.date && row.date >= today && row.date <= shiftDay(today, 6),
  );
  const open = rows.filter((row) => !row.done);

  const list = (
    <Panel
      variant="dense"
      label="Dönemin işleri"
      action={<span className="text-ink-2 text-sm">tarihe göre · {rows.length} iş</span>}
      data-testid="okul-term"
      className="pb-1.5"
    >
      {byWeek.past.length > 0 ? (
        <div className="border-line border-t">
          <ListRow
            aria-expanded={pastOpen}
            onClick={() => setPastOpen((value) => !value)}
            title="Geçenler"
            subtitle={pastOpen ? "Küçült" : "Geçen haftaların işleri"}
            trailing={<span className="text-ink-2 text-sm tabular-nums">{byWeek.past.length}</span>}
          />
          {pastOpen ? (
            <div id="okul-past">
              {byWeek.past.map((row) => (
                <WorkRow key={row.id} row={row} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {byWeek.weeks.map((group) => (
        <Week key={group.key} group={group} />
      ))}
      {byWeek.finals ? <Week group={byWeek.finals} /> : null}
      {byWeek.unknown.length > 0 ? (
        <Week
          group={{
            key: "unknown",
            label: "TAHMİN EDİLEMEYEN",
            rows: byWeek.unknown,
            weight: null,
            exactWeight: 0,
            estimatedWeight: 0,
          }}
        />
      ) : null}
    </Panel>
  );

  const weights = (
    <Panel variant="dense" label="Haftanın ağırlığı" className="gap-2 px-4 pb-4 md:px-4.5">
      <BarChart
        title="Not yüzdesi, hafta hafta"
        unit="%"
        height={150}
        data={[...byWeek.weeks, ...(byWeek.finals ? [byWeek.finals] : [])].map((group) => ({
          label: group.key === "finals" ? "Final" : dayMonth(group.key),
          value: Math.round((group.exactWeight + group.estimatedWeight) * 10) / 10,
        }))}
      />
    </Panel>
  );

  const courses = (
    <Panel
      variant="dense"
      label="Dersler"
      action={<span className="text-ink-2 text-sm">kazanılan / açıklanan</span>}
      className="pb-1.5"
    >
      {data.courses.map((course) => {
        const summary = courseSummary(course, data.assessments, data.sessions, now);
        const next = rows.find(
          (row) => row.course.id === course.id && row.date && row.date >= today && !row.done,
        );
        return (
          <ListRow
            key={course.id}
            dot={course.color}
            href={`/m/okul/bolum/${course.code.toLowerCase()}`}
            title={course.name}
            subtitle={next ? `sıradaki: ${next.title} · ${nearDay(next.date!, now)}` : course.code}
            trailing={
              <span className="text-base font-semibold tabular-nums">
                {decimal(summary.total)} / {decimal(summary.disclosed)}
              </span>
            }
            className="border-line border-t border-b-0"
          />
        );
      })}
    </Panel>
  );

  if (device === "telefon") {
    return (
      <div data-testid="okul-home" className="flex flex-col gap-4">
        {list}
        {weights}
        {courses}
      </div>
    );
  }

  const boxes: [string, string][] = [
    [
      "Önümüzdeki 7 gün",
      soon.length === 0
        ? "sınav ya da teslim yok"
        : `${soon.filter((r) => ["quiz", "midterm", "final"].includes(r.kind)).length} sınav · ${
            soon.filter((r) => !["quiz", "midterm", "final"].includes(r.kind)).length
          } teslim`,
    ],
    ["Kalan iş", String(open.length)],
    ["Tahmini tarihli", String(rows.filter((row) => row.estimated && !row.done).length)],
    ["Tahmin edilemeyen", String(byWeek.unknown.length)],
  ];
  return (
    <div data-testid="okul-home" className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-3">
        {boxes.map(([label, value]) => (
          <Panel key={label} variant="soft" className="gap-1 px-4 py-3">
            <PanelLabel>{label}</PanelLabel>
            <span className="text-xl font-bold tabular-nums">{value}</span>
          </Panel>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-4">
        {list}
        <div className="flex flex-col gap-4">
          {weights}
          {courses}
        </div>
      </div>
    </div>
  );
}

export const OkulHome = withOkul(OkulHomeInner);
