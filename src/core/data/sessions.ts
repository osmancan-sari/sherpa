import { type Db, type Session, unwrap } from "@/core/types";
import { dayKey, shiftDay } from "@/lib/date";

// Sessions: real time spent. Starting and ending go through database functions, so the task,
// the work item and the rhythm log change together with the session (see the migration).

export async function getOpenSession(db: Db): Promise<Session | null> {
  const { data, error } = await db.from("sessions").select("*").is("ended_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Sessions of the last `days` days, newest first. */
export async function listSessions(db: Db, now: Date, days = 56): Promise<Session[]> {
  return unwrap(
    await db
      .from("sessions")
      .select("*")
      .gte("started_at", `${shiftDay(dayKey(now), -days)}T00:00:00Z`)
      .order("started_at", { ascending: false }),
  );
}

export type SessionTarget =
  | { taskId: string }
  | { workItemId: string }
  | { rhythmId: string }
  /** Unplanned work: "Başka bir şey yapıyorum". The module is optional. */
  | { title: string; moduleId?: string | null };

/** Başla. Whatever was running is stopped first; two sessions never run at once. */
export async function startSession(db: Db, target: SessionTarget): Promise<Session> {
  return unwrap(
    await db.rpc("start_session", {
      p_task_id: "taskId" in target ? target.taskId : undefined,
      p_work_item_id: "workItemId" in target ? target.workItemId : undefined,
      p_rhythm_id: "rhythmId" in target ? target.rhythmId : undefined,
      p_title: "title" in target ? target.title : undefined,
      p_module_id: "title" in target ? (target.moduleId ?? undefined) : undefined,
    }),
  );
}

/**
 * Stops a session that is running on one of a work item's sittings, so that closing the item
 * never leaves a clock running on it and the time already spent is counted.
 */
export async function stopSessionsOnItem(db: Db, workItemId: string): Promise<void> {
  const open = await getOpenSession(db);
  if (!open?.task_id) return;
  const task = unwrap(
    await db.from("tasks").select("work_item_id").eq("id", open.task_id).single(),
  );
  if (task.work_item_id === workItemId) await endSession(db, open.id, "stopped");
}

/** "Devam ediyorum": the session runs past its time on purpose; asked again one estimate on. */
export async function confirmSession(db: Db, sessionId: string, now: Date): Promise<void> {
  const { error } = await db
    .from("sessions")
    .update({ confirmed_at: now.toISOString() })
    .eq("id", sessionId)
    .is("ended_at", null);
  if (error) throw new Error(error.message);
}

/** Nobody answered "Devam ediyor musun?": closed at its estimate, unmeasured. */
export async function closeUnanswered(db: Db, sessionId: string): Promise<Session> {
  return unwrap(await db.rpc("close_unanswered_session", { p_session_id: sessionId }));
}

/** Bitti ("done") or stop without finishing ("stopped"). */
export async function endSession(
  db: Db,
  sessionId: string,
  outcome: "done" | "stopped" = "done",
): Promise<Session> {
  return unwrap(await db.rpc("end_session", { p_session_id: sessionId, p_outcome: outcome }));
}
