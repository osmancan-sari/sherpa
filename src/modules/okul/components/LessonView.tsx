"use client";

import { useEffect, useState } from "react";
import { useRefreshAll } from "@/core/app/actions";
import { useModuleQuery } from "@/core/app/hooks";
import type { BlockViewProps } from "@/core/contract/types";
import { Button, Input, ListRow, Panel, PanelLabel, ProgressBar } from "@/core/ui/kit";
import { SAVE_FAILED, useNotify } from "@/core/ui/Notices";
import { formatMinutes, formatTime, weekdayOf } from "@/lib/date";
import {
  type ClassNote,
  getSession,
  insertClassNote,
  listClassNotes,
  loadTerm,
  updateSession,
} from "../queries";
import { setAttendance } from "../rules";
import { hasAttendanceRule } from "../server/derive";
import { dayMonth, weekdayDayMonth, WEEKDAY_SHORT } from "../server/text";
import { AddAssessmentSheet } from "./Sheets";
import { OkulContext } from "./useTerm";

// The lesson's view (`ui.blockView`; frames SahneDers, PanoDersSahne): opened from a lesson's
// fixed block, it opens no session and counts nothing. While the lesson runs: the time to its end,
// what was said in class (each with "Tarihe çevir"), "Not al", "Sınav ya da teslim ekle", quiet
// "Derste değilim". After it: "Derse girdin mi?" (only in a course with an attendance condition),
// the lines written, the next work. Opening it marks the session viewed: then Today does not ask.
// Not drawn in step 1: "Bu hafta" (the week's file, step 2), Kepler's sentence. The phone's "ders
// bitti" and "Derste değilim" are derived (**görüşün gerek**).

const ANSWERS = [
  { value: "attended", label: "Girdim" },
  { value: "missed", label: "Girmedim" },
  { value: "not_held", label: "Yapılmadı" },
] as const;
const ANSWER_TEXT: Record<string, string> = {
  attended: "Girdin",
  missed: "Girmedin",
  not_held: "Ders yapılmadı",
};

export function LessonView(props: BlockViewProps) {
  return (
    <OkulContext.Provider value={props.ctx}>
      <Lesson {...props} />
    </OkulContext.Provider>
  );
}

function Lesson({ block, phase, ctx, strip, device, exit, now }: BlockViewProps) {
  const refreshAll = useRefreshAll();
  const notify = useNotify();
  const id = block.source_id;
  const lesson = useModuleQuery(ctx.module, ["lesson", id], async (context) => {
    if (!id) return null;
    const session = await getSession(context, id);
    if (!session) return null;
    const data = await loadTerm(context);
    const course = data.courses.find((row) => row.id === session.course_id) ?? null;
    const notes = await listClassNotes(context, id);
    const next = data.assessments
      .filter(
        (a) =>
          a.course_id === session.course_id &&
          a.date !== null &&
          a.date >= session.date &&
          a.status !== "done" &&
          !a.submitted_at,
      )
      .sort((a, b) => (a.date as string).localeCompare(b.date as string))[0];
    return { session, course, notes, next: next ?? null };
  });
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState<{ noteId: string; text: string } | "new" | null>(null);
  const run = async (write: () => Promise<unknown>) => {
    try {
      await write();
      await refreshAll();
      return true;
    } catch {
      notify(SAVE_FAILED);
      return false;
    }
  };

  const session = lesson.data?.session ?? null;
  useEffect(() => {
    strip({
      detail:
        phase === "during"
          ? "derste"
          : phase === "after"
            ? "ders bitti"
            : `bugün ${formatTime(new Date(block.starts_at))}`,
    });
  }, [strip, phase, block.starts_at]);
  // Opened: the question is asked here, not on Today (rule 15).
  useEffect(() => {
    if (session && !session.viewed_at) {
      void updateSession(ctx, session.id, { viewed_at: new Date().toISOString() }).catch(() => {});
    }
  }, [ctx, session]);

  if (lesson.isLoading) return null;
  if (!lesson.data || !session) {
    return <p className="text-ink-2 text-note">Bu ders artık yok.</p>;
  }
  const { course, notes, next } = lesson.data;
  const starts = new Date(block.starts_at);
  const ends = new Date(block.ends_at);
  const left = Math.max(0, Math.round((ends.getTime() - now.getTime()) / 60_000));
  const share = Math.min(
    1,
    Math.max(0, (now.getTime() - starts.getTime()) / (ends.getTime() - starts.getTime())),
  );
  const asks = course ? hasAttendanceRule(course) : false;
  const day = `${WEEKDAY_SHORT[weekdayOf(session.date) - 1]} ${formatTime(starts)}–${formatTime(ends)}`;
  const save = async () => {
    const text = note.trim();
    if (!text) return;
    if (await run(() => insertClassNote(ctx, session.id, text))) setNote("");
  };

  const notesBox = (
    <Panel
      variant="dense"
      label={phase === "after" ? "Derste yazdıkların" : "Derste söylenen"}
      className="pb-1.5"
      data-testid="okul-class-notes"
    >
      {notes.length === 0 ? (
        <p className="text-ink-2 border-line border-t px-4 py-3 text-sm md:px-4.5">
          Henüz bir şey yazmadın.
        </p>
      ) : (
        notes.map((row: ClassNote) => (
          <ListRow
            key={row.id}
            data-testid="okul-class-note"
            className="border-line border-t border-b-0"
            title={row.text}
            subtitle={`${formatTime(new Date(row.created_at))}'de yazdın${row.converted_to ? " · tarihe çevrildi" : ""}`}
            trailing={
              row.converted_to ? null : (
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => setAdding({ noteId: row.id, text: row.text })}
                >
                  Tarihe çevir
                </Button>
              )
            }
          />
        ))
      )}
      {phase !== "after" ? (
        <div className="border-line flex gap-2 border-t px-4 pt-3 pb-2 md:px-4.5">
          <Input
            aria-label="Derste söylenen"
            placeholder="Tek cümle"
            value={note}
            maxLength={300}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
            }}
          />
          <Button variant="primary" onClick={() => void save()} disabled={!note.trim()}>
            Not al
          </Button>
        </div>
      ) : null}
    </Panel>
  );

  const question =
    phase === "after" && asks ? (
      <Panel variant="main" className="gap-3 p-5" data-testid="okul-attendance-question">
        {session.attendance ? (
          <p className="text-xl font-bold">{ANSWER_TEXT[session.attendance]}.</p>
        ) : (
          <>
            <h3 className="text-xl font-bold">Derse girdin mi?</h3>
            <div className="flex flex-wrap gap-2">
              {ANSWERS.map((answer) => (
                <Button
                  key={answer.value}
                  variant={answer.value === "attended" ? "primary" : "secondary"}
                  onClick={() => void run(() => setAttendance(ctx, session.id, answer.value))}
                >
                  {answer.label}
                </Button>
              ))}
            </div>
          </>
        )}
      </Panel>
    ) : null;

  const left_column = (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-title md:text-scene tracking-title font-bold">
          {course?.name ?? block.title}
        </h2>
        <p className="text-ink-2 text-note tabular-nums">
          {day}
          {session.course_week ? ` · Hafta ${session.course_week}` : ""}
          {block.location ? ` · ${block.location}` : ""}
        </p>
      </header>
      <Panel variant="main" className="gap-2 p-5" data-testid="okul-lesson-time">
        <p className="text-2xl font-bold">
          {phase === "during"
            ? `Bitişe ${formatMinutes(left)}`
            : phase === "after"
              ? "Ders bitti"
              : `${weekdayDayMonth(session.date)} ${formatTime(starts)}`}
        </p>
        <ProgressBar
          value={phase === "before" ? 0 : share}
          color={course?.color ?? "var(--color-series)"}
          label="Dersin geçen süresi"
        />
        <div className="text-ink-2 flex justify-between text-sm tabular-nums">
          <span>{formatTime(starts)}</span>
          <span>{formatTime(ends)}</span>
        </div>
      </Panel>
      {question}
    </div>
  );

  const right_column = (
    <div className="flex flex-col gap-4">
      {notesBox}
      {phase === "after" && next ? (
        <Panel variant="soft" className="gap-0.5 px-4 py-3">
          <PanelLabel>Sıradaki iş</PanelLabel>
          <p className="text-base font-semibold">
            {next.title} · {dayMonth(next.date as string)}
            {next.weight !== null ? ` · notun %${Number(next.weight)}'si` : ""}
          </p>
        </Panel>
      ) : null}
      {phase !== "after" ? (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setAdding("new")}>Sınav ya da teslim ekle</Button>
          {phase === "during" && asks ? (
            <Button
              variant="quiet"
              onClick={() =>
                void run(() => setAttendance(ctx, session.id, "missed")).then((ok) => ok && exit())
              }
            >
              Derste değilim
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      data-testid="okul-lesson"
      data-phase={phase}
      className={device === "pano" ? "grid grid-cols-2 items-start gap-10" : "flex flex-col gap-4"}
    >
      {left_column}
      {right_column}
      {adding && course ? (
        <AddAssessmentSheet
          course={course}
          open
          onOpenChange={(open) => (open ? null : setAdding(null))}
          from={adding === "new" ? null : adding}
        />
      ) : null}
    </div>
  );
}
