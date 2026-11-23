import type { ModuleContext, Outcome, SizingActual, WorkProposal } from "@/core/contract/types";
import type { AppEvent, WorkItem } from "@/core/types";
import { dayKey } from "@/lib/date";
import {
  type Assessment,
  getAssessment,
  getMeeting,
  getSession,
  isExam,
  loadTerm,
  logSession,
  savePrepDocs,
  type TermData,
  updateAssessment,
  updateMeeting,
  updateSession,
  updateTask,
} from "./queries";
import { docDay } from "./server/derive";
import {
  assessmentKeys,
  key,
  planAssessment,
  planMeeting,
  type Planned,
  planSession,
  planTask,
  planTerm,
  SOURCE,
  stepsOf,
} from "./server/proposals";

// The module's rules (okul.md sections 5 and 6; prompts/okul-adim-1.md, decisions 2–9): what it
// proposes for its records, how "Dokümanım hazır" opens and closes a preparation, what it does
// when its work ends, and how it hears the core. The envelopes themselves: server/proposals.ts.

export const ATTENDANCE_PROMPT = "attendance";

// --- Settings -----------------------------------------------------------------------------------

export type Method = "pomodoro" | "flow";
export type WorkType = "reading" | "written" | "code";
export type OkulSettings = {
  /** The method per kind of work (decision 8): reading, written work and reports, code. */
  methods?: Partial<Record<WorkType, Method>>;
  /** Pomodoro lengths in minutes (frame SahneSureler): focus, short break, long break. */
  pomodoro?: { focus?: number; short?: number; long?: number };
  /** In the flow, a break reminder after this many minutes (okul.md 8.7). */
  flow_reminder?: number;
};

export const DEFAULT_METHODS: Record<WorkType, Method> = {
  reading: "pomodoro",
  written: "pomodoro",
  code: "flow",
};
export const DEFAULT_POMODORO = { focus: 25, short: 5, long: 15 };
export const DEFAULT_FLOW_REMINDER = 90;

export function settingsOf(ctx: Pick<ModuleContext, "module">): OkulSettings {
  return (ctx.module.settings ?? {}) as OkulSettings;
}

export function methodsOf(settings: OkulSettings): Record<WorkType, Method> {
  return { ...DEFAULT_METHODS, ...(settings.methods ?? {}) };
}

/** The work type of an assessment's work: its output (code → code; the rest written). */
export const workTypeOf = (output: string | null): WorkType =>
  output === "code" ? "code" : "written";

// --- Sending what the plan says ----------------------------------------------------------------

/**
 * Sends a plan: every proposal, one after the other, then the keys to take back. With `known`
 * (the whole term at once) only keys that stand open are taken back; a targeted change takes back
 * every key it names.
 */
async function apply(ctx: ModuleContext, plan: Planned, known?: Set<string>): Promise<void> {
  for (const proposal of plan.proposals) await ctx.propose(proposal);
  for (const k of plan.withdraw) {
    if (known && !known.has(k)) continue;
    await ctx.withdraw(k);
  }
}

/** The keys of the module's work items that are still open. */
async function openKeys(ctx: ModuleContext): Promise<Set<string>> {
  const items = await ctx.work.items();
  return new Set(
    items
      .filter((item) => item.status !== "done" && item.status !== "dropped" && item.key)
      .map((item) => item.key as string),
  );
}

/**
 * The whole term: every record proposed again (the daily job, the import, switching the module
 * on). Idempotent: an unchanged envelope changes nothing. A lesson that will not take place is
 * taken back when it is still ahead.
 */
export async function syncAll(ctx: ModuleContext): Promise<{ proposed: number }> {
  const data = await loadTerm(ctx);
  const now = ctx.now();
  const plan = planTerm(data, now);
  const known = await openKeys(ctx);
  const today = dayKey(now);
  for (const session of data.sessions) {
    if (session.date >= today) known.add(key.lesson(session.id));
  }
  await apply(ctx, plan, known);
  return { proposed: plan.proposals.length };
}

/** One assessment changed: it, the steps of its project and the work after it. */
export async function syncAssessment(ctx: ModuleContext, id: string): Promise<void> {
  const data = await loadTerm(ctx);
  const row = data.assessments.find((a) => a.id === id);
  if (!row) {
    await withdrawAssessment(ctx, id);
    return;
  }
  const now = ctx.now();
  const parent = row.parent_id ? data.assessments.find((a) => a.id === row.parent_id) : null;
  const project = row.kind === "project" ? row : parent;
  const family = project ? [project, ...stepsOf(project, data.assessments)] : [row];
  for (const member of family) await apply(ctx, planAssessment(member, data, now));
}

/** An assessment is gone: everything it proposed is taken back. */
export async function withdrawAssessment(ctx: ModuleContext, id: string): Promise<void> {
  for (const k of assessmentKeys(id)) await ctx.withdraw(k);
}

export async function syncSession(ctx: ModuleContext, id: string): Promise<void> {
  const data = await loadTerm(ctx);
  const session = data.sessions.find((row) => row.id === id);
  if (!session) {
    await ctx.withdraw(key.lesson(id));
    return;
  }
  await apply(ctx, planSession(session, data, ctx.now()));
}

export async function syncMeeting(ctx: ModuleContext, id: string): Promise<void> {
  const data = await loadTerm(ctx);
  const meeting = data.meetings.find((row) => row.id === id);
  if (!meeting) {
    await ctx.withdraw(key.meeting(id));
    return;
  }
  await apply(ctx, planMeeting(meeting, data, ctx.now()));
}

export async function syncTask(ctx: ModuleContext, id: string): Promise<void> {
  const data = await loadTerm(ctx);
  const task = data.tasks.find((row) => row.id === id);
  if (!task) {
    await ctx.withdraw(key.task(id));
    return;
  }
  await apply(ctx, planTask(task, data));
}

// --- "Dokümanım hazır" (decision 2; okul.md rule 7) ---------------------------------------------

/**
 * Marks an exam's documents as made by hand, or takes the mark away. On: both documents 'ready',
 * 'manual', no file; the preparation may start now and the core opens its sittings. Off: the
 * preparation is taken back (its open sittings dropped, a running one stopped; finished sittings
 * and the minutes worked stay) and proposed again at once with the same key, a load only.
 */
export async function setDocsReady(ctx: ModuleContext, id: string, on: boolean): Promise<void> {
  const exam = await getAssessment(ctx, id);
  if (!exam || !isExam(exam.kind)) throw new Error("okul: not an exam");
  if (on) {
    await savePrepDocs(ctx, id, {
      status: "ready",
      produced_by: "manual",
      produced_at: ctx.now().toISOString(),
      file_path: null,
      parts: null,
      missing: null,
      due_on: docDay(exam.kind, exam.date),
    });
  } else {
    await savePrepDocs(ctx, id, {
      status: "waiting",
      produced_by: null,
      produced_at: null,
      due_on: docDay(exam.kind, exam.date),
    });
    await ctx.withdraw(key.prep(id));
  }
  await syncAssessment(ctx, id);
}

// --- Writes the pages and scenes make -----------------------------------------------------------

/** A change of an assessment from the module's own pages; its work follows. */
export async function changeAssessment(
  ctx: ModuleContext,
  id: string,
  patch: Parameters<typeof updateAssessment>[2],
): Promise<Assessment> {
  const row = await updateAssessment(ctx, id, patch);
  await syncAssessment(ctx, id);
  return row;
}

/** "Yükledim": the hand-in is done by the user's word (decision 5). */
export async function markSubmitted(ctx: ModuleContext, id: string): Promise<void> {
  await updateAssessment(ctx, id, {
    submitted_at: ctx.now().toISOString(),
    submit_source: "user",
    status: "done",
  });
}

/** The answer to "Derse girdin mi?", from the lesson's view or from Today: one record. */
export async function setAttendance(
  ctx: ModuleContext,
  sessionId: string,
  value: "attended" | "missed" | "not_held",
): Promise<void> {
  await updateSession(ctx, sessionId, {
    attendance: value,
    attendance_at: ctx.now().toISOString(),
  });
  // A session that did not take place leaves the plan (its block is taken back).
  await syncSession(ctx, sessionId);
}

// --- What the module learned of its own work ---------------------------------------------------

type EndedPayload = {
  session_id?: string;
  source?: { type?: string | null; id?: string | null };
  result?: string;
  minutes?: number;
  counted?: number | null;
  ended_at?: string;
};

const ROLE: Record<string, "prep" | "homework" | "step" | "submit" | "meeting" | "task"> = {
  [SOURCE.prep]: "prep",
  [SOURCE.homework]: "homework",
  [SOURCE.step]: "step",
  [SOURCE.submit]: "submit",
  [SOURCE.meeting]: "meeting",
  [SOURCE.task]: "task",
};

/**
 * A session of the module's work ended. Its minutes are logged once per session (decision 9: the
 * scene's counted minutes, else the wall clock's; the layout's state is read by the scene, which
 * tells them through `controls.finish(counted)`). A homework or step whose hand-in was finished
 * on the scene, and a hand-in that was uploaded, are closed: the module takes back its own work.
 */
async function sessionEnded(event: AppEvent, ctx: ModuleContext): Promise<void> {
  const payload = event.payload as EndedPayload;
  const type = payload.source?.type ?? "";
  const id = payload.source?.id ?? null;
  const role = ROLE[type];
  if (!role || !id || !payload.session_id) return;
  const minutes = Math.max(0, Math.round(payload.counted ?? payload.minutes ?? 0));
  const assessmentId = role === "meeting" || role === "task" ? null : id;
  await logSession(ctx, {
    session_id: payload.session_id,
    assessment_id: assessmentId,
    role,
    minutes,
    result: payload.result ?? null,
    ended_at: payload.ended_at ?? ctx.now().toISOString(),
  });
  if (payload.result !== "done") return;
  if (role === "meeting") {
    const meeting = await getMeeting(ctx, id);
    if (meeting && isChecklistDone(meeting.checklist_state, payload.session_id)) {
      await updateMeeting(ctx, id, { done: true });
      await ctx.withdraw(key.meeting(id));
    }
    return;
  }
  if (!assessmentId) return;
  const row = await getAssessment(ctx, assessmentId);
  if (!row) return;
  if (row.submitted_at) {
    // Uploaded (on this scene or another): the work and its hand-in are over.
    await ctx.withdraw(key.submit(row.id));
    if (role !== "prep")
      await ctx.withdraw(role === "step" ? key.step(row.id) : key.homework(row.id));
    return;
  }
  // "Bitti" on the work's last sitting opened the hand-in list on the same scene; "Sonra yap"
  // closed it: the work is done, its hand-in stays open (decision 5).
  const list = row.checklist_state as { session?: string; work_done?: boolean } | null;
  if (
    (role === "homework" || role === "step") &&
    list?.work_done &&
    list.session === payload.session_id
  ) {
    await updateAssessment(ctx, row.id, { status: "done" });
    await ctx.withdraw(role === "step" ? key.step(row.id) : key.homework(row.id));
  }
}

/** A checklist kept by the module is finished for this session. */
function isChecklistDone(state: unknown, sessionId: string): boolean {
  const list = state as { session?: string; finished?: boolean } | null;
  return Boolean(list?.finished && list.session === sessionId);
}

/** The core closed one of the module's works (done or dropped): the record follows. */
export async function onOutcome(outcome: Outcome, ctx: ModuleContext): Promise<void> {
  const type = outcome.source.type ?? "";
  const id = outcome.source.id;
  if (!id || outcome.result !== "done") return;
  if (type === SOURCE.homework || type === SOURCE.step) {
    await updateAssessment(ctx, id, { status: "done" });
  } else if (type === SOURCE.submit) {
    const row = await getAssessment(ctx, id);
    if (row && !row.submitted_at) await markSubmitted(ctx, id);
  } else if (type === SOURCE.meeting) {
    await updateMeeting(ctx, id, { done: true });
  } else if (type === SOURCE.task) {
    await updateTask(ctx, id, { status: "done" });
  }
}

/**
 * What the same course's finished work really took, for the AI's estimate (`sizingActuals`): for a
 * preparation the course's earlier exams, for a homework or step its earlier homework and steps.
 * At most ten; the module's own minutes (decision 9).
 */
export async function sizingActuals(item: WorkItem, ctx: ModuleContext): Promise<SizingActual[]> {
  if (!item.source_id) return [];
  const data = await loadTerm(ctx);
  const own = data.assessments.find((row) => row.id === item.source_id);
  if (!own) return [];
  const prep = item.source_type === SOURCE.prep;
  const family = (row: Assessment) =>
    prep ? isExam(row.kind) : ["homework", "project_step", "project"].includes(row.kind);
  const spent = new Map<string, number>();
  for (const line of data.log) {
    if (!line.assessment_id || line.role === "submit") continue;
    if ((line.role === "prep") !== prep) continue;
    spent.set(line.assessment_id, (spent.get(line.assessment_id) ?? 0) + line.minutes);
  }
  return data.assessments
    .filter(
      (row) =>
        row.id !== own.id &&
        row.course_id === own.course_id &&
        family(row) &&
        (spent.get(row.id) ?? 0) > 0 &&
        (row.status === "done" || (row.date !== null && row.date < dayKey(ctx.now()))),
    )
    .slice(-10)
    .map((row) => ({
      title: prep ? `${row.title} hazırlığı` : row.title,
      minutes: spent.get(row.id) as number,
    }));
}

/** The effort hints the AI reads for every proposal of the module (`sizingHints`). */
export const SIZING_HINTS = [
  "Okul işleri: sınav hazırlığı (quiz, midterm, final), ödev, proje adımı, teslim.",
  "Hazırlık süresi sınavın ağırlığına (meta.weight, yüzde) ve türüne göre değişir: quiz birkaç saat, midterm ve final daha uzun.",
  "Ödevde meta.output 'code' ise kodlama, 'written' ya da 'report' ise yazılı iştir.",
  "Aynı dersin önceki gerçekleşen süreleri verildiyse onlara dayan.",
].join(" ");

// --- Listeners ----------------------------------------------------------------------------------

export const listeners: Record<string, (event: AppEvent, ctx: ModuleContext) => Promise<void>> = {
  "core.session_ended": sessionEnded,
  // The answer to "Derse girdin mi?" asked on Today (the lesson's view writes the same record).
  "core.prompt_answered": async (event, ctx) => {
    const payload = event.payload as {
      module?: string;
      kind?: string;
      subject_id?: string | null;
      value?: string;
    };
    if (payload.module !== ctx.module.slug || payload.kind !== ATTENDANCE_PROMPT) return;
    if (!payload.subject_id) return;
    const value = payload.value;
    if (value !== "attended" && value !== "missed" && value !== "not_held") return;
    const session = await getSession(ctx, payload.subject_id);
    if (!session || session.attendance) return;
    await setAttendance(ctx, session.id, value);
  },
};

// --- Attendance questions (the hourly job) -----------------------------------------------------

export const ATTENDANCE_OPTIONS = [
  { value: "attended", label: "Girdim" },
  { value: "missed", label: "Girmedim" },
  { value: "not_held", label: "Yapılmadı" },
];

/**
 * "Derse girdin mi?" on Today for a lesson of a course with an attendance condition that ended in
 * the last twelve hours, when its view was not opened and it was not answered (rule 15).
 */
export async function askAttendance(ctx: ModuleContext, data?: TermData): Promise<number> {
  const term = data ?? (await loadTerm(ctx));
  const now = ctx.now().getTime();
  let asked = 0;
  for (const session of term.sessions) {
    if (session.attendance || session.viewed_at || session.asked_at) continue;
    if (!["lecture", "recitation", "presentation"].includes(session.kind)) continue;
    const course = term.courses.find((row) => row.id === session.course_id);
    if (!course || (course.absence_limit === null && course.attendance_min_pct === null)) continue;
    const plan = planSession(session, term, new Date(0));
    const block = plan.proposals[0]?.when as { fixed?: { ends_at: string } } | undefined;
    const ends = block?.fixed ? Date.parse(block.fixed.ends_at) : null;
    if (ends === null || ends > now || now - ends > 12 * 3_600_000) continue;
    await ctx.ask({
      kind: ATTENDANCE_PROMPT,
      question: `${course.name}: derse girdin mi?`,
      options: ATTENDANCE_OPTIONS,
      subject: { type: SOURCE.lesson, id: session.id },
    });
    await updateSession(ctx, session.id, { asked_at: ctx.now().toISOString() });
    asked += 1;
  }
  return asked;
}

/** The proposal's kind as the module wrote it in `meta` (the scenes and cards read it). */
export const kindOfProposal = (proposal: WorkProposal) =>
  (proposal.meta as { kind?: string } | undefined)?.kind ?? null;
