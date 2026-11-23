"use client";

import { ListRow, Tag } from "@/core/ui/kit";
import { dayColumn, docsText, progressText, type Row } from "../server/pages";

/** The day's column of a row: "24" over "Kas Sal"; "–" over "tarih yok" without a date. */
export function DayLead({ day }: { day: string | null }) {
  if (!day) {
    return (
      <>
        <span className="text-xl font-bold">–</span>
        <span className="text-ink-2 text-xs">tarih yok</span>
      </>
    );
  }
  const column = dayColumn(day);
  return (
    <>
      <span className="text-xl font-bold tabular-nums">{column.date}</span>
      <span className="text-ink-2 text-xs whitespace-nowrap">{column.under}</span>
    </>
  );
}

/**
 * A row of the term's work (frames AnaSayfa, Ders): the day, the name with "tahmini", the course,
 * kind and weight, the work done of its length, an exam's documents. The whole row opens the work.
 */
export function WorkRow({ row, showCourse = true }: { row: Row; showCourse?: boolean }) {
  const lines = [
    showCourse ? row.line : row.line.split(" · ").slice(1).join(" · ") || null,
    row.progress ? progressText(row.progress) : null,
    row.docs && !row.done ? docsText(row.docs) : null,
    row.submitted ? "teslim edildi" : null,
  ].filter(Boolean);
  return (
    <ListRow
      data-testid="okul-row"
      data-id={row.id}
      lead={<DayLead day={row.date} />}
      pending={row.done}
      href={`/m/okul/is/${row.id}`}
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span>{row.title}</span>
          {row.estimated ? <Tag>tahmini</Tag> : null}
        </span>
      }
      subtitle={
        <span className="flex flex-col">
          {lines.map((line) => (
            <span key={line as string}>{line}</span>
          ))}
        </span>
      }
      trailing={
        showCourse ? (
          <span
            aria-hidden
            className="size-2.25 rounded-full"
            style={{ backgroundColor: row.course.color }}
          />
        ) : null
      }
    />
  );
}
