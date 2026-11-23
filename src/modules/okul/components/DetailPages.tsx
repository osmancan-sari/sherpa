"use client";

import { useState } from "react";
import { useNow } from "@/core/app/hooks";
import type { ModuleViewProps } from "@/core/contract/types";
import type { Task } from "@/core/types";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  ListRow,
  Panel,
  PanelLabel,
  ProgressBar,
  Segmented,
  SwitchRow,
  Tag,
} from "@/core/ui/kit";
import { dayKey, formatMinutes } from "@/lib/date";
import type { Assessment, ClassSession, Course } from "../queries";
import { syncAssessment } from "../rules";
import { markSubmitted, setAttendance, setDocsReady, setGrade } from "../server/entries";
import { attendanceOf, docDay } from "../server/derive";
import { docsReady, facetOf, key, stepsOf } from "../server/proposals";
import { progressText, type Row } from "../server/pages";
import { dayMonth, KIND_LABEL, percent, weekdayDayMonth } from "../server/text";
import { DateSheet, MeetingSheet, StepSheet } from "./Sheets";
import { useTerm, useWrite, withOkul } from "./useTerm";

// The module's detail pages: an exam (frames SinavAyrinti, PanoSinavAyrinti), a homework or a
// project (derived from SorumlulukAyrinti: **görüşün gerek**), a course's attendance (frame Devam).
// Not drawn in step 1: the documents' files and versions, the sessions' sections, the
// announcement's quote, Kepler's column (steps 2 and 3).

const SOURCE: Record<string, string> = {
  syllabus: "syllabus",
  announcement: "duyuru",
  ninova: "Ninova",
  kepler: "Kepler",
  calendar: "akademik takvim",
  rule: "kural",
  guess: "tahmin",
  user: "sen",
  notion: "Notion",
};

function whenLine(a: Assessment): string {
  if (!a.date) return "tarih yok";
  return [weekdayDayMonth(a.date), a.time?.slice(0, 5), a.room].filter(Boolean).join(" · ");
}

/**
 * A sitting's day: the day it was done, its planned day, else "bu hafta" (the core opens sittings
 * for this week only; a day-by-day forecast comes with package C).
 */
function sittingWhen(task: Task): string {
  if (task.status === "done" && task.done_at) return dayMonth(dayKey(new Date(task.done_at)));
  if (task.planned_date) return weekdayDayMonth(task.planned_date);
  return "bu hafta";
}

const STATE: Record<string, string> = {
  done: "bitti",
  doing: "sürüyor",
  todo: "sırada",
  waiting: "bekliyor",
  dropped: "geri çekildi",
};

function Sittings({ tasks, rest }: { tasks: Task[]; rest: string | null }) {
  const shown = tasks.filter((task) => task.status !== "dropped");
  return (
    <Panel variant="dense" label="Oturumlar" className="pb-1.5" data-testid="okul-sittings">
      {shown.length === 0 && !rest ? (
        <p className="text-ink-2 border-line border-t px-4 py-3 text-sm md:px-4.5">
          Henüz oturum açılmadı.
        </p>
      ) : null}
      {shown.map((task, index) => (
        <ListRow
          key={task.id}
          data-testid="okul-sitting"
          pending={task.status === "done"}
          className="border-line border-t border-b-0"
          title={`Oturum ${index + 1}`}
          subtitle={`${sittingWhen(task)} · ${formatMinutes(task.est_minutes)}`}
          trailing={<span className="text-ink-2 text-sm">{STATE[task.status] ?? task.status}</span>}
        />
      ))}
      {rest ? (
        <p className="text-ink-2 border-line border-t px-4 py-3 text-sm md:px-4.5">{rest}</p>
      ) : null}
    </Panel>
  );
}

function GradeBox({ a }: { a: Assessment }) {
  const write = useWrite();
  const [value, setValue] = useState(a.score === null ? "" : String(Number(a.score)));
  const save = () => {
    const number = value.trim() === "" ? null : Number(value.replace(",", "."));
    if (number !== null && (!Number.isFinite(number) || number < 0 || number > 100)) return;
    void write((ctx) => setGrade(ctx, a.id, number));
  };
  return (
    <Panel variant="dense" label="Not" className="gap-3 px-4 pb-4 md:px-4.5">
      <div className="flex items-end gap-3">
        <Field label="100 üzerinden" className="flex-1">
          <Input
            value={value}
            inputMode="decimal"
            maxLength={6}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <Button onClick={save}>Kaydet</Button>
      </div>
      {a.score !== null ? (
        <p className="text-ink-2 text-sm">
          {a.score_source === "kepler" ? "Kepler'den" : "sen girdin"}
        </p>
      ) : null}
    </Panel>
  );
}

function Header({
  a,
  course,
  row,
  extra,
  onDate,
}: {
  a: Assessment;
  course: Course;
  row: Row;
  extra?: string | null;
  onDate: () => void;
}) {
  const progress = row.progress;
  const share =
    progress && progress.total ? Math.min(1, progress.done / Math.max(1, progress.total)) : 0;
  return (
    <Panel variant="main" className="gap-3 p-4 md:p-5" data-testid="okul-detail-header">
      <div className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <h2 className="text-title tracking-title font-bold">{a.title}</h2>
          {row.estimated ? <Tag>tahmini</Tag> : null}
        </span>
        <p className="text-ink-2 text-note">
          {[course.name, KIND_LABEL[a.kind], percent(row.weight)].filter(Boolean).join(" · ")}
        </p>
      </div>
      <button
        type="button"
        onClick={onDate}
        className="glass-soft rounded-soft focus-visible:shadow-focus flex flex-col items-start gap-0.5 px-4 py-3 text-left outline-none"
        data-testid="okul-date"
      >
        <span className="text-base font-semibold">{whenLine(a)}</span>
        <span className="text-ink-2 text-sm">
          {a.date_source ? `kaynak: ${SOURCE[a.date_source] ?? a.date_source}` : "kaynak yok"}
          {a.time_note ? ` · ${a.time_note}` : ""} · değiştir
        </span>
      </button>
      {progress ? (
        <div className="flex flex-col gap-1.5">
          <ProgressBar value={share} color={course.color} label={progressText(progress)} />
          <span className="text-ink-2 text-sm" data-testid="okul-progress">
            {progressText(progress)}
            {extra ? ` · ${extra}` : ""}
          </span>
        </div>
      ) : null}
    </Panel>
  );
}

function AssessmentPageInner({ params }: ModuleViewProps) {
  const term = useTerm();
  const write = useWrite();
  const [dating, setDating] = useState(false);
  const [stepOpen, setStepOpen] = useState<Assessment | "new" | null>(null);
  const [meeting, setMeeting] = useState(false);
  if (term.isError) return <ErrorState onRetry={() => void term.refetch()} />;
  if (term.isLoading || !term.data) return null;
  const { data, rows, items, tasks } = term.data;
  const a = data.assessments.find((row) => row.id === params.id);
  const row = rows.find((candidate) => candidate.id === params.id);
  const course = data.courses.find((candidate) => candidate.id === a?.course_id);
  if (!a || !row || !course) return <EmptyState>Bu iş yok.</EmptyState>;
  const exam = ["quiz", "midterm", "final"].includes(a.kind);
  const workKey = exam
    ? key.prep(a.id)
    : a.kind === "project_step"
      ? key.step(a.id)
      : key.homework(a.id);
  const item = items.find((candidate) => candidate.key === workKey);
  const sittings = item
    ? tasks
        .filter((task) => task.work_item_id === item.id)
        .sort((x, y) => (x.position ?? 99) - (y.position ?? 99))
    : [];
  const done = sittings.filter((task) => task.status === "done").length;
  const live = sittings.filter((task) => task.status !== "dropped").length;
  const left =
    item && item.effort_total_minutes !== null
      ? Math.max(0, item.effort_total_minutes - item.effort_done_minutes)
      : null;
  const dateSheet = dating ? (
    <DateSheet assessment={a} open={dating} onOpenChange={setDating} />
  ) : null;

  if (exam) {
    const docs = docsReady(data.prepDocs.filter((doc) => doc.assessment_id === a.id));
    const dd = docDay(a.kind, a.date);
    const open = sittings.filter((task) => task.status === "todo" || task.status === "doing");
    const rest =
      left !== null && left > 0 && open.length === 0
        ? docs.ready
          ? `Kalan ${item?.effort_provisional ? "yaklaşık " : ""}${formatMinutes(left)}; oturumlar haftası gelince açılır.`
          : `Kalan ${item?.effort_provisional ? "yaklaşık " : ""}${formatMinutes(left)}; "Dokümanım hazır" denince oturumlar açılır.`
        : null;
    return (
      <div data-testid="okul-exam" className="grid items-start gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Header
            a={a}
            course={course}
            row={row}
            extra={live > 0 ? `biten oturum ${done} / ${live}` : null}
            onDate={() => setDating(true)}
          />
          {a.scope_text ? (
            <Panel variant="dense" label="Kapsam" className="px-4 pb-4 md:px-4.5">
              <p className="text-base">{a.scope_text}</p>
            </Panel>
          ) : null}
          <Panel variant="dense" label="Dokümanlar" className="pb-1.5" data-testid="okul-docs">
            <SwitchRow
              className="border-line border-t px-4 md:px-4.5"
              label="Dokümanım hazır"
              checked={docs.ready}
              onChange={(on) => void write((ctx) => setDocsReady(ctx, a.id, on))}
              description={
                docs.ready
                  ? `elle işaretlendi${docs.at ? ` · ${dayMonth(dayKey(new Date(docs.at)))}` : ""}`
                  : dd
                    ? `Doküman günü ${dayMonth(dd)}; hazır olana kadar hazırlık yalnızca planda yer tutar.`
                    : "Hazır olana kadar hazırlık yalnızca planda yer tutar."
              }
            />
          </Panel>
          <GradeBox a={a} />
        </div>
        <Sittings tasks={sittings} rest={rest} />
        {dateSheet}
      </div>
    );
  }

  const project = a.kind === "project";
  const steps = project ? stepsOf(a, data.assessments) : [];
  const meetings = project ? data.meetings.filter((m) => m.project_id === a.id) : [];
  return (
    <div data-testid="okul-work" className="grid items-start gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Header
          a={a}
          course={course}
          row={row}
          extra={live > 0 ? `biten oturum ${done} / ${live}` : null}
          onDate={() => setDating(true)}
        />
        {a.resume_note ? (
          <Panel variant="soft" className="gap-0.5 px-4 py-3" data-testid="okul-resume">
            <PanelLabel>Kaldığın yer</PanelLabel>
            <p className="text-base font-semibold">{a.resume_note}</p>
            {a.resume_noted_at ? (
              <p className="text-ink-2 text-sm">
                {dayMonth(dayKey(new Date(a.resume_noted_at)))} oturumundan çıkarken yazdın
              </p>
            ) : null}
          </Panel>
        ) : null}
        {a.submits ? (
          <Panel variant="dense" label="Teslim" className="pb-1.5" data-testid="okul-submit-state">
            <ListRow
              className="border-line border-t border-b-0"
              title={a.submitted_at ? "Teslim edildi" : "Teslim edilmedi"}
              subtitle={
                a.submitted_at
                  ? `${dayMonth(dayKey(new Date(a.submitted_at)))} · ${a.submit_source === "ninova" ? "Ninova'da görüldü" : "sen işaretledin"}`
                  : a.date
                    ? `son gün ${weekdayDayMonth(a.date)}${a.time ? ` ${a.time.slice(0, 5)}` : ""}`
                    : null
              }
              trailing={
                a.submitted_at ? null : (
                  <Button
                    size="sm"
                    onClick={() =>
                      void write((ctx) =>
                        markSubmitted(ctx, a.id).then(() => syncAssessment(ctx, a.id)),
                      )
                    }
                  >
                    Yükledim
                  </Button>
                )
              }
            />
          </Panel>
        ) : null}
        {a.kind === "homework" ? <GradeBox a={a} /> : null}
      </div>
      <div className="flex flex-col gap-4">
        {project ? (
          <Panel
            variant="dense"
            label="Alt işler"
            action={
              <Button variant="quiet" size="sm" onClick={() => setStepOpen("new")}>
                Alt iş ekle
              </Button>
            }
            className="pb-1.5"
            data-testid="okul-steps"
          >
            {steps.length === 0 ? (
              <p className="text-ink-2 border-line border-t px-4 py-3 text-sm md:px-4.5">
                Alt iş yok; proje tek iş olarak planlanır.
              </p>
            ) : null}
            {steps.map((step) => (
              <ListRow
                key={step.id}
                className="border-line border-t border-b-0"
                pending={step.status === "done"}
                onClick={() => setStepOpen(step)}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{step.title}</span>
                    {step.proposed ? <Tag>öneri</Tag> : null}
                  </span>
                }
                subtitle={[
                  step.date ? dayMonth(step.date) : "tarih yok",
                  step.owner === "other"
                    ? (step.owner_name ?? "başkası")
                    : step.owner === "none"
                      ? "kimse"
                      : "sen",
                  step.status === "done" ? "bitti" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
          </Panel>
        ) : (
          <Sittings
            tasks={sittings}
            rest={
              left !== null && left > 0 && !row.done
                ? `Kalan ${item?.effort_provisional ? "yaklaşık " : ""}${formatMinutes(left)}`
                : null
            }
          />
        )}
        {project ? (
          <Panel
            variant="dense"
            label="Takım toplantıları"
            action={
              <Button variant="quiet" size="sm" onClick={() => setMeeting(true)}>
                Toplantı ekle
              </Button>
            }
            className="pb-1.5"
          >
            {meetings.map((m) => (
              <ListRow
                key={m.id}
                className="border-line border-t border-b-0"
                pending={m.done}
                title={m.title}
                subtitle={`${weekdayDayMonth(dayKey(new Date(m.starts_at)))} · ${new Date(m.starts_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" })}`}
              />
            ))}
          </Panel>
        ) : null}
      </div>
      {dateSheet}
      {stepOpen ? (
        <StepSheet
          project={a}
          step={stepOpen === "new" ? null : stepOpen}
          open
          onOpenChange={(open) => (open ? null : setStepOpen(null))}
        />
      ) : null}
      {meeting ? <MeetingSheet project={a} open={meeting} onOpenChange={setMeeting} /> : null}
    </div>
  );
}

// --- Attendance (frame Devam) -------------------------------------------------------------------

const MARKS = [
  { value: "attended", label: "Girdim" },
  { value: "missed", label: "Girmedim" },
  { value: "not_held", label: "Yapılmadı" },
] as const;

const MARK_TEXT: Record<string, string> = {
  attended: "girdim",
  missed: "girmedim",
  not_held: "yapılmadı",
};

function SessionRow({ session }: { session: ClassSession }) {
  const write = useWrite();
  const mark = attendanceOf(session);
  return (
    <div
      className="border-line flex flex-col gap-2 border-t px-4 py-3 md:px-4.5"
      data-testid="okul-attendance-row"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base font-semibold">{weekdayDayMonth(session.date)}</span>
        <span className="text-ink-2 text-sm">
          {session.topic ?? ""} · sen: {mark ? MARK_TEXT[mark] : "işaret yok"}
        </span>
      </div>
      <Segmented
        label={`${weekdayDayMonth(session.date)}: derse girdin mi?`}
        value={(session.attendance ?? "none") as "attended" | "missed" | "not_held" | "none"}
        onChange={(value) => {
          if (value !== "none") void write((ctx) => setAttendance(ctx, session.id, value));
        }}
        options={MARKS}
      />
    </div>
  );
}

function AttendancePageInner({ params }: ModuleViewProps) {
  const term = useTerm();
  const now = useNow();
  if (term.isError) return <ErrorState onRetry={() => void term.refetch()} />;
  if (term.isLoading || !term.data) return null;
  const { data } = term.data;
  const course = data.courses.find((row) => facetOf(row) === params.course);
  if (!course) return <EmptyState>Bu ders bu dönemde yok.</EmptyState>;
  const today = dayKey(now);
  const sessions = data.sessions.filter((s) => s.course_id === course.id);
  const held = sessions.filter((s) => ["lecture", "recitation", "presentation"].includes(s.kind));
  const past = held.filter((s) => s.date <= today).reverse();
  const next = held.find((s) => s.date > today && s.attendance !== "not_held");
  const holiday = sessions.find((s) => s.kind === "holiday" && s.date > today);
  const marked = past.map(attendanceOf);
  const attended = marked.filter((m) => m === "attended").length;
  const counted = marked.filter((m) => m !== "not_held").length;
  const rule =
    course.absence_limit !== null
      ? `En çok ${course.absence_limit} devamsızlık.`
      : course.attendance_min_pct !== null
        ? `Derslerin en az %${course.attendance_min_pct}'ine girilmeli; "Yapılmadı" sayılmaz.`
        : "Bu derste devam şartı yok; işaretlersen yine sayılır.";
  const missed = marked.filter((m) => m === "missed").length;
  const allowed =
    course.absence_limit ??
    (course.attendance_min_pct !== null
      ? Math.floor(
          (held.filter((s) => s.attendance !== "not_held").length *
            (100 - course.attendance_min_pct)) /
            100,
        )
      : null);
  return (
    <div data-testid="okul-attendance" className="flex flex-col gap-4">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-title tracking-title font-bold">{course.name}</h2>
        <p className="text-ink-2 text-note">
          {[
            next ? `Sıradaki ders ${weekdayDayMonth(next.date)}` : null,
            holiday ? `${dayMonth(holiday.date)} tatil` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>
      <Panel variant="main" className="gap-3 p-4 md:p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5">
            <PanelLabel>Sen</PanelLabel>
            <span className="text-xl font-bold tabular-nums">
              {attended} / {counted}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <PanelLabel>Kalan devamsızlık</PanelLabel>
            <span className="text-xl font-bold tabular-nums" data-testid="okul-absences-left">
              {allowed === null ? "—" : Math.max(0, allowed - missed)}
            </span>
          </div>
        </div>
        <p className="text-ink-2 text-sm">{rule}</p>
      </Panel>
      <Panel variant="dense" label="Dersler" className="pb-1.5">
        {past.length === 0 ? (
          <p className="text-ink-2 border-line border-t px-4 py-3 text-sm md:px-4.5">
            Henüz ders yapılmadı.
          </p>
        ) : (
          past.map((session) => <SessionRow key={session.id} session={session} />)
        )}
      </Panel>
    </div>
  );
}

export const AssessmentPage = withOkul(AssessmentPageInner);

export const AttendancePage = withOkul(AttendancePageInner);
