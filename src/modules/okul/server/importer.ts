import type { ModuleContext } from "@/core/contract/types";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import { unwrap } from "../queries";
import { syncAll } from "../rules";
import { runningTotal } from "./derive";
import type { AssessmentIn, ReadExport } from "./notion";

// The one-time import from Notion (docs/08-notion-aktarim.md): the term, then courses,
// assessments, sessions and the follow-up tasks, each upserted by its Notion address
// (`external_id`), so a second run makes no copy. What the user changed since is kept: a date
// they set (date_source 'user'), a score they gave, an attendance they marked, a course's colour.
// A dry run reads only. The report holds counts, never content.

/** The term the export belongs to (docs/08, "Dönem kaydı"; okul.md section 2). */
export const TERM_2026_FALL = {
  name: "26-27 Güz",
  starts_on: "2026-09-28",
  ends_on: "2026-12-31",
  finals_from: "2027-01-02",
  finals_to: "2027-01-17",
  break_weeks: [8],
};

export type ImportReport = {
  dryRun: boolean;
  tables: Record<string, { inserted: number; updated: number }>;
  undated: number;
  stepsLinked: number;
  skippedTasks: Record<string, number>;
  problems: { kind: string; count: number }[];
  unparsedTimeNotes: number;
  /** The running total of each course, by its code (scores × weights; none came from Notion). */
  totals: Record<string, number>;
  proposed: number;
};

type Existing = { id: string; external_id: string | null };

async function existing(ctx: ModuleContext, table: string, ids: string[]): Promise<Existing[]> {
  if (ids.length === 0) return [];
  const rows: Existing[] = [];
  for (let at = 0; at < ids.length; at += 100) {
    const slice = ids.slice(at, at + 100);
    const { data, error } = await (
      ctx.db.from(table as "okul_courses") as ReturnType<ModuleContext["db"]["from"]>
    )
      .select("*")
      .in("external_id", slice);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Existing[]));
  }
  return rows;
}

export async function importExport(
  ctx: ModuleContext,
  read: ReadExport,
  options: { dryRun: boolean; palette: string[] },
): Promise<ImportReport> {
  const { dryRun } = options;
  const tables: ImportReport["tables"] = {};
  const count = (table: string, inserted: number, updated: number) => {
    tables[table] = { inserted, updated };
  };

  // The term.
  const { data: termRow, error: termError } = await ctx.db
    .from("okul_terms")
    .select("*")
    .eq("name", TERM_2026_FALL.name)
    .maybeSingle();
  if (termError) throw new Error(termError.message);
  let termId = termRow?.id ?? null;
  if (!termRow && !dryRun) {
    termId = unwrap(await ctx.db.from("okul_terms").insert(TERM_2026_FALL).select().single()).id;
  }
  count("okul_terms", termRow ? 0 : 1, 0);

  // Courses.
  const courseRows = (await existing(
    ctx,
    "okul_courses",
    read.courses.map((c) => c.external_id),
  )) as (Existing & { code: string })[];
  const courseIds = new Map<string, string>();
  let insertedCourses = 0;
  for (const [index, course] of read.courses.entries()) {
    const found = courseRows.find((row) => row.external_id === course.external_id);
    const fields = {
      code: course.code,
      name: course.name,
      weekday: course.weekday,
      start_time: course.start_time,
      end_time: course.end_time,
      schedule_text: course.schedule_text,
      vf_conditions: course.vf_conditions,
      grading_note: course.grading_note,
      claude_project_url: course.claude_project_url,
      notion_page_url: course.notion_page_url,
      local_folder: course.local_folder,
      position: index,
    };
    if (found) {
      courseIds.set(course.code, found.id);
      if (!dryRun) {
        unwrap(await ctx.db.from("okul_courses").update(fields).eq("id", found.id).select());
      }
    } else {
      insertedCourses += 1;
      if (!dryRun && termId) {
        const row = unwrap(
          await ctx.db
            .from("okul_courses")
            .insert({
              ...fields,
              term_id: termId,
              external_id: course.external_id,
              color: options.palette[index % options.palette.length],
            })
            .select()
            .single(),
        );
        courseIds.set(course.code, row.id);
      }
    }
  }
  count("okul_courses", insertedCourses, read.courses.length - insertedCourses);

  // Assessments: what the user owns now is not overwritten.
  type AssessmentRow = Existing & {
    date_source: string | null;
    score_source: string | null;
    parent_id: string | null;
    status: string;
  };
  const assessmentRows = (await existing(
    ctx,
    "okul_assessments",
    read.assessments.map((a) => a.external_id),
  )) as AssessmentRow[];
  const assessmentIds = new Map<string, string>();
  let insertedAssessments = 0;
  for (const a of read.assessments) {
    const found = assessmentRows.find((row) => row.external_id === a.external_id);
    const base: TablesUpdate<"okul_assessments"> = {
      title: a.title,
      kind: a.kind,
      weight: a.weight,
      excluded: a.excluded,
      scope_text: a.scope_text,
      source_text: a.source_text,
      vf_condition: a.vf_condition,
      notes: a.notes,
      time_note: a.time_note,
      submits: a.submits,
    };
    const dates: TablesUpdate<"okul_assessments"> = {
      date: a.date,
      time: a.time,
      date_status: a.date_status,
      date_source: a.date ? "notion" : null,
    };
    const score: TablesUpdate<"okul_assessments"> =
      a.score !== null ? { score: a.score, score_source: "user" } : {};
    if (found) {
      assessmentIds.set(a.external_id, found.id);
      if (!dryRun) {
        const patch: TablesUpdate<"okul_assessments"> = {
          ...base,
          ...(found.date_source === "user" ? {} : dates),
          ...(found.score_source ? {} : score),
          // A record the user moved on is not set back by the import.
          ...(found.status === "todo" ? { status: a.status } : {}),
        };
        unwrap(await ctx.db.from("okul_assessments").update(patch).eq("id", found.id).select());
      }
    } else {
      insertedAssessments += 1;
      const courseId = courseIds.get(a.course_code);
      if (!dryRun && courseId) {
        const row = unwrap(
          await ctx.db
            .from("okul_assessments")
            .insert({
              ...(base as TablesInsert<"okul_assessments">),
              ...dates,
              ...score,
              status: a.status,
              course_id: courseId,
              external_id: a.external_id,
              output_kind: outputOf(a),
              owner: a.kind === "project_step" ? "me" : null,
            } as TablesInsert<"okul_assessments">)
            .select()
            .single(),
        );
        assessmentIds.set(a.external_id, row.id);
      }
    }
  }
  count("okul_assessments", insertedAssessments, read.assessments.length - insertedAssessments);

  // A project's steps: Notion does not say whose they are. In a course with a single project the
  // steps are that project's; elsewhere they stay unlinked (docs/08).
  let stepsLinked = 0;
  for (const code of new Set(read.assessments.map((a) => a.course_code))) {
    const projects = read.assessments.filter((a) => a.course_code === code && a.kind === "project");
    if (projects.length !== 1) continue;
    const projectId = assessmentIds.get(projects[0].external_id);
    for (const step of read.assessments.filter(
      (a) => a.course_code === code && a.kind === "project_step",
    )) {
      const stepId = assessmentIds.get(step.external_id);
      const found = assessmentRows.find((row) => row.external_id === step.external_id);
      if (found?.parent_id) continue;
      stepsLinked += 1;
      if (!dryRun && projectId && stepId) {
        unwrap(
          await ctx.db
            .from("okul_assessments")
            .update({ parent_id: projectId })
            .eq("id", stepId)
            .select(),
        );
      }
    }
  }

  // Class sessions: an attendance the user marked here is kept.
  const sessionRows = (await existing(
    ctx,
    "okul_sessions",
    read.sessions.map((s) => s.external_id),
  )) as (Existing & { attendance_at: string | null })[];
  let insertedSessions = 0;
  for (const s of read.sessions) {
    const found = sessionRows.find((row) => row.external_id === s.external_id);
    const fields = {
      date: s.date,
      course_week: s.course_week,
      topic: s.topic,
      kind: s.kind,
      notes: s.notes,
    };
    if (found) {
      if (!dryRun) {
        const patch = found.attendance_at ? fields : { ...fields, attendance: s.attendance };
        unwrap(await ctx.db.from("okul_sessions").update(patch).eq("id", found.id).select());
      }
    } else {
      insertedSessions += 1;
      const courseId = courseIds.get(s.course_code);
      if (!dryRun && courseId) {
        unwrap(
          await ctx.db
            .from("okul_sessions")
            .insert({
              ...fields,
              attendance: s.attendance,
              course_id: courseId,
              external_id: s.external_id,
            })
            .select(),
        );
      }
    }
  }
  count("okul_sessions", insertedSessions, read.sessions.length - insertedSessions);

  // Follow-up and material tasks.
  const taskRows = (await existing(
    ctx,
    "okul_tasks",
    read.tasks.map((t) => t.external_id),
  )) as (Existing & { status: string })[];
  let insertedTasks = 0;
  for (const t of read.tasks) {
    const found = taskRows.find((row) => row.external_id === t.external_id);
    const fields = {
      title: t.title,
      kind: t.kind,
      due_on: t.due_on,
      importance: t.importance,
      course_id: t.course_code ? (courseIds.get(t.course_code) ?? null) : null,
    };
    if (found) {
      if (!dryRun) {
        unwrap(await ctx.db.from("okul_tasks").update(fields).eq("id", found.id).select());
      }
    } else {
      insertedTasks += 1;
      if (!dryRun) {
        unwrap(
          await ctx.db
            .from("okul_tasks")
            .insert({ ...fields, external_id: t.external_id })
            .select(),
        );
      }
    }
  }
  count("okul_tasks", insertedTasks, read.tasks.length - insertedTasks);

  const totals: Record<string, number> = {};
  for (const course of read.courses) {
    totals[course.code] = runningTotal(
      read.assessments
        .filter((a) => a.course_code === course.code)
        .map((a) => ({ score: a.score, weight: a.weight, excluded: a.excluded })),
    );
  }

  const proposed = dryRun ? 0 : (await syncAll(ctx)).proposed;
  return {
    dryRun,
    tables,
    undated: read.assessments.filter((a) => a.date_status === "unknown").length,
    stepsLinked,
    skippedTasks: read.skippedTasks,
    problems: read.problems,
    unparsedTimeNotes: read.unparsedTimeNotes,
    totals,
    proposed,
  };
}

/** Homework and steps are written work until a source says code (Ninova's files, step 2). */
function outputOf(a: AssessmentIn): "written" | null {
  return a.kind === "homework" || a.kind === "project_step" || a.kind === "project"
    ? "written"
    : null;
}
