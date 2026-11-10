import { markUserEdited } from "@/core/contract/envelope";
import {
  check,
  type Db,
  type Provenance,
  type Rhythm,
  type RhythmLog,
  type Task,
  TASK_DEFAULT_MINUTES,
  unwrap,
  type WorkItem,
} from "@/core/types";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import { dayKey, shiftDay } from "@/lib/date";

// Tasks, work items and rhythms: the user's own creating, editing and status changes.
// Modules do not call these; they propose (propose.ts).

// --- Tasks -----------------------------------------------------------------------------------

/** Open tasks, plus the ones finished in the last two days (for the "done today" line). */
export async function listTasks(db: Db, now: Date): Promise<Task[]> {
  const since = shiftDay(dayKey(now), -2);
  return unwrap(
    await db
      .from("tasks")
      .select("*")
      .or(`status.in.(todo,doing,waiting),done_at.gte.${since}T00:00:00Z`)
      .order("created_at"),
  );
}

export type NewTask = Pick<TablesInsert<"tasks">, "module_id" | "title"> &
  Partial<
    Pick<
      TablesInsert<"tasks">,
      | "id"
      | "est_minutes"
      | "due_at"
      | "planned_date"
      | "energy"
      | "context"
      | "importance"
      | "kind"
      | "work_item_id"
      | "meta"
    >
  >;

export async function createTask(db: Db, task: NewTask): Promise<Task> {
  return unwrap(
    await db
      .from("tasks")
      .insert({ est_minutes: TASK_DEFAULT_MINUTES, ...task, title: task.title.trim() })
      .select()
      .single(),
  );
}

export async function updateTask(db: Db, id: string, patch: TablesUpdate<"tasks">): Promise<Task> {
  return unwrap(await db.from("tasks").update(patch).eq("id", id).select().single());
}

/** One tap: done. A session running on the task is closed with it. */
export async function completeTask(db: Db, id: string): Promise<Task> {
  return unwrap(await db.rpc("complete_task", { p_task_id: id }));
}

/** Back to the pool: a task that was marked done by mistake. */
export async function reopenTask(db: Db, id: string): Promise<Task> {
  return updateTask(db, id, { status: "todo", done_at: null });
}

// --- Work items ------------------------------------------------------------------------------

/** Work items that are still open. */
export async function listWorkItems(db: Db): Promise<WorkItem[]> {
  return unwrap(
    await db
      .from("work_items")
      .select("*")
      .in("status", ["proposed", "active", "waiting"])
      .order("created_at"),
  );
}

export type NewWorkItem = Pick<TablesInsert<"work_items">, "module_id" | "title"> &
  Partial<
    Pick<
      TablesInsert<"work_items">,
      | "id"
      | "due_at"
      | "due_is_hard"
      | "earliest_at"
      | "effort_total_minutes"
      | "session_minutes"
      | "importance"
      | "energy"
      | "context"
      | "parent_id"
    >
  >;

/** A work item the user adds by hand: every field given is the user's. */
export async function createWorkItem(db: Db, item: NewWorkItem): Promise<WorkItem> {
  const fields = Object.keys(item).filter(
    (field) => !["id", "module_id", "parent_id"].includes(field),
  );
  return unwrap(
    await db
      .from("work_items")
      .insert({ ...item, title: item.title.trim(), provenance: markUserEdited(null, fields) })
      .select()
      .single(),
  );
}

export type WorkItemEdit = Partial<
  Pick<
    WorkItem,
    | "title"
    | "due_at"
    | "due_is_hard"
    | "earliest_at"
    | "effort_total_minutes"
    | "session_minutes"
    | "importance"
    | "energy"
    | "context"
    | "status"
  >
>;

/** The user edits a work item: the edited fields become the user's and survive later proposals. */
export async function updateWorkItem(db: Db, id: string, edit: WorkItemEdit): Promise<WorkItem> {
  const current = unwrap(await db.from("work_items").select("provenance").eq("id", id).single());
  const provenance = markUserEdited(current.provenance as Provenance, Object.keys(edit));
  return unwrap(
    await db
      .from("work_items")
      .update({ ...edit, provenance })
      .eq("id", id)
      .select()
      .single(),
  );
}

// --- Rhythms ---------------------------------------------------------------------------------

export async function listRhythms(db: Db): Promise<Rhythm[]> {
  return unwrap(await db.from("rhythms").select("*").eq("active", true).order("created_at"));
}

/** Logs since the given day; the longest period is a month, so 31 days back is always enough. */
export async function listRhythmLogs(db: Db, sinceDay: string): Promise<RhythmLog[]> {
  return unwrap(await db.from("rhythm_logs").select("*").gte("done_on", sinceDay));
}

export type NewRhythm = Pick<
  TablesInsert<"rhythms">,
  "module_id" | "title" | "target_count" | "period"
> &
  Partial<
    Pick<TablesInsert<"rhythms">, "id" | "floor_count" | "est_minutes" | "energy" | "context">
  >;

export async function createRhythm(db: Db, rhythm: NewRhythm): Promise<Rhythm> {
  const fields = Object.keys(rhythm).filter((field) => !["id", "module_id"].includes(field));
  return unwrap(
    await db
      .from("rhythms")
      .insert({ ...rhythm, title: rhythm.title.trim(), provenance: markUserEdited(null, fields) })
      .select()
      .single(),
  );
}

export type RhythmEdit = Partial<
  Pick<Rhythm, "title" | "target_count" | "period" | "floor_count" | "est_minutes" | "active">
>;

export async function updateRhythm(db: Db, id: string, edit: RhythmEdit): Promise<Rhythm> {
  const current = unwrap(await db.from("rhythms").select("provenance").eq("id", id).single());
  const provenance = markUserEdited(current.provenance as Provenance, Object.keys(edit));
  return unwrap(
    await db
      .from("rhythms")
      .update({ ...edit, provenance })
      .eq("id", id)
      .select()
      .single(),
  );
}

/** Marks a rhythm as done once, today, without a session. */
export async function logRhythm(db: Db, rhythmId: string, now: Date): Promise<void> {
  check(await db.from("rhythm_logs").insert({ rhythm_id: rhythmId, done_on: dayKey(now) }));
}
