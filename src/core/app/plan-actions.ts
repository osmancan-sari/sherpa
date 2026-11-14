"use client";

import { keepWeek } from "@/core/data/keep";
import {
  answerFollowUp,
  closeDay,
  deferTask,
  saveDayPlan,
  setLifeMode,
  skipToday,
  waitOnTask,
} from "@/core/data/planning";
import { postAi } from "@/core/ai/client";
import { confirmSession, type PlannedTarget } from "@/core/data/sessions";
import { endSessionTold, startSessionIfIdleTold } from "@/core/data/session-events";
import type { ModuleRegistry } from "@/core/contract/types";
import type { Db } from "@/core/types";
import { useRegistry } from "./CoreProvider";
import { createTask } from "@/core/data/work";
import { buildPlan, type Candidate, isFinished, type PlanInput } from "@/core/planner";
import type { LifeMode, LifeModePeriod, Session, Task } from "@/core/types";
import { shiftDay } from "@/lib/date";
import { SAVE_FAILED, useNotify } from "@/core/ui/Notices";
import { startedDraft } from "./actions";
import { keys, list, useCoreMutation } from "./hooks";

// The planner's touches on the Today screen (docs/05-arayuz.md, "NowCard durumları"): put off,
// stuck, waiting, the follow-up, and "Yeniden planla". Each shows at once and writes behind.

function useFailureNotice() {
  const notify = useNotify();
  return () => notify(SAVE_FAILED);
}

/**
 * What "Ertele" does with a candidate: tomorrow for a task, off today's list for the rest.
 * Ç3f: `next` is the chain's next work when the one put off was running in a chain.
 */
export type DeferTarget = {
  candidate: Candidate;
  date: string;
  session?: Session | null;
  next?: PlannedTarget | null;
};

/** "Ertele" while it runs: the session is stopped first, its module told it was put off. */
async function stopFirst(
  db: Db,
  registry: ModuleRegistry,
  session?: Session | null,
): Promise<Session | null> {
  if (session && session.id !== "pending") {
    return endSessionTold({ db, registry }, session.id, "stopped", "deferred");
  }
  return null;
}

export function useDefer() {
  const onError = useFailureNotice();
  const registry = useRegistry();
  return useCoreMutation({
    mutate: async (db, { candidate, date, session, next }: DeferTarget) => {
      const ended = await stopFirst(db, registry, session);
      if (candidate.type === "follow_up" && candidate.task) {
        return answerFollowUp(db, candidate.task, false, date);
      }
      if (candidate.type === "task" && candidate.task) await deferTask(db, candidate.task, date);
      else await skipToday(db, date, candidate.id);
      // Ç3f: the chain goes on with its next work, as after Bitti (only if nothing started).
      if (next && ended?.ended_at) {
        await startSessionIfIdleTold({ db, registry }, ended.ended_at, next);
      }
    },
    optimistic: ({ candidate, date, session, next }, queryClient) => [
      ...(candidate.type === "task" && candidate.task
        ? [
            {
              key: keys.tasks,
              update: list.patch<Task>(candidate.id, {
                planned_date: shiftDay(date, 1),
                defer_count: candidate.task.defer_count + 1,
                status: "todo",
                // The chain reads "put off today" from it (src/core/today/chain.ts).
                updated_at: new Date().toISOString(),
              }),
            },
          ]
        : []),
      ...(session ? [{ key: keys.openSession, update: () => null }] : []),
      ...(session && next ? startedDraft(next, queryClient) : []),
    ],
    onError,
  });
}

/** "Devam ediyorum": the question goes away, on every screen. */
export function useConfirmSession() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, session: Session) => confirmSession(db, session.id, new Date()),
    optimistic: (session) => [
      {
        key: keys.openSession,
        update: () => ({ ...session, confirmed_at: new Date().toISOString() }),
      },
    ],
    onError,
  });
}

/** "Takıldım" closes the session; the three ways on are below. */
export function useStopForStuck() {
  const onError = useFailureNotice();
  const registry = useRegistry();
  return useCoreMutation({
    mutate: (db, session: Session) =>
      endSessionTold({ db, registry }, session.id, "stopped", "stuck"),
    optimistic: () => [{ key: keys.openSession, update: () => null }],
    onError,
  });
}

/** "Adımı küçült": a smaller first step of the same work, today. */
export function useSmallerStep() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (
      db,
      input: { task: Pick<Task, "module_id" | "work_item_id">; title: string; date: string },
    ) =>
      createTask(db, {
        module_id: input.task.module_id,
        work_item_id: input.task.work_item_id,
        title: input.title,
        est_minutes: 15,
        planned_date: input.date,
      }),
    onError,
  });
}

/** "Birini bekliyorum": the task waits; a follow-up comes in three days. */
export function useWaitOn() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, input: { task: Task; waitingOn: string | null; date: string }) =>
      waitOnTask(db, input.task, input.waitingOn, input.date),
    optimistic: ({ task, waitingOn }) => [
      {
        key: keys.tasks,
        update: list.patch<Task>(task.id, { status: "waiting", waiting_on: waitingOn }),
      },
    ],
    onError,
  });
}

/** The follow-up of waiting work: the answer came, or still waiting. */
export function useAnswerFollowUp() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, input: { task: Task; came: boolean; date: string }) =>
      answerFollowUp(db, input.task, input.came, input.date),
    optimistic: ({ task, came, date }) => [
      {
        key: keys.tasks,
        update: list.patch<Task>(
          task.id,
          came
            ? { status: "todo", waiting_on: null, follow_up_on: null }
            : { follow_up_on: shiftDay(date, 3) },
        ),
      },
    ],
    onError,
  });
}

/** A life mode for a range of days (Hafta). A change of mode commits the week again. */
export function useSetLifeMode() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, input: { mode: LifeMode; from: string; to: string; existing: LifeModePeriod[] }) =>
      setLifeMode(db, input, input.existing),
    onError,
  });
}

/** "Haftayı yeniden kur": the user's request is a trigger of its own. */
export function useRecommitWeek() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: async (db, { now, ai }: { now: Date; ai: boolean }) => {
      // With the AI on, the server commits with its advice; without an answer, the engine here.
      if (ai && (await postAi("week", { force: true }))) return null;
      return keepWeek(db, now, { force: true });
    },
    onError,
  });
}

/** The evening closing's "Onayla": tomorrow's plan is kept, today goes to night. */
export function useCloseDay() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, input: Parameters<typeof closeDay>[1]) => closeDay(db, input),
    onError,
  });
}

/**
 * "Yeniden planla" without the AI: the day's three are chosen again from where the day stands
 * now (what was put off stays off).
 */
export function useReplan() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: async (db, { input, ai }: { input: PlanInput; ai: boolean }) => {
      // The engine plans again here at once: the screen does not wait for the AI. What is
      // finished of the day's three stays in it (the day's progress is kept); the rest is
      // chosen again.
      const finished = (input.top3 ?? []).filter((id) => isFinished(id, input));
      const plan = buildPlan({ ...input, top3: undefined });
      const top3 = [...finished, ...plan.top3.filter((id) => !finished.includes(id))].slice(0, 3);
      const saved = await saveDayPlan(db, {
        plan: { ...plan, top3 },
        day: input,
        source: "auto",
        // The user's own new plan: the morning's AI plan is not asked for again over it, and
        // the morning's advice no longer steers it.
        stored: { aiAsked: true, advice: null },
      });
      // With the AI on, its `replan` comes on top a few seconds later (through the live
      // connection); nothing is lost if it does not come.
      if (ai) void postAi("plan", { date: input.date, kind: "replan", context: input.context });
      return saved;
    },
    onError,
  });
}
