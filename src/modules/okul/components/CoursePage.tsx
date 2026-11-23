"use client";

import { useState } from "react";
import { useNow } from "@/core/app/hooks";
import type { ModuleFacetViewProps } from "@/core/contract/types";
import {
  Button,
  EmptyState,
  ErrorState,
  ListRow,
  Panel,
  PanelLabel,
  TabBar,
  TabLink,
  Tag,
} from "@/core/ui/kit";
import { facetOf } from "../server/proposals";
import { courseSummary, type Row, scoreLine } from "../server/pages";
import { clock, dayMonth, decimal, KIND_LABEL, percent, WEEKDAY_LONG } from "../server/text";
import { AddAssessmentSheet, AttendanceRuleSheet } from "./Sheets";
import { useTerm, withOkul } from "./useTerm";
import { DayLead, WorkRow } from "./WorkRow";

// A course's page (okul-sayfalar.md, "Ders sayfası"; frames Ders, PanoDers): its summary, all its
// work (what is ahead, a project's steps under it, what is done), its conditions and its grading.
// "Sınav ya da teslim ekle" is here only. Not drawn in step 1: "Dosyalar", the guessing rules and
// "Not ve yoklama Kepler'den" (steps 2 and 3).

const OWNER: Record<string, string> = { me: "sen", none: "kimse" };

function ownerText(row: Row) {
  if (row.owner === "other") return row.ownerName ?? "başkası";
  return OWNER[row.owner ?? "me"] ?? "sen";
}

function CoursePageInner({ facet }: ModuleFacetViewProps) {
  const term = useTerm();
  const now = useNow();
  const [adding, setAdding] = useState(false);
  const [rule, setRule] = useState(false);
  if (term.isError) return <ErrorState onRetry={() => void term.refetch()} />;
  if (term.isLoading || !term.data) return null;
  const { data, rows } = term.data;
  const course = data.courses.find((row) => facetOf(row) === facet.key);
  if (!course) return <EmptyState>Bu ders bu dönemde yok.</EmptyState>;
  const summary = courseSummary(course, data.assessments, data.sessions, now);
  const mine = rows.filter((row) => row.course.id === course.id);
  const top = mine.filter((row) => !row.parentId || !mine.some((p) => p.id === row.parentId));
  const ahead = top.filter((row) => !row.done);
  const done = top.filter((row) => row.done).reverse();
  const stepsOf = (id: string) => mine.filter((row) => row.parentId === id);
  const lessonLine = [
    course.code,
    course.weekday ? WEEKDAY_LONG[course.weekday - 1] : null,
    clock(course.start_time),
  ]
    .filter(Boolean)
    .join(" · ");

  const assessments = data.assessments.filter((a) => a.course_id === course.id);
  const grading = ["quiz", "homework", "midterm", "project", "presentation", "final"]
    .map((kind) => {
      const list = assessments.filter(
        (a) => a.kind === kind && !a.excluded && a.weight !== null && Number(a.weight) > 0,
      );
      const sum = list.reduce((total, a) => total + Number(a.weight), 0);
      return { kind, count: list.length, sum };
    })
    .filter((line) => line.count > 0);
  const gradingTotal = grading.reduce((total, line) => total + line.sum, 0);
  const absences = summary.absences;

  return (
    <div data-testid="okul-course" data-facet={facet.key} className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-title tracking-title font-bold">{course.name}</h2>
          <p className="text-ink-2 text-note">{lessonLine}</p>
        </div>
        <Button onClick={() => setAdding(true)}>Sınav ya da teslim ekle</Button>
      </header>

      <Panel variant="main" className="gap-3 p-4 md:p-5" data-testid="okul-course-summary">
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-0.5">
            <PanelLabel>Anlık toplam</PanelLabel>
            <span className="text-xl font-bold tabular-nums">
              {decimal(summary.total)} / {decimal(summary.disclosed)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <PanelLabel>Kalan devamsızlık</PanelLabel>
            <span className="text-xl font-bold tabular-nums">
              {absences ? absences.remaining : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <PanelLabel>Sıradaki</PanelLabel>
            <span className="text-base font-semibold">
              {summary.next ? `${summary.next.title} · ${summary.next.days} gün` : "—"}
            </span>
          </div>
        </div>
        <p className="text-ink-2 text-sm">{summary.disclosedLine}</p>
      </Panel>

      <TabBar label="Dersin sayfaları" className="self-start">
        <TabLink href={`/m/okul/bolum/${facet.key}`} selected>
          Sorumluluklar
        </TabLink>
        <TabLink href={`/m/okul/devam/${facet.key}`}>Devam</TabLink>
      </TabBar>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          variant="dense"
          label="Tüm işler"
          action={<span className="text-ink-2 text-sm">{mine.length} iş</span>}
          className="pb-1.5"
          data-testid="okul-course-work"
        >
          <PanelLabel className="border-line border-t px-4 pt-3 pb-1 md:px-4.5">
            Sırada · {ahead.length} iş
          </PanelLabel>
          {ahead.map((row) => (
            <div key={row.id}>
              <WorkRow row={row} showCourse={false} className="border-line border-t border-b-0" />
              {stepsOf(row.id).map((step) => (
                <ListRow
                  key={step.id}
                  data-testid="okul-step"
                  className="pl-14"
                  pending={step.done}
                  href={`/m/okul/is/${step.id}`}
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{step.title}</span>
                      {step.proposed ? <Tag>öneri</Tag> : null}
                    </span>
                  }
                  subtitle={[
                    step.date ? dayMonth(step.date) : "tarih yok",
                    "alt iş",
                    ownerText(step),
                  ].join(" · ")}
                />
              ))}
            </div>
          ))}
          {done.length > 0 ? (
            <>
              <PanelLabel className="border-line border-t px-4 pt-3 pb-1 md:px-4.5">
                Bitenler · {done.length} iş
              </PanelLabel>
              {done.map((row) => {
                const a = assessments.find((item) => item.id === row.id)!;
                return (
                  <ListRow
                    key={row.id}
                    lead={<DayLead day={row.date} />}
                    href={`/m/okul/is/${row.id}`}
                    title={row.title}
                    subtitle={[
                      percent(row.weight),
                      scoreLine(a),
                      row.submitted ? "teslim edildi" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                );
              })}
            </>
          ) : null}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel variant="dense" label="VF şartları" className="pb-1.5">
            {course.vf_conditions && (course.vf_conditions as { text: string }[]).length > 0
              ? (course.vf_conditions as { text: string }[]).map((condition) => (
                  <ListRow
                    key={condition.text}
                    title={condition.text}
                    className="border-line border-t border-b-0"
                  />
                ))
              : null}
            <ListRow
              className="border-line border-t border-b-0"
              title="Devam"
              subtitle={
                absences
                  ? `${
                      course.absence_limit !== null
                        ? `en çok ${course.absence_limit} devamsızlık`
                        : `en az %${course.attendance_min_pct}`
                    } · ${absences.remaining} hakkın kaldı`
                  : "şart yok · devam sorulmaz"
              }
              trailing={
                <Button variant="quiet" size="sm" onClick={() => setRule(true)}>
                  Değiştir
                </Button>
              }
            />
          </Panel>

          <Panel
            variant="dense"
            label="Notlandırma"
            action={<span className="text-ink-2 text-sm">toplam {percent(gradingTotal)}</span>}
            className="pb-3"
          >
            {grading.map((line) => (
              <ListRow
                key={line.kind}
                className="border-line border-t border-b-0"
                title={KIND_LABEL[line.kind]}
                subtitle={line.count > 1 ? `${line.count} iş` : null}
                trailing={
                  <span className="text-base font-semibold tabular-nums">{percent(line.sum)}</span>
                }
              />
            ))}
            {course.grading_note ? (
              <p className="text-ink-2 border-line border-t px-4 pt-3 text-sm md:px-4.5">
                {course.grading_note}
              </p>
            ) : null}
          </Panel>
        </div>
      </div>

      <AddAssessmentSheet course={course} open={adding} onOpenChange={setAdding} />
      {rule ? <AttendanceRuleSheet course={course} open={rule} onOpenChange={setRule} /> : null}
    </div>
  );
}

export const CoursePage = withOkul(CoursePageInner);
