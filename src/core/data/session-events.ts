import { taskFacet } from "@/core/contract/facets";
import type { ModuleRegistry, ProposalResult } from "@/core/contract/types";
import { CORE_EVENTS, emitEvent } from "@/core/events/bus";
import type { Db, Session } from "@/core/types";
import {
  closeUnanswered,
  endSession,
  getOpenSession,
  type PlannedTarget,
  type SessionTarget,
  startSession,
  startSessionIfIdle,
} from "./sessions";
import { completeTask, dropTask } from "./work";

// Session and day events (docs/06-modul-sozlesmesi.md, "Olaylar"; Ç3c). Every way a session
// starts or ends goes through here, so the work's module hears of it: started, and ended as
// done, stopped, deferred, stuck or unanswered. Only the work's own module hears its sessions;
// the day's waking and bedtime go to every active module. Telling never fails the action: a
// session is real whether or not the event could be written.

export type SessionResult = "done" | "stopped" | "deferred" | "stuck" | "unanswered";

export type Told = {
  db: Db;
  registry: ModuleRegistry;
  now?: () => Date;
  /** The listeners' proposals, on the server (Ç3d; see createModuleContext). */
  onProposed?: (result: ProposalResult) => Promise<void>;
};

async function tell(
  { db, registry, now, onProposed }: Told,
  type: string,
  payload: Record<string, unknown>,
  to?: string | null,
): Promise<void> {
  try {
    await emitEvent({ db, registry, type, payload, moduleSlug: null, now, to, onProposed });
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
  // Ç3e: the work's facet; a sitting without its own has its work item's.
  let facet: string | null = null;
  if (session.task_id) {
    const { data } = await db
      .from("tasks")
      .select("source_type, source_id, facet, work_item_id")
      .eq("id", session.task_id)
      .maybeSingle();
    if (data) {
      source = { type: data.source_type, id: data.source_id };
      const item =
        data.facet === null && data.work_item_id
          ? (await db.from("work_items").select("facet").eq("id", data.work_item_id).maybeSingle())
              .data
          : null;
      facet = taskFacet(data, item);
    }
  } else if (session.rhythm_id) {
    const { data } = await db
      .from("rhythms")
      .select("source_type, source_id, facet")
      .eq("id", session.rhythm_id)
      .maybeSingle();
    if (data) {
      source = { type: data.source_type, id: data.source_id };
      facet = data.facet;
    }
  }
  return { slug, source, facet };
}

function basePayload(session: Session, owner: Awaited<ReturnType<typeof ownerOf>>) {
  return {
    module: owner.slug,
    session_id: session.id,
    task_id: session.task_id,
    rhythm_id: session.rhythm_id,
    source: owner.source,
    facet: owner.facet,
    started_at: session.started_at,
  };
}

export async function tellStarted(told: Told, session: Session): Promise<void> {
  const owner = await ownerOf(told.db, session);
  await tell(told, CORE_EVENTS.sessionStarted, basePayload(session, owner), owner.slug);
}

export async function tellEnded(
  told: Told,
  session: Session,
  result: SessionResult,
): Promise<void> {
  if (!session.ended_at) return;
  const owner = await ownerOf(told.db, session);
  const minutes = Math.max(
    0,
    Math.round((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60_000),
  );
  await tell(
    told,
    CORE_EVENTS.sessionEnded,
    {
      ...basePayload(session, owner),
      ended_at: session.ended_at,
      result,
      minutes,
      measured: session.measured,
    },
    owner.slug,
  );
}

async function sessionRow(db: Db, id: string): Promise<Session | null> {
  return (await db.from("sessions").select("*").eq("id", id).maybeSingle()).data;
}

/** Başla. A session still running elsewhere is stopped by it: told as "stopped". */
export async function startSessionTold(told: Told, target: SessionTarget): Promise<Session> {
  // The start goes out first (no round trip before it). The session it stopped, if any, ended
  // in the same transaction: its end is the new one's start, to the microsecond.
  const session = await startSession(told.db, target);
  const { data: stopped } = await told.db
    .from("sessions")
    .select("*")
    .eq("ended_at", session.started_at)
    .neq("id", session.id);
  for (const ended of stopped ?? []) await tellEnded(told, ended, "stopped");
  await tellStarted(told, session);
  return session;
}

/** Ç3f: the chain's own start (see startSessionIfIdle); told like any start when it happens. */
export async function startSessionIfIdleTold(
  told: Told,
  since: string,
  target: PlannedTarget,
): Promise<Session | null> {
  const session = await startSessionIfIdle(told.db, since, target);
  if (session) await tellStarted(told, session);
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
  return (await endSessionClosing(told, sessionId, outcome, result)).session;
}

/**
 * The same, saying whether this call closed it (Ç3f): a session already ended elsewhere (Durdur
 * on the phone, then a Bitti from a screen that had not caught up) is not this Bitti's, and the
 * chain does not go on from it.
 */
export async function endSessionClosing(
  told: Told,
  sessionId: string,
  outcome: "done" | "stopped",
  result: SessionResult = outcome,
): Promise<{ session: Session; closed: boolean }> {
  const before = await sessionRow(told.db, sessionId);
  const ended = await endSession(told.db, sessionId, outcome);
  const closed = Boolean(before && !before.ended_at);
  if (closed) await tellEnded(told, ended, result);
  return { session: ended, closed };
}

/**
 * Ç3f: the chain's next work after one that ended here. A failure to start it is not the end's:
 * the end is written, the screen re-reads what is true (another screen may have started or
 * closed the next work).
 */
export async function goOnInChain(
  told: Told,
  ended: { session: Session; closed: boolean },
  next: PlannedTarget | null | undefined,
): Promise<Session | null> {
  if (!next || !ended.closed || !ended.session.ended_at) return null;
  try {
    return await startSessionIfIdleTold(told, ended.session.ended_at, next);
  } catch {
    return null;
  }
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

/** "Bırak": a session running on the task is stopped (told "stopped"), then the task is dropped. */
export async function dropTaskTold(told: Told, taskId: string) {
  const open = await getOpenSession(told.db);
  if (open?.task_id === taskId) await endSessionTold(told, open.id, "stopped");
  return dropTask(told.db, taskId);
}

/**
 * A session running on one of an item's sittings is stopped: the item is being closed. Told as
 * "done" when the item is finished (its sitting is done with it), else "stopped".
 */
export async function stopSessionsOnItemTold(
  told: Told,
  workItemId: string,
  result: "done" | "stopped" = "stopped",
): Promise<void> {
  const open = await getOpenSession(told.db);
  if (!open?.task_id) return;
  const { data: task } = await told.db
    .from("tasks")
    .select("work_item_id")
    .eq("id", open.task_id)
    .single();
  if (task?.work_item_id === workItemId) await endSessionTold(told, open.id, "stopped", result);
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

/**
 * Rutin 1: a scene's bedtime was taken back. Every module hears the day open again, and the
 * work's module hears its session start again (the same `session_id`: it goes on where it was).
 */
export async function tellBedUndone(
  told: Told,
  day: { date: string; sessionId: string },
): Promise<void> {
  await tell(told, CORE_EVENTS.bedUndone, { date: day.date });
  const session = await sessionRow(told.db, day.sessionId);
  if (session && !session.ended_at) await tellStarted(told, session);
}
