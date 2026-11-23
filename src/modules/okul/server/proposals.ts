import type { WorkProposal } from "@/core/contract/types";
import { dayKey, END_OF_DAY, istanbulInstant, shiftDay } from "@/lib/date";
import type {
  Assessment,
  ClassSession,
  Course,
  Meeting,
  OkulTask,
  PrepDoc,
  TermData,
} from "../queries";
import { docDay } from "./derive";

// What the module proposes for each of its records (okul.md section 6; prompts/okul-adim-1.md,
// decisions 2–7). Pure: the records and the moment in, the envelopes and the keys to take back
// out. rules.ts sends them; the tests read them without a database.

/** The kinds of the module's work, as their `source.type` says them. */
export const SOURCE = {
  lesson: "okul.lesson",
  exam: "okul.exam",
  prep: "okul.prep",
  homework: "okul.homework",
  step: "okul.step",
  submit: "okul.submit",
  meeting: "okul.meeting",
  task: "okul.task",
} as const;

export const key = {
  lesson: (id: string) => `lesson:${id}`,
  exam: (id: string) => `exam:${id}`,
  prep: (id: string) => `prep:${id}`,
  homework: (id: string) => `hw:${id}`,
  step: (id: string) => `step:${id}`,
  submit: (id: string) => `submit:${id}`,
  meeting: (id: string) => `meeting:${id}`,
  task: (id: string) => `task:${id}`,
};

/** Every key an assessment may have proposed. */
export const assessmentKeys = (id: string) => [
  key.exam(id),
  key.prep(id),
  key.homework(id),
  key.step(id),
  key.submit(id),
];

/** A course's facet key: its code in lower case ("yzv406e"). */
export const facetOf = (course: Pick<Course, "code">) => course.code.toLowerCase();

/** A lesson without an end of its own lasts this long (the schedule gave only its start). */
export const LESSON_DEFAULT_MINUTES = 180;
/** An exam's preparation is due at this hour when the exam's own time is not known. */
export const EXAM_DEFAULT_TIME = "08:00";
/** A preparation's sittings: the longest the core gives (120 comes with package C). */
export const PREP_SITTING_MINUTES = 90;
/** The hand-in: a short work of its own (decision 5). */
export const SUBMIT_MINUTES = 10;
/** Until "Dokümanım hazır", a preparation may not start before this hour of the next day. */
export const DAY_TURN = "05:00";

const hhmm = (time: string | null) => (time ? time.slice(0, 5) : null);

/** The moment an assessment is due: its day and time, else the end of its day. */
export function deadlineOf(a: Pick<Assessment, "date" | "time">): Date | null {
  if (!a.date) return null;
  return istanbulInstant(a.date, hhmm(a.time) ?? END_OF_DAY);
}

/** The moment an exam begins: its day and time, else the morning of its day. */
export function examStartOf(a: Pick<Assessment, "date" | "time">): Date | null {
  if (!a.date) return null;
  return istanbulInstant(a.date, hhmm(a.time) ?? EXAM_DEFAULT_TIME);
}

/** The documents count as ready when both are ("Dokümanım hazır" writes both at once). */
export function docsReady(docs: PrepDoc[]): { ready: boolean; at: string | null } {
  const both = (["topic", "practice"] as const).map((output) =>
    docs.find((doc) => doc.output === output),
  );
  if (!both.every((doc) => doc?.status === "ready")) return { ready: false, at: null };
  const at = both
    .map((doc) => doc?.produced_at ?? null)
    .filter((value): value is string => value !== null)
    .sort()[0];
  return { ready: true, at: at ?? null };
}

/**
 * The moment an unmarked preparation may start: its document day, never earlier than the next
 * day's turn (the daily job moves it on each day, so a preparation without its documents never
 * opens a sitting: decision 2).
 */
export function waitingEarliest(kind: string, date: string, now: Date): Date {
  const tomorrow = shiftDay(dayKey(now), 1);
  const dd = docDay(kind, date) ?? tomorrow;
  return istanbulInstant(dd > tomorrow ? dd : tomorrow, DAY_TURN);
}

const isMine = (a: Pick<Assessment, "owner">) => a.owner === null || a.owner === "me";
const open = (a: Pick<Assessment, "status">) => a.status !== "done" && a.status !== "cancelled";

/** The ordered steps of a project (by date, then their place). */
export function stepsOf(project: Pick<Assessment, "id">, all: Assessment[]): Assessment[] {
  return all
    .filter((row) => row.parent_id === project.id && row.kind === "project_step")
    .sort(
      (a, b) =>
        (a.date ?? "9999").localeCompare(b.date ?? "9999") ||
        a.position - b.position ||
        a.created_at.localeCompare(b.created_at),
    );
}

/** A one-sentence reason a preparation's placeholder rests on ("Neden?"); at most 200. */
export function prepBasis(a: Assessment, ready: boolean): string {
  const weight = a.weight !== null ? `ağırlığı %${Number(a.weight)}` : "ağırlığı belli değil";
  return ready
    ? `Dokümanı elle hazır; süre ${weight} ve aynı dersin önceki sınavlarına göre kestirildi.`
    : `Doküman günü gelince oturumlar açılır; süre ${weight} ve aynı dersin önceki sınavlarına göre kestirildi.`;
}

export type Planned = { proposals: WorkProposal[]; withdraw: string[] };

type Context = { course: Course; facet: string };

function contextOf(data: TermData, courseId: string | null): Context | null {
  const course = data.courses.find((row) => row.id === courseId);
  return course ? { course, facet: facetOf(course) } : null;
}

/** What one assessment proposes and takes back. */
export function planAssessment(a: Assessment, data: TermData, now: Date): Planned {
  const proposals: WorkProposal[] = [];
  const keep = new Set<string>();
  const at = contextOf(data, a.course_id);
  const all = assessmentKeys(a.id);
  if (!at || !a.date || a.date_status === "unknown" || a.status === "cancelled") {
    return { proposals, withdraw: all };
  }
  const meta = { course: at.course.code, weight: a.weight === null ? null : Number(a.weight) };
  const deadline = deadlineOf(a)!;
  const future = deadline.getTime() > now.getTime();

  if (["quiz", "midterm", "final"].includes(a.kind)) {
    const start = examStartOf(a)!;
    // The exam itself: a fixed block once its day, hour and length are known (decision 3).
    if (a.time && a.duration_min && start.getTime() > now.getTime()) {
      keep.add(key.exam(a.id));
      proposals.push({
        schema: 1,
        key: key.exam(a.id),
        source: { type: SOURCE.exam, id: a.id },
        title: `${a.title} · ${at.course.name}`,
        when: {
          fixed: {
            starts_at: start.toISOString(),
            ends_at: new Date(start.getTime() + a.duration_min * 60_000).toISOString(),
            ...(a.room ? { location: a.room } : {}),
          },
        },
        facet: at.facet,
      });
    }
    // Its preparation: a load with a placeholder effort until "Dokümanım hazır" (decision 2).
    if (start.getTime() > now.getTime() && open(a)) {
      const docs = docsReady(data.prepDocs.filter((doc) => doc.assessment_id === a.id));
      const waiting = waitingEarliest(a.kind, a.date, now);
      const earliest = docs.ready
        ? new Date(docs.at ?? now.toISOString())
        : new Date(Math.min(waiting.getTime(), start.getTime()));
      keep.add(key.prep(a.id));
      proposals.push({
        schema: 1,
        key: key.prep(a.id),
        source: { type: SOURCE.prep, id: a.id },
        title: `${a.title} hazırlığı`,
        when: { due: start.toISOString(), hard: true, earliest: earliest.toISOString() },
        effort: {
          session_minutes: PREP_SITTING_MINUTES,
          provisional: true,
          basis: prepBasis(a, docs.ready),
        },
        fit: { energy: "deep", context: "desk" },
        importance: a.kind === "quiz" ? 2 : 3,
        facet: at.facet,
        meta: {
          ...meta,
          kind: "prep",
          exam: a.kind,
          doc_day: docDay(a.kind, a.date),
          docs_ready: docs.ready,
        },
      });
    }
  }

  const worked = a.kind === "homework" || a.kind === "project_step" || a.kind === "project";
  const isProject = a.kind === "project";
  const hasSteps = isProject && stepsOf(a, data.assessments).length > 0;
  if (worked && !hasSteps && isMine(a) && future && open(a) && !a.submitted_at) {
    const step = a.kind === "project_step";
    const workKey = step ? key.step(a.id) : key.homework(a.id);
    keep.add(workKey);
    // A step waits for the one before it of the user's (rule 13; only the user's are planned).
    const before = step ? previousMine(a, data) : null;
    proposals.push({
      schema: 1,
      key: workKey,
      source: { type: step ? SOURCE.step : SOURCE.homework, id: a.id },
      title: a.title,
      when: {
        due: deadline.toISOString(),
        hard: true,
        earliest: a.opens_on ? istanbulInstant(a.opens_on).toISOString() : null,
      },
      // The AI sizes it (`size`); a suggested step is a placeholder until it is known.
      ...(step && a.proposed ? { effort: { provisional: true } } : {}),
      fit: { energy: "deep", context: "desk" },
      ...(before ? { depends_on: [key.step(before.id)] } : {}),
      facet: at.facet,
      meta: { ...meta, kind: a.kind, output: a.output_kind },
    });
  }

  // The hand-in: a small work of its own, after the work (decision 5).
  if (worked && !hasSteps && isMine(a) && a.submits && !a.submitted_at && future) {
    if (a.status !== "cancelled") {
      const workKey = a.kind === "project_step" ? key.step(a.id) : key.homework(a.id);
      keep.add(key.submit(a.id));
      proposals.push({
        schema: 1,
        key: key.submit(a.id),
        source: { type: SOURCE.submit, id: a.id },
        title: `${a.title} teslimi`,
        when: { due: deadline.toISOString(), hard: true },
        effort: { total_minutes: SUBMIT_MINUTES, session_minutes: SUBMIT_MINUTES },
        fit: { energy: "light", context: "desk" },
        ...(keep.has(workKey) ? { depends_on: [workKey] } : {}),
        facet: at.facet,
        meta: { ...meta, kind: "submit" },
      });
    }
  }

  // What is not proposed now is taken back, except what a deadline that went by leaves standing:
  // the core keeps a late work as it is (product rule 2), the module does not re-send it.
  const withdraw = all.filter((k) => {
    if (keep.has(k)) return false;
    if (k === key.submit(a.id)) return Boolean(a.submitted_at) || !a.submits || !isMine(a);
    if (k === key.exam(a.id)) return !a.time || !a.duration_min;
    // A preparation ends with its exam: once the exam has begun it is taken back (never offered
    // after the exam), and when the exam is done.
    if (k === key.prep(a.id)) {
      const start = examStartOf(a);
      return a.status === "done" || (start !== null && start.getTime() <= now.getTime());
    }
    return a.status === "done" || Boolean(a.submitted_at) || !isMine(a) || hasSteps;
  });
  return { proposals, withdraw };
}

/** The step before this one that is the user's, of the same project. */
function previousMine(a: Assessment, data: TermData): Assessment | null {
  if (!a.parent_id) return null;
  const steps = stepsOf({ id: a.parent_id }, data.assessments);
  const index = steps.findIndex((row) => row.id === a.id);
  for (let i = index - 1; i >= 0; i--) {
    const before = steps[i];
    if (isMine(before) && before.date && open(before)) return before;
  }
  return null;
}

/** The hours of a session: its own, else its course's; the default length without an end. */
export function sessionHours(
  session: ClassSession,
  course: Course,
): { starts: Date; ends: Date } | null {
  const from = hhmm(session.start_time) ?? hhmm(course.start_time);
  if (!from) return null;
  const starts = istanbulInstant(session.date, from);
  const to = hhmm(session.end_time) ?? (session.start_time ? null : hhmm(course.end_time));
  const ends = to
    ? istanbulInstant(session.date, to)
    : new Date(starts.getTime() + LESSON_DEFAULT_MINUTES * 60_000);
  return { starts, ends: ends > starts ? ends : new Date(starts.getTime() + 60 * 60_000) };
}

/** The kinds of session a lesson block is proposed for (an exam's block is the exam's own). */
const LESSON_KINDS = ["lecture", "recitation", "presentation"];

/** A class session: a fixed block while it is ahead and takes place (decision 4). */
export function planSession(session: ClassSession, data: TermData, now: Date): Planned {
  const at = contextOf(data, session.course_id);
  const lessonKey = key.lesson(session.id);
  const hours = at ? sessionHours(session, at.course) : null;
  const proposable =
    at !== null &&
    hours !== null &&
    LESSON_KINDS.includes(session.kind) &&
    session.attendance !== "not_held" &&
    hours.ends.getTime() > now.getTime();
  if (!proposable) {
    // A session that went by stays as it was; one that will not take place is taken back.
    const gone =
      session.kind === "holiday" || session.kind === "exam" || session.attendance === "not_held";
    return { proposals: [], withdraw: gone || !at ? [lessonKey] : [] };
  }
  const recitation = session.kind === "recitation";
  return {
    proposals: [
      {
        schema: 1,
        key: lessonKey,
        source: { type: SOURCE.lesson, id: session.id },
        title: recitation ? `${at.course.name} · recitation` : at.course.name,
        when: {
          fixed: {
            starts_at: hours.starts.toISOString(),
            ends_at: hours.ends.toISOString(),
            ...((session.room ?? at.course.room)
              ? { location: session.room ?? at.course.room! }
              : {}),
          },
        },
        facet: at.facet,
      },
    ],
    withdraw: [],
  };
}

/** A team meeting: at its hour, for its length; a checklist on the scene (decision 6). */
export function planMeeting(meeting: Meeting, data: TermData, now: Date): Planned {
  const project = data.assessments.find((row) => row.id === meeting.project_id);
  const at = project ? contextOf(data, project.course_id) : null;
  const meetingKey = key.meeting(meeting.id);
  const ends = new Date(meeting.ends_at);
  if (!at || meeting.done || ends.getTime() <= now.getTime()) {
    return { proposals: [], withdraw: meeting.done || !at ? [meetingKey] : [] };
  }
  const minutes = Math.round((ends.getTime() - Date.parse(meeting.starts_at)) / 60_000);
  return {
    proposals: [
      {
        schema: 1,
        key: meetingKey,
        source: { type: SOURCE.meeting, id: meeting.id },
        title: meeting.title,
        when: { due: meeting.ends_at, hard: true, earliest: meeting.starts_at },
        effort: { total_minutes: minutes, session_minutes: minutes },
        facet: at.facet,
        meta: { course: at.course.code, kind: "meeting", project: project!.title },
      },
    ],
    withdraw: [],
  };
}

/** A follow-up or material task brought over from Notion: an independent work (decision 7). */
export function planTask(task: OkulTask, data: TermData): Planned {
  const taskKey = key.task(task.id);
  if (task.status !== "todo") return { proposals: [], withdraw: [taskKey] };
  const at = contextOf(data, task.course_id);
  return {
    proposals: [
      {
        schema: 1,
        key: taskKey,
        source: { type: SOURCE.task, id: task.id },
        title: task.title,
        when: { due: task.due_on ? istanbulInstant(task.due_on, END_OF_DAY).toISOString() : null },
        effort: { bounds: { min: 10, max: 60 } },
        ...(task.importance ? { importance: task.importance as 1 | 2 | 3 | 4 } : {}),
        facet: at?.facet ?? null,
        meta: { kind: "task", task: task.kind, course: at?.course.code ?? null },
      },
    ],
    withdraw: [],
  };
}

/** Everything of the term at once (the daily job, the import, switching the module on). */
export function planTerm(data: TermData, now: Date): Planned {
  const parts = [
    ...data.assessments.map((row) => planAssessment(row, data, now)),
    ...data.sessions.map((row) => planSession(row, data, now)),
    ...data.meetings.map((row) => planMeeting(row, data, now)),
    ...data.tasks.map((row) => planTask(row, data)),
  ];
  return {
    proposals: parts.flatMap((part) => part.proposals),
    withdraw: parts.flatMap((part) => part.withdraw),
  };
}
