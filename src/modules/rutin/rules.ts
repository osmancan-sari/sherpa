import type { ModuleContext, WorkProposal } from "@/core/contract/types";
import type { AppEvent } from "@/core/types";
import {
  ensureRun,
  getRunOfSession,
  getRun,
  insertRoutines,
  insertStep,
  listRoutines,
  listSteps,
  updateRun,
} from "./queries";
import {
  ANCHOR_OF,
  FACET_OF,
  isRoutineKey,
  ORDER_OF,
  type Part,
  proposalMinutes,
  type Routine,
  routineSeconds,
  type RoutineKey,
  type Step,
} from "./server/flow";
import startList from "./server/start-list.json";

// The module's rules (docs/moduller/rutin.md, "Kurallar" and "Teklif ettiği işler"): the starting
// list on the first switch-on, the three rhythms, and a run opened and closed with its session.

export const SOURCE_TYPE = "rutin.routine";
export const keyOf = (key: RoutineKey) => `rutin:${key}`;

/** One routine's rhythm: daily, bound to waking or bedtime at its place in the chain. */
export function proposalFor(routine: Routine, steps: Step[]): WorkProposal {
  const key = routine.key as RoutineKey;
  return {
    schema: 1,
    key: keyOf(key),
    source: { type: SOURCE_TYPE, id: routine.id },
    title: routine.title,
    when: { recurrence: { count: 1, period: "day", floor: 1 } },
    effort: { session_minutes: proposalMinutes(routineSeconds(steps, routine.id)) },
    fit: { energy: key === "hazirlik" ? "physical" : "light", context: "home" },
    timing: { anchor: ANCHOR_OF[key], order: ORDER_OF[key] },
    facet: FACET_OF[key],
    meta: { routine: key },
  };
}

/**
 * Proposes the routines again (their length follows the list), or takes back the ones switched
 * off. Called after every change of the list; the core keeps what the user changed by hand.
 */
export async function proposeAll(ctx: ModuleContext): Promise<void> {
  const [routines, steps] = await Promise.all([listRoutines(ctx), listSteps(ctx)]);
  for (const routine of routines) {
    if (!isRoutineKey(routine.key)) continue;
    if (routine.active) await ctx.propose(proposalFor(routine, steps));
    else await ctx.withdraw(keyOf(routine.key));
  }
}

type StartStep = {
  title: string;
  kind?: "tap" | "closing";
  seconds: number;
  minimum: boolean;
  active: boolean;
  phase?: number;
  ref?: string;
  hint?: string;
  every_days?: number;
  parts?: Part[];
  addOns?: StartStep[];
};

/**
 * The starting list (8.1), written only when the module has no routines yet: switching it off and
 * on again, or a second screen doing it at the same moment, never writes over the user's list.
 */
export async function writeStartList(ctx: ModuleContext): Promise<boolean> {
  if ((await listRoutines(ctx)).length > 0) return false;
  const lists = startList.routines as { key: RoutineKey; title: string; steps: StartStep[] }[];
  const created = await insertRoutines(
    ctx,
    lists.map(({ key, title }) => ({ key, title })),
  );
  for (const routine of created) {
    const list = lists.find((row) => row.key === routine.key);
    for (const [position, step] of (list?.steps ?? []).entries()) {
      const row = await insertStep(ctx, rowOf(step, routine.id, position, null));
      for (const [index, addOn] of (step.addOns ?? []).entries()) {
        await insertStep(ctx, rowOf(addOn, routine.id, index, row.id));
      }
    }
  }
  return created.length > 0;
}

function rowOf(step: StartStep, routineId: string, position: number, parentId: string | null) {
  return {
    routine_id: routineId,
    parent_id: parentId,
    position,
    title: step.title,
    kind: step.kind ?? "tap",
    seconds: step.seconds,
    hint: step.hint ?? null,
    parts: step.parts ?? null,
    minimum: step.minimum,
    active: step.active,
    phase: step.phase ?? null,
    every_days: step.every_days ?? null,
    ref: step.ref ?? null,
  };
}

/** The routine a session's work comes from, if it is one of this module's. */
async function routineOf(ctx: ModuleContext, event: AppEvent): Promise<Routine | null> {
  const source = (event.payload as { source?: { type?: string | null; id?: string | null } })
    .source;
  if (source?.type !== SOURCE_TYPE || !source.id) return null;
  const routine = (await listRoutines(ctx)).find((row) => row.id === source.id);
  return routine && isRoutineKey(routine.key) ? routine : null;
}

/**
 * A session of a routine started: its run on the core's day is opened (or found). The same session
 * again (its bedtime was taken back) goes on where it stood; a run left halfway goes on too; a run
 * finished earlier that day starts over from its first step.
 */
export async function openRun(ctx: ModuleContext, event: AppEvent): Promise<void> {
  const routine = await routineOf(ctx, event);
  if (!routine) return;
  const payload = event.payload as { session_id?: string; started_at?: string; day?: string };
  // The run's day is the core's planning day of the start (Ç3g): no copy of its rule here.
  if (!payload.session_id || !payload.day) return;
  const at = payload.started_at ? new Date(payload.started_at) : ctx.now();
  const day = payload.day;
  const existing = await getRun(ctx, routine.id, day);
  if (!existing) {
    await ensureRun(ctx, { routineId: routine.id, day, sessionId: payload.session_id, at });
  } else if (existing.session_id === payload.session_id) {
    if (existing.finished_at) await updateRun(ctx, existing.id, { finished_at: null });
  } else if (existing.finished_at) {
    await updateRun(ctx, existing.id, {
      session_id: payload.session_id,
      finished_at: null,
      step_position: 0,
      part_position: 0,
      step_started_at: null,
      part_started_at: null,
      part_paused_at: null,
    });
  } else {
    await updateRun(ctx, existing.id, { session_id: payload.session_id });
  }
}

/** A routine's session ended with "Bitti" (or "Yatıyorum"): its run is finished. */
export async function closeRun(ctx: ModuleContext, event: AppEvent): Promise<void> {
  const payload = event.payload as { session_id?: string; result?: string; ended_at?: string };
  if (payload.result !== "done" || !payload.session_id) return;
  const run = await getRunOfSession(ctx, payload.session_id);
  if (!run || run.finished_at) return;
  await updateRun(ctx, run.id, { finished_at: payload.ended_at ?? ctx.now().toISOString() });
}

export const listeners: Record<string, (event: AppEvent, ctx: ModuleContext) => Promise<void>> = {
  "core.session_started": (event, ctx) => openRun(ctx, event),
  "core.session_ended": (event, ctx) => closeRun(ctx, event),
};
