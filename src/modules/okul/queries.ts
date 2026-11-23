import type { ModuleContext } from "@/core/contract/types";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";

// The module's own tables (supabase/migrations/20261123174511_okul_tables.sql). Nobody else reads
// or writes them (docs/06-modul-sozlesmesi.md). Core tables are never written here: work is
// proposed with `ctx.propose` (rules.ts).

export type Term = Tables<"okul_terms">;
export type Course = Tables<"okul_courses">;
export type Assessment = Tables<"okul_assessments">;
export type ClassSession = Tables<"okul_sessions">;
export type ClassNote = Tables<"okul_class_notes">;
export type PrepDoc = Tables<"okul_prep_docs">;
export type Meeting = Tables<"okul_meetings">;
export type OkulTask = Tables<"okul_tasks">;
export type SessionLog = Tables<"okul_session_log">;

export type AssessmentKind = Assessment["kind"];
export const EXAM_KINDS = ["quiz", "midterm", "final"] as const;
export const isExam = (kind: string) => (EXAM_KINDS as readonly string[]).includes(kind);

/** Everything of the active term the module's rules and pages read, in one go. */
export type TermData = {
  term: Term | null;
  courses: Course[];
  assessments: Assessment[];
  sessions: ClassSession[];
  prepDocs: PrepDoc[];
  meetings: Meeting[];
  tasks: OkulTask[];
  log: SessionLog[];
};

export function unwrap<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null || result.data === undefined) throw new Error("no data returned");
  return result.data;
}

function check(result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(result.error.message);
}

/** The term the module works on: the active one, the latest by its start. */
export async function activeTerm(ctx: ModuleContext): Promise<Term | null> {
  const { data, error } = await ctx.db
    .from("okul_terms")
    .select("*")
    .eq("status", "active")
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** The active term's courses, in their order (one query: the facets read only this). */
export async function listCourses(ctx: ModuleContext, termId?: string): Promise<Course[]> {
  let query = ctx.db.from("okul_courses").select("*");
  if (termId) query = query.eq("term_id", termId);
  return unwrap(await query.order("position").order("code"));
}

/** The active term's whole data. Course-scoped tables are read for the term's courses. */
export async function loadTerm(ctx: ModuleContext): Promise<TermData> {
  const term = await activeTerm(ctx);
  if (!term) {
    return {
      term: null,
      courses: [],
      assessments: [],
      sessions: [],
      prepDocs: [],
      meetings: [],
      tasks: [],
      log: [],
    };
  }
  const courses = await listCourses(ctx, term.id);
  const ids = courses.map((course) => course.id);
  if (ids.length === 0) {
    return {
      term,
      courses,
      assessments: [],
      sessions: [],
      prepDocs: [],
      meetings: [],
      tasks: [],
      log: [],
    };
  }
  const [assessments, sessions, tasks] = await Promise.all([
    ctx.db
      .from("okul_assessments")
      .select("*")
      .in("course_id", ids)
      .order("date", { nullsFirst: false })
      .order("position")
      .order("created_at"),
    ctx.db.from("okul_sessions").select("*").in("course_id", ids).order("date"),
    ctx.db.from("okul_tasks").select("*").order("created_at"),
  ]);
  const rows = unwrap(assessments);
  const assessmentIds = rows.map((row) => row.id);
  const [prepDocs, meetings, log] =
    assessmentIds.length === 0
      ? [[], [], []]
      : await Promise.all([
          ctx.db.from("okul_prep_docs").select("*").in("assessment_id", assessmentIds).then(unwrap),
          ctx.db
            .from("okul_meetings")
            .select("*")
            .in("project_id", assessmentIds)
            .order("starts_at")
            .then(unwrap),
          ctx.db.from("okul_session_log").select("*").order("ended_at").then(unwrap),
        ]);
  return {
    term,
    courses,
    assessments: rows,
    sessions: unwrap(sessions),
    prepDocs,
    meetings,
    tasks: unwrap(tasks).filter((task) => task.course_id === null || ids.includes(task.course_id)),
    log,
  };
}

// --- Writes -------------------------------------------------------------------------------------

export async function insertTerm(ctx: ModuleContext, row: TablesInsert<"okul_terms">) {
  return unwrap(await ctx.db.from("okul_terms").insert(row).select().single());
}

export async function insertCourse(ctx: ModuleContext, row: TablesInsert<"okul_courses">) {
  return unwrap(await ctx.db.from("okul_courses").insert(row).select().single());
}

export async function getAssessment(ctx: ModuleContext, id: string): Promise<Assessment | null> {
  const { data, error } = await ctx.db
    .from("okul_assessments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function insertAssessment(
  ctx: ModuleContext,
  row: TablesInsert<"okul_assessments">,
): Promise<Assessment> {
  return unwrap(await ctx.db.from("okul_assessments").insert(row).select().single());
}

export async function updateAssessment(
  ctx: ModuleContext,
  id: string,
  patch: TablesUpdate<"okul_assessments">,
): Promise<Assessment> {
  return unwrap(await ctx.db.from("okul_assessments").update(patch).eq("id", id).select().single());
}

export async function deleteAssessment(ctx: ModuleContext, id: string): Promise<void> {
  check(await ctx.db.from("okul_assessments").delete().eq("id", id));
}

export async function getSession(ctx: ModuleContext, id: string): Promise<ClassSession | null> {
  const { data, error } = await ctx.db.from("okul_sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function insertSession(ctx: ModuleContext, row: TablesInsert<"okul_sessions">) {
  return unwrap(await ctx.db.from("okul_sessions").insert(row).select().single());
}

export async function updateSession(
  ctx: ModuleContext,
  id: string,
  patch: TablesUpdate<"okul_sessions">,
): Promise<ClassSession> {
  return unwrap(await ctx.db.from("okul_sessions").update(patch).eq("id", id).select().single());
}

export async function deleteSession(ctx: ModuleContext, id: string): Promise<void> {
  check(await ctx.db.from("okul_sessions").delete().eq("id", id));
}

export async function listClassNotes(ctx: ModuleContext, sessionId: string): Promise<ClassNote[]> {
  return unwrap(
    await ctx.db
      .from("okul_class_notes")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at"),
  );
}

export async function insertClassNote(ctx: ModuleContext, sessionId: string, text: string) {
  return unwrap(
    await ctx.db
      .from("okul_class_notes")
      .insert({ session_id: sessionId, text: text.trim() })
      .select()
      .single(),
  );
}

export async function markNoteConverted(ctx: ModuleContext, noteId: string, to: string) {
  check(await ctx.db.from("okul_class_notes").update({ converted_to: to }).eq("id", noteId));
}

export async function listPrepDocs(ctx: ModuleContext, assessmentId: string): Promise<PrepDoc[]> {
  return unwrap(await ctx.db.from("okul_prep_docs").select("*").eq("assessment_id", assessmentId));
}

/** Writes both documents of an exam at once (one row each, by output). */
export async function savePrepDocs(
  ctx: ModuleContext,
  assessmentId: string,
  patch: Omit<TablesInsert<"okul_prep_docs">, "assessment_id" | "output">,
): Promise<PrepDoc[]> {
  return unwrap(
    await ctx.db
      .from("okul_prep_docs")
      .upsert(
        (["topic", "practice"] as const).map((output) => ({
          assessment_id: assessmentId,
          output,
          ...patch,
        })),
        { onConflict: "assessment_id,output" },
      )
      .select(),
  );
}

export async function getMeeting(ctx: ModuleContext, id: string): Promise<Meeting | null> {
  const { data, error } = await ctx.db.from("okul_meetings").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function insertMeeting(ctx: ModuleContext, row: TablesInsert<"okul_meetings">) {
  return unwrap(await ctx.db.from("okul_meetings").insert(row).select().single());
}

export async function updateMeeting(
  ctx: ModuleContext,
  id: string,
  patch: TablesUpdate<"okul_meetings">,
): Promise<Meeting> {
  return unwrap(await ctx.db.from("okul_meetings").update(patch).eq("id", id).select().single());
}

export async function updateTask(
  ctx: ModuleContext,
  id: string,
  patch: TablesUpdate<"okul_tasks">,
) {
  return unwrap(await ctx.db.from("okul_tasks").update(patch).eq("id", id).select().single());
}

/** One row per core session; the second word on the same session changes nothing. */
export async function logSession(
  ctx: ModuleContext,
  row: TablesInsert<"okul_session_log">,
): Promise<void> {
  const { error } = await ctx.db
    .from("okul_session_log")
    .upsert(row, { onConflict: "user_id,session_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function logFor(ctx: ModuleContext, assessmentId: string): Promise<SessionLog[]> {
  return unwrap(
    await ctx.db
      .from("okul_session_log")
      .select("*")
      .eq("assessment_id", assessmentId)
      .order("ended_at"),
  );
}
