import type { ModuleContext } from "@/core/contract/types";
import type { Json, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import type { Part, Routine, RoutineKey, Run, RunStep, Step } from "./server/flow";

// The module's own tables (docs/moduller/rutin.md, section 3). Nobody else reads or writes them.

function unwrap<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null || result.data === undefined) throw new Error("no data returned");
  return result.data;
}

function check(result: { error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
}

// --- Routines and steps ------------------------------------------------------------------------

export async function listRoutines(ctx: ModuleContext): Promise<Routine[]> {
  return unwrap(await ctx.db.from("rutin_routines").select("*").order("created_at"));
}

export async function listSteps(ctx: ModuleContext): Promise<Step[]> {
  return unwrap(await ctx.db.from("rutin_steps").select("*").order("position"));
}

export async function setRoutineActive(ctx: ModuleContext, id: string, active: boolean) {
  return unwrap(
    await ctx.db.from("rutin_routines").update({ active }).eq("id", id).select().single(),
  );
}

/** The routines this call created; one that already exists is left as it is. */
export async function insertRoutines(
  ctx: ModuleContext,
  rows: { key: RoutineKey; title: string }[],
): Promise<Routine[]> {
  return unwrap(
    await ctx.db
      .from("rutin_routines")
      .upsert(rows, { onConflict: "user_id,key", ignoreDuplicates: true })
      .select(),
  );
}

export type StepInput = Omit<TablesInsert<"rutin_steps">, "parts" | "user_id" | "id"> & {
  parts?: Part[] | null;
};

const partsJson = (parts: Part[] | null | undefined): Json | null | undefined =>
  parts === undefined ? undefined : parts === null || parts.length === 0 ? null : (parts as Json);

export async function insertStep(ctx: ModuleContext, step: StepInput): Promise<Step> {
  return unwrap(
    await ctx.db
      .from("rutin_steps")
      .insert({ ...step, parts: partsJson(step.parts) })
      .select()
      .single(),
  );
}

export type StepPatch = Omit<TablesUpdate<"rutin_steps">, "parts" | "user_id" | "id"> & {
  parts?: Part[] | null;
};

export async function updateStep(ctx: ModuleContext, id: string, patch: StepPatch): Promise<Step> {
  const { parts, ...rest } = patch;
  return unwrap(
    await ctx.db
      .from("rutin_steps")
      .update({ ...rest, ...(parts !== undefined ? { parts: partsJson(parts) } : {}) })
      .eq("id", id)
      .select()
      .single(),
  );
}

/** Deletes the step (its add-ons go with it); the runs' records of it stay. */
export async function deleteStep(ctx: ModuleContext, id: string): Promise<void> {
  check(await ctx.db.from("rutin_steps").delete().eq("id", id));
}

/** The steps' new order: each id gets its index as its position. */
export async function reorderSteps(ctx: ModuleContext, ids: string[]): Promise<void> {
  for (const [position, id] of ids.entries()) {
    check(await ctx.db.from("rutin_steps").update({ position }).eq("id", id));
  }
}

// --- Runs --------------------------------------------------------------------------------------

export async function getRun(
  ctx: ModuleContext,
  routineId: string,
  day: string,
): Promise<Run | null> {
  const { data, error } = await ctx.db
    .from("rutin_runs")
    .select("*")
    .eq("routine_id", routineId)
    .eq("day", day)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getRunOfSession(ctx: ModuleContext, sessionId: string): Promise<Run | null> {
  const { data, error } = await ctx.db
    .from("rutin_runs")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * The routine's run on the day: the one there is, or a new one at its first step. Two screens
 * (or the scene and the session's listener) asking at once get the same row.
 */
export async function ensureRun(
  ctx: ModuleContext,
  args: { routineId: string; day: string; sessionId: string | null; at: Date },
): Promise<Run> {
  check(
    await ctx.db.from("rutin_runs").upsert(
      {
        routine_id: args.routineId,
        day: args.day,
        session_id: args.sessionId,
        step_started_at: args.at.toISOString(),
      },
      { onConflict: "user_id,routine_id,day", ignoreDuplicates: true },
    ),
  );
  const run = await getRun(ctx, args.routineId, args.day);
  if (!run) throw new Error("run not found after it was written");
  return run;
}

export type RunPatch = Omit<TablesUpdate<"rutin_runs">, "id" | "user_id" | "routine_id" | "day">;

export async function updateRun(ctx: ModuleContext, id: string, patch: RunPatch): Promise<Run> {
  return unwrap(await ctx.db.from("rutin_runs").update(patch).eq("id", id).select().single());
}

/**
 * Moves the run on only if it still stands where this screen saw it: of two screens moving at
 * once (or both timers running out) one moves it. Null when the other one was first.
 */
export async function moveRun(
  ctx: ModuleContext,
  run: Pick<Run, "id" | "step_position" | "part_position">,
  patch: RunPatch,
): Promise<Run | null> {
  const { data, error } = await ctx.db
    .from("rutin_runs")
    .update(patch)
    .eq("id", run.id)
    .eq("step_position", run.step_position)
    .eq("part_position", run.part_position)
    .select();
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

export async function listRuns(ctx: ModuleContext, sinceDay: string): Promise<Run[]> {
  return unwrap(
    await ctx.db.from("rutin_runs").select("*").gte("day", sinceDay).order("day", {
      ascending: true,
    }),
  );
}

export type RunRecord = RunStep & { day: string; routine_id: string };

/** The steps' records of the runs since a day, each with its run's day. */
export async function listRecords(ctx: ModuleContext, sinceDay: string): Promise<RunRecord[]> {
  const rows = unwrap(
    await ctx.db
      .from("rutin_run_steps")
      .select("*, rutin_runs!inner(day, routine_id)")
      .gte("rutin_runs.day", sinceDay),
  );
  return rows.map(({ rutin_runs: run, ...row }) => ({
    ...row,
    day: run.day,
    routine_id: run.routine_id,
  }));
}

export async function saveRecords(
  ctx: ModuleContext,
  rows: {
    run_id: string;
    step_id: string;
    result: "done" | "skipped";
    seconds: number | null;
    bulk: boolean;
  }[],
): Promise<void> {
  if (rows.length === 0) return;
  check(await ctx.db.from("rutin_run_steps").upsert(rows, { onConflict: "run_id,step_id" }));
}
