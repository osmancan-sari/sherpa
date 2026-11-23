import type { ModuleContext } from "@/core/contract/types";
import { dayKey, istanbulInstant } from "@/lib/date";
import {
  type Assessment,
  type Course,
  insertAssessment,
  insertClassNote,
  insertMeeting,
  loadTerm,
  markNoteConverted,
  type TermData,
  updateAssessment,
} from "../queries";
import {
  changeAssessment,
  markSubmitted,
  setAttendance,
  setDocsReady,
  syncAssessment,
  syncMeeting,
  withdrawAssessment,
} from "../rules";
import { readSentence } from "./sentence";

// The module's entries (okul.md section 7): every one is at most two touches or one sentence.
// The pages call these directly; quick add reaches them through `intake` (module.ts), where the
// course and the assessment are named in words and found here.

const fold = (text: string) => text.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();

/** A course named by its code or a part of its name ("yzv406", "robotik"). */
export function findCourse(data: TermData, text: unknown): Course | null {
  if (typeof text !== "string" || !text.trim()) return null;
  const wanted = fold(text).replace(/\s/g, "");
  return (
    data.courses.find((course) => fold(course.code).replace(/\s/g, "") === wanted) ??
    data.courses.find((course) => fold(course.code).startsWith(wanted)) ??
    data.courses.find((course) => fold(course.name).includes(fold(text))) ??
    null
  );
}

/** An assessment named by its title, the nearest ahead first when two share it. */
export function findAssessment(data: TermData, text: unknown, course?: Course | null) {
  if (typeof text !== "string" || !text.trim()) return null;
  const wanted = fold(text);
  const rows = data.assessments
    .filter((row) => !course || row.course_id === course.id)
    .filter((row) => fold(row.title) === wanted || fold(row.title).includes(wanted));
  const today = dayKey(new Date());
  return (
    rows.find((row) => fold(row.title) === wanted && (row.date ?? "9999") >= today) ??
    rows.find((row) => fold(row.title) === wanted) ??
    rows[0] ??
    null
  );
}

const KIND_VALUES = [
  "quiz",
  "midterm",
  "final",
  "homework",
  "project",
  "project_step",
  "presentation",
] as const;
type Kind = (typeof KIND_VALUES)[number];

/** A new assessment, from one sentence or the short form; its date is the user's (rule 1). */
export async function addAssessment(
  ctx: ModuleContext,
  input: {
    courseId: string;
    sentence?: string;
    title?: string;
    kind?: string | null;
    date?: string | null;
    time?: string | null;
    weight?: number | null;
    duration?: number | null;
    fromNote?: string | null;
  },
): Promise<Assessment> {
  const read = input.sentence ? readSentence(input.sentence, ctx.now()) : null;
  const title = (input.title ?? read?.title ?? "").trim();
  if (!title) throw new Error("okul: an assessment needs a title");
  const kindText = input.kind ?? read?.kind ?? "homework";
  const kind: Kind = (KIND_VALUES as readonly string[]).includes(kindText)
    ? (kindText as Kind)
    : "homework";
  const date = input.date ?? read?.date ?? null;
  const time = input.time ?? read?.time ?? null;
  const row = await insertAssessment(ctx, {
    course_id: input.courseId,
    title,
    kind,
    date,
    time,
    weight: input.weight ?? null,
    duration_min: input.duration ?? null,
    date_status: date ? "exact" : "unknown",
    date_source: date ? "user" : null,
    output_kind: kind === "homework" || kind === "project_step" ? "written" : null,
    submits: kind === "homework" || kind === "project" || kind === "project_step",
  });
  if (input.fromNote) await markNoteConverted(ctx, input.fromNote, row.id);
  await syncAssessment(ctx, row.id);
  return row;
}

/** A new date by the user's hand: it is theirs and no source overwrites it (rule 1). */
export async function updateDate(
  ctx: ModuleContext,
  id: string,
  date: string | null,
  time?: string | null,
): Promise<void> {
  await changeAssessment(ctx, id, {
    date,
    ...(time !== undefined ? { time } : {}),
    date_status: date ? "exact" : "unknown",
    date_source: "user",
    date_basis: null,
  });
}

/** A score by hand (rule 16): it is the user's and Kepler never overwrites it. */
export async function setGrade(ctx: ModuleContext, id: string, score: number | null) {
  await updateAssessment(ctx, id, { score, score_source: score === null ? null : "user" });
}

/** A step of a project: added, renamed, given to someone, or removed (`step_edit`). */
export async function addStep(
  ctx: ModuleContext,
  projectId: string,
  input: {
    title: string;
    date?: string | null;
    owner?: "me" | "other" | "none";
    ownerName?: string;
  },
): Promise<Assessment> {
  const data = await loadTerm(ctx);
  const project = data.assessments.find((row) => row.id === projectId);
  if (!project) throw new Error("okul: no such project");
  const siblings = data.assessments.filter((row) => row.parent_id === projectId);
  const row = await insertAssessment(ctx, {
    course_id: project.course_id,
    parent_id: projectId,
    title: input.title.trim(),
    kind: "project_step",
    date: input.date ?? null,
    date_status: input.date ? "exact" : "unknown",
    date_source: input.date ? "user" : null,
    owner: input.owner ?? "me",
    owner_name: input.ownerName ?? null,
    position: siblings.reduce((max, row) => Math.max(max, row.position), 0) + 1,
    output_kind: "written",
    submits: false,
  });
  await syncAssessment(ctx, row.id);
  return row;
}

export async function editStep(
  ctx: ModuleContext,
  id: string,
  patch: {
    title?: string;
    owner?: "me" | "other" | "none";
    owner_name?: string | null;
    status?: Assessment["status"];
  },
): Promise<void> {
  await changeAssessment(ctx, id, {
    ...patch,
    ...(patch.title ? { title: patch.title.trim() } : {}),
    // A step the user touched is no longer only a suggestion.
    proposed: false,
  });
}

export async function removeAssessment(ctx: ModuleContext, id: string): Promise<void> {
  await withdrawAssessment(ctx, id);
  const { error } = await ctx.db.from("okul_assessments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** A team meeting of a project at an hour, for up to 90 minutes (decision 6). */
export async function addMeeting(
  ctx: ModuleContext,
  projectId: string,
  input: { title?: string; day: string; time: string; minutes: number },
) {
  const starts = istanbulInstant(input.day, input.time);
  const minutes = Math.max(10, Math.min(90, Math.round(input.minutes)));
  const row = await insertMeeting(ctx, {
    project_id: projectId,
    title: input.title?.trim() || "Takım toplantısı",
    starts_at: starts.toISOString(),
    ends_at: new Date(starts.getTime() + minutes * 60_000).toISOString(),
  });
  await syncMeeting(ctx, row.id);
  return row;
}

/** A sentence written in class. */
export async function addClassNote(ctx: ModuleContext, sessionId: string, text: string) {
  return insertClassNote(ctx, sessionId, text);
}

export { markSubmitted, setAttendance, setDocsReady };
