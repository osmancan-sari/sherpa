import type { ModuleRegistry } from "@/core/contract/types";
import { CORE_EVENTS, emitEvent } from "@/core/events/bus";
import type { Db, Session } from "@/core/types";
import {
  closeUnanswered,
  endSession,
  getOpenSession,
  type SessionTarget,
  startSession,
} from "./sessions";
import { completeTask } from "./work";

// Session and day events (docs/06-modul-sozlesmesi.md, "Olaylar"; Ç3c). Every way a session
// starts or ends goes through here, so the work's module hears of it: started, and ended as
// done, stopped, deferred, stuck or unanswered. Only the work's own module hears its sessions;
// the day's waking and bedtime go to every active module. Telling never fails the action: a
// session is real whether or not the event could be written.

export type SessionResult = "done" | "stopped" | "deferred" | "stuck" | "unanswered";

type Told = { db: Db; registry: ModuleRegistry; now?: () => Date };

async function tell(
  { db, registry, now }: Told,
  type: string,
  payload: Record<string, unknown>,
  to?: string | null,
): Promise<void> {
  try {
    await emitEvent({ db, registry, type, payload, moduleSlug: null, now, to });
  } catch {
    // The event table could not be written: the session stands; nothing to undo.
  }
}

/** The session's module (slug) and the source of its work, for its events. */
async function ownerOf(db: Db, session: Session) {
  const slug = session.module_id
    ? ((await db.from("modules").select("slug").eq("id", session.module_id).maybeSingle()).data
        ?.slug ?? null)
    : null;
  let source: { type: string | null; id: string | null } = { type: null, id: null };
  if (session.task_id) {
    const { data } = await db
      .from("tasks")
      .select("source_type, source_id")
      .eq("id", session.task_id)
      .maybeSingle();
    if (data) source = { type: data.source_type, id: data.source_id };
  } else if (session.rhythm_id) {
    const { data } = await db
      .from("rhythms")
      .select("source_type, source_id")
      .eq("id", session.rhythm_id)
      .maybeSingle();
    if (data) source = { type: data.source_type, id: data.source_id };
  }
  return { slug, source };
}

function basePayload(session: Session, slug: string | null, source: unknown) {
  return {
    module: slug,
    session_id: session.id,
    task_id: session.task_id,
    rhythm_id: session.rhythm_id,
    source,
    started_at: session.started_at,
  };
}

export async function tellStarted(told: Told, session: Session): Promise<void> {
  const { slug, source } = await ownerOf(told.db, session);
  await tell(told, CORE_EVENTS.sessionStarted, basePayload(session, slug, source), slug);
}

export async function tellEnded(
  told: Told,
  session: Session,
  result: SessionResult,
): Promise<void> {
  if (!session.ended_at) return;
  const { slug, source } = await ownerOf(told.db, session);
  const minutes = Math.max(
    0,
    Math.round((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60_000),
  );
  await tell(
    told,
    CORE_EVENTS.sessionEnded,
    {
      ...basePayload(session, slug, source),
      ended_at: session.ended_at,
      result,
      minutes,
      measured: session.measured,
    },
    slug,
  );
}

async function sessionRow(db: Db, id: string): Promise<Session | null> {
  return (await db.from("sessions").select("*").eq("id", id).maybeSingle()).data;
}

/** Başla. A session still running elsewhere is stopped by it: told as "stopped". */
export async function startSessionTold(told: Told, target: SessionTarget): Promise<Session> {
  const before = await getOpenSession(told.db);
  const session = await startSession(told.db, target);
  if (before && before.id !== session.id) {
    const ended = await sessionRow(told.db, before.id);
    if (ended) await tellEnded(told, ended, "stopped");
  }
  await tellStarted(told, session);
  return session;
}

/**
 * Ends a session: Bitti ("done"), Durdur ("stopped"), and the ways it is stopped for something
 * else (Ertele: "deferred", Takıldım: "stuck"). One already ended (by the other screen) is not
 * told twice.
 */
export async function endSessionTold(
  told: Told,
  sessionId: string,
  outcome: "done" | "stopped",
  result: SessionResult = outcome,
): Promise<Session> {
  const before = await sessionRow(told.db, sessionId);
  const ended = await endSession(told.db, sessionId, outcome);
  if (before && !before.ended_at) await tellEnded(told, ended, result);
  return ended;
}

/** "Devam ediyor musun?" went unanswered: closed at its estimate, unmeasured. */
export async function closeUnansweredTold(told: Told, sessionId: string): Promise<Session> {
  const before = await sessionRow(told.db, sessionId);
  const closed = await closeUnanswered(told.db, sessionId);
  if (before && !before.ended_at) await tellEnded(told, closed, "unanswered");
  return closed;
}

/** One tap "Bitti" on a task: a session running on it ends as done. */
export async function completeTaskTold(told: Told, taskId: string) {
  const open = await getOpenSession(told.db);
  const task = await completeTask(told.db, taskId);
  if (open?.task_id === taskId) {
    const ended = await sessionRow(told.db, open.id);
    if (ended) await tellEnded(told, ended, "done");
  }
  return task;
}

/** A session running on one of an item's sittings is stopped (the item is being closed). */
export async function stopSessionsOnItemTold(told: Told, workItemId: string): Promise<void> {
  const open = await getOpenSession(told.db);
  if (!open?.task_id) return;
  const { data: task } = await told.db
    .from("tasks")
    .select("work_item_id")
    .eq("id", open.task_id)
    .single();
  if (task?.work_item_id === workItemId) await endSessionTold(told, open.id, "stopped");
}

/** The day began: its waking was recorded (said, or estimated from the first touch). */
export async function tellDayStarted(
  told: Told,
  day: { date: string; wokeAt: string; estimated: boolean },
): Promise<void> {
  await tell(told, CORE_EVENTS.dayStarted, {
    date: day.date,
    woke_at: day.wokeAt,
    estimated: day.estimated,
  });
}

/** The day ended: tonight's bedtime was recorded. */
export async function tellDayClosed(
  told: Told,
  day: { date: string; bedAt: string },
): Promise<void> {
  await tell(told, CORE_EVENTS.dayClosed, { date: day.date, bed_at: day.bedAt });
}
