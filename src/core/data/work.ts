import { currentMark, planCorrections, readMark, saveCorrections } from "@/core/ai/marks";
import { markUserEdited } from "@/core/contract/envelope";
import { checkTiming, editTiming, type Timing, TimingError } from "@/core/contract/timing";
import {
  check,
  type Db,
  type Provenance,
  type Rhythm,
  type RhythmLog,
  type Task,
  TASK_DEFAULT_MINUTES,
  toJson,
  unwrap,
  type WorkItem,
} from "@/core/types";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import { dayKey, shiftDay } from "@/lib/date";
import { endSession, getOpenSession } from "./sessions";

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

export async function updateTask(db: Db, id: string, patch: TaskEdit): Promise<Task> {
  if (patch.timing !== undefined) {
    // A task (a job or a sitting) has no rest days; the rest is checked like the envelope.
    const { timing, issues } = checkTiming(patch.timing, { kind: "task" });
    if (issues.length > 0) throw new TimingError(issues);
    patch = { ...patch, timing };
  }
  const corrected = await correctionsOf(db, "tasks", id, patch);
  const task = unwrap(
    await db
      .from("tasks")
      .update({
        ...(patch as TablesUpdate<"tasks">),
        ...(corrected ? { ai: toJson(corrected.mark) } : {}),
      })
      .eq("id", id)
      .select()
      .single(),
  );
  if (corrected) await saveCorrections(db, corrected.rows);
  return task;
}

/** A task's columns as the user edits them; `timing` is checked against the envelope's schema. */
export type TaskEdit = Omit<TablesUpdate<"tasks">, "timing"> & { timing?: Timing | null };

/** Columns the AI may set (enrich on tasks, size on work items). */
const AI_COLUMNS = new Set([
  "module_id",
  "title",
  "est_minutes",
  "due_at",
  "energy",
  "context",
  "importance",
  "effort_total_minutes",
  "session_minutes",
]);

/**
 * When an edit changes values the AI set: the row's mark with those columns as the user's, and
 * the corrections to record once the edit is saved. Null when nothing is corrected.
 */
async function correctionsOf(
  db: Db,
  table: "tasks" | "work_items",
  id: string,
  edit: Record<string, unknown>,
) {
  // Status changes and the like never touch an AI value: no extra read for them.
  if (!Object.keys(edit).some((column) => AI_COLUMNS.has(column))) return null;
  const current = unwrap(await db.from(table).select("*").eq("id", id).single());
  // A field the module set over the AI's value since is not the AI's any more.
  const provenance = table === "work_items" ? (current as WorkItem).provenance : null;
  const mark = currentMark(readMark(current.ai), provenance);
  if (!mark) return null;
  const moduleId = (edit.module_id as string | null | undefined) ?? current.module_id;
  const slug = moduleId
    ? ((await db.from("modules").select("slug").eq("id", moduleId).maybeSingle()).data?.slug ??
      null)
    : null;
  const planned = planCorrections({ mark, edit, moduleSlug: slug });
  if (!planned) return null;
  // The stored mark keeps every field (the sources decide what is shown); only user_edited grows.
  const stored = readMark(current.ai)!;
  return { mark: { ...stored, user_edited: planned.mark.user_edited }, rows: planned.rows };
}

/** One tap: done. A session running on the task is closed with it. */
export async function completeTask(db: Db, id: string): Promise<Task> {
  return unwrap(await db.rpc("complete_task", { p_task_id: id }));
}

/** Back to the pool: a task that was marked done by mistake. */
export async function reopenTask(db: Db, id: string): Promise<Task> {
  const task = await updateTask(db, id, { status: "todo", done_at: null });
  // A sitting finished by mistake with its item ("Bitti" closes both): the item opens again.
  if (task.work_item_id) {
    check(
      await db
        .from("work_items")
        .update({ status: "active" })
        .eq("id", task.work_item_id)
        .eq("status", "done"),
    );
  }
  return task;
}

/**
 * The user gives a task up. Nothing is deleted: the task is marked dropped and leaves the pool.
 * A session running on it is stopped first, so the time spent is still counted.
 */
export async function dropTask(db: Db, id: string): Promise<Task> {
  const open = await getOpenSession(db);
  if (open?.task_id === id) await endSession(db, open.id, "stopped");
  return updateTask(db, id, { status: "dropped" });
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
> & { timing?: Timing | null };

/** The user edits a work item: the edited fields become the user's and survive later proposals. */
export async function updateWorkItem(db: Db, id: string, edit: WorkItemEdit): Promise<WorkItem> {
  const current = unwrap(
    await db.from("work_items").select("provenance, timing").eq("id", id).single(),
  );
  const { timing: timingEdit, ...rest } = edit;
  let provenance = markUserEdited(current.provenance as Provenance, Object.keys(rest));
  const values: Record<string, unknown> = { ...rest };
  if (timingEdit !== undefined) {
    // Each changed field of the time constraints becomes the user's on its own.
    const edited = editTiming(current.timing, timingEdit, { kind: "deadline" }, provenance);
    provenance = edited.provenance;
    values.timing = edited.timing;
  }
  const corrected = await correctionsOf(db, "work_items", id, rest);
  const item = unwrap(
    await db
      .from("work_items")
      .update({
        ...(values as TablesUpdate<"work_items">),
        provenance,
        ...(corrected ? { ai: toJson(corrected.mark) } : {}),
      })
      .eq("id", id)
      .select()
      .single(),
  );
  if (corrected) await saveCorrections(db, corrected.rows);
  return item;
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
> & { timing?: Timing | null };

export async function updateRhythm(db: Db, id: string, edit: RhythmEdit): Promise<Rhythm> {
  const current = unwrap(
    await db
      .from("rhythms")
      .select("provenance, timing, target_count, period")
      .eq("id", id)
      .single(),
  );
  const { timing: timingEdit, ...rest } = edit;
  let provenance = markUserEdited(current.provenance as Provenance, Object.keys(rest));
  const values: Record<string, unknown> = { ...rest };
  // The rest days must fit the period, whichever of the two changes.
  if (timingEdit !== undefined || "target_count" in rest || "period" in rest) {
    const form = {
      kind: "recurrence" as const,
      count: rest.target_count ?? current.target_count,
      period: rest.period ?? current.period,
    };
    const edited = editTiming(
      current.timing,
      timingEdit === undefined ? current.timing : timingEdit,
      form,
      provenance,
    );
    provenance = edited.provenance;
    if (timingEdit !== undefined) values.timing = edited.timing;
  }
  return unwrap(
    await db
      .from("rhythms")
      .update({ ...(values as TablesUpdate<"rhythms">), provenance })
      .eq("id", id)
      .select()
      .single(),
  );
}

/** Marks a rhythm as done once, today, without a session. */
export async function logRhythm(db: Db, rhythmId: string, now: Date): Promise<void> {
  check(await db.from("rhythm_logs").insert({ rhythm_id: rhythmId, done_on: dayKey(now) }));
}
