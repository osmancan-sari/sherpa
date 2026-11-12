"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  type BlockEdit,
  cancelBlock,
  createBlock,
  type NewBlock,
  restoreBlock,
  type SeriesEdit,
  updateBlock,
  updateSeries,
} from "@/core/data/blocks";
import {
  addInboxEntry,
  dismissEntry,
  markRouted,
  type RoutedTo,
  snoozePrompt,
} from "@/core/data/inbox";
import { answerModulePrompt, closeWorkItem } from "@/core/data/outcome";
import { endSession, type SessionTarget, startSession } from "@/core/data/sessions";
import {
  completeTask,
  createRhythm,
  createTask,
  createWorkItem,
  dropTask,
  logRhythm,
  type NewRhythm,
  type NewTask,
  type NewWorkItem,
  reopenTask,
  type RhythmEdit,
  updateRhythm,
  updateTask,
  updateWorkItem,
  type WorkItemEdit,
} from "@/core/data/work";
import { saveAiSettings } from "@/core/ai/budget";
import { postAi, sizeRequestAfterEnrich } from "@/core/ai/client";
import { applyEnrichment, readSuggestion } from "@/core/ai/flows/enrich-apply";
import { acceptSplit, declineSplit } from "@/core/ai/flows/split";
import type {
  Block,
  BlockSeries,
  InboxEntry,
  ModuleRow,
  Prompt,
  Rhythm,
  RhythmLog,
  Session,
  Task,
  WorkItem,
} from "@/core/types";
import { dayKey } from "@/lib/date";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { SAVE_FAILED, useNotify } from "@/core/ui/Notices";
import { useRegistry } from "./CoreProvider";
import { keys, list, useCoreMutation } from "./hooks";

// The touches of the main screens. Each one shows its result at once and writes in the
// background; if the write fails the screen goes back and says so in one line.

const stamp = () => new Date().toISOString();

/** A row as it will look once the database has filled in its defaults; used optimistically. */
function draftTask(task: NewTask & { id: string }): Task {
  const now = stamp();
  return {
    user_id: "",
    work_item_id: null,
    kind: "task",
    est_minutes: 30,
    due_at: null,
    planned_date: null,
    energy: "light",
    context: "any",
    importance: 2,
    status: "todo",
    waiting_on: null,
    follow_up_on: null,
    position: null,
    source_type: null,
    source_id: null,
    meta: {},
    ai: null,
    done_at: null,
    created_at: now,
    updated_at: now,
    ...task,
  } as Task;
}

function useFailureNotice() {
  const notify = useNotify();
  return () => notify(SAVE_FAILED);
}

export function useAddTask() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, task: NewTask & { id: string }) => createTask(db, task),
    optimistic: (task) => [{ key: keys.tasks, update: list.add(draftTask(task)) }],
    onError,
  });
}

export function useAddWorkItem() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, item: NewWorkItem) => createWorkItem(db, item),
    onError,
  });
}

export function useCompleteTask() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, taskId: string) => completeTask(db, taskId),
    optimistic: (taskId, queryClient) => {
      const open = queryClient.getQueryData<Session | null>(keys.openSession);
      return [
        { key: keys.tasks, update: list.patch<Task>(taskId, { status: "done", done_at: stamp() }) },
        ...(open?.task_id === taskId ? [{ key: keys.openSession, update: () => null }] : []),
      ];
    },
    onError,
  });
}

export function useReopenTask() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, taskId: string) => reopenTask(db, taskId),
    optimistic: (taskId) => [
      { key: keys.tasks, update: list.patch<Task>(taskId, { status: "todo", done_at: null }) },
    ],
    onError,
  });
}

export function useStartSession() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, target: SessionTarget) => startSession(db, target),
    optimistic: (target, queryClient) => {
      const previous = queryClient.getQueryData<Session | null>(keys.openSession);
      const now = stamp();
      // What the card shows until the server answers: the title and the module of the thing
      // that was started, read from what is already on screen.
      const tasks = queryClient.getQueryData<Task[]>(keys.tasks) ?? [];
      const items = queryClient.getQueryData<WorkItem[]>(keys.workItems) ?? [];
      const rhythms = queryClient.getQueryData<Rhythm[]>(keys.rhythms) ?? [];
      const item =
        "workItemId" in target ? items.find((row) => row.id === target.workItemId) : null;
      const moduleId =
        "title" in target
          ? (target.moduleId ?? null)
          : "taskId" in target
            ? (tasks.find((row) => row.id === target.taskId)?.module_id ?? null)
            : "rhythmId" in target
              ? (rhythms.find((row) => row.id === target.rhythmId)?.module_id ?? null)
              : (item?.module_id ?? null);
      const draft: Session = {
        id: "pending",
        user_id: "",
        task_id: "taskId" in target ? target.taskId : null,
        rhythm_id: "rhythmId" in target ? target.rhythmId : null,
        module_id: moduleId,
        title: "title" in target ? target.title : (item?.title ?? null),
        started_at: now,
        ended_at: null,
        measured: true,
        confirmed_at: null,
        created_at: now,
        updated_at: now,
      };
      return [
        { key: keys.openSession, update: () => draft },
        {
          key: keys.tasks,
          update: (current: unknown) =>
            ((current as Task[] | undefined) ?? []).map((task) => {
              if ("taskId" in target && task.id === target.taskId) {
                return { ...task, status: "doing" as const };
              }
              // What was running goes back to the pool.
              if (previous?.task_id === task.id && task.status === "doing") {
                return { ...task, status: "todo" as const };
              }
              return task;
            }),
        },
      ];
    },
    onError,
  });
}

export function useEndSession() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, args: { session: Session; outcome: "done" | "stopped" }) =>
      endSession(db, args.session.id, args.outcome),
    optimistic: ({ session, outcome }) => [
      { key: keys.openSession, update: () => null },
      ...(session.task_id
        ? [
            {
              key: keys.tasks,
              update: list.patch<Task>(
                session.task_id,
                outcome === "done" ? { status: "done", done_at: stamp() } : { status: "todo" },
              ),
            },
          ]
        : []),
    ],
    onError,
  });
}

export function useLogRhythm() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, rhythmId: string) => logRhythm(db, rhythmId, new Date()),
    optimistic: (rhythmId) => {
      const now = stamp();
      const draft: RhythmLog = {
        id: `pending-${rhythmId}`,
        user_id: "",
        rhythm_id: rhythmId,
        done_on: dayKey(new Date()),
        session_id: null,
        created_at: now,
        updated_at: now,
      };
      return [{ key: keys.rhythmLogs, update: list.add(draft) }];
    },
    onError,
  });
}

export function useCloseWorkItem() {
  const registry = useRegistry();
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, args: { itemId: string; result: "done" | "dropped" }) =>
      closeWorkItem(db, registry, args.itemId, args.result),
    optimistic: ({ itemId }) => [{ key: keys.workItems, update: list.remove<WorkItem>(itemId) }],
    onError,
  });
}

// --- Editing by hand ---------------------------------------------------------------------------

export function useEditTask() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, args: { id: string; patch: TablesUpdate<"tasks"> }) =>
      updateTask(db, args.id, args.patch),
    optimistic: ({ id, patch }) => [
      { key: keys.tasks, update: list.patch<Task>(id, patch as Partial<Task>) },
    ],
    onError,
  });
}

/** "Bırak": the task leaves the pool; nothing is deleted. */
export function useDropTask() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, taskId: string) => dropTask(db, taskId),
    optimistic: (taskId, queryClient) => {
      const open = queryClient.getQueryData<Session | null>(keys.openSession);
      return [
        { key: keys.tasks, update: list.remove<Task>(taskId) },
        ...(open?.task_id === taskId ? [{ key: keys.openSession, update: () => null }] : []),
      ];
    },
    onError,
  });
}

/** The edited fields become the user's own; later proposals leave them alone. */
export function useEditWorkItem() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, args: { id: string; patch: WorkItemEdit }) =>
      updateWorkItem(db, args.id, args.patch),
    optimistic: ({ id, patch }) => [
      { key: keys.workItems, update: list.patch<WorkItem>(id, patch) },
    ],
    onError,
  });
}

export function useAddRhythm() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, rhythm: NewRhythm) => createRhythm(db, rhythm),
    onError,
  });
}

export function useEditRhythm() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, args: { id: string; patch: RhythmEdit }) => updateRhythm(db, args.id, args.patch),
    optimistic: ({ id, patch }) => [
      {
        key: keys.rhythms,
        // A rhythm that is stopped leaves the list of running ones.
        update: patch.active === false ? list.remove<Rhythm>(id) : list.patch<Rhythm>(id, patch),
      },
    ],
    onError,
  });
}

// --- Inbox -------------------------------------------------------------------------------------

export function useAddInboxEntry() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, args: { id: string; text: string }) => addInboxEntry(db, args.text, args.id),
    optimistic: ({ id, text }) => {
      const now = stamp();
      const draft: InboxEntry = {
        id,
        user_id: "",
        raw_text: text.trim(),
        status: "new",
        suggestion: null,
        routed: null,
        routed_at: null,
        created_at: now,
        updated_at: now,
      };
      return [{ key: keys.inbox, update: list.add(draft) }];
    },
    onError,
  });
}

export function useDismissEntry() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, entryId: string) => dismissEntry(db, entryId),
    optimistic: (entryId) => [{ key: keys.inbox, update: list.remove<InboxEntry>(entryId) }],
    onError,
  });
}

/** Turns an inbox entry into a task or a block, then marks the entry as routed. */
export function useRouteEntry() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: async (
      db,
      args: { entryId: string } & (
        | { task: NewTask & { id: string }; module: string }
        | { workItem: NewWorkItem; module: string }
        | { block: NewBlock & { id: string } }
      ),
    ) => {
      let routed: RoutedTo;
      if ("workItem" in args) {
        const item = await createWorkItem(db, args.workItem);
        routed = [{ type: "work_item", id: item.id, module: args.module }];
      } else if ("task" in args) {
        const task = await createTask(db, args.task);
        routed = [{ type: "task", id: task.id, module: args.module }];
      } else {
        const block = await createBlock(db, args.block);
        routed = [{ type: "block", id: block.id }];
      }
      await markRouted(db, args.entryId, routed);
    },
    optimistic: (args) => [
      { key: keys.inbox, update: list.remove<InboxEntry>(args.entryId) },
      ...("task" in args ? [{ key: keys.tasks, update: list.add(draftTask(args.task)) }] : []),
    ],
    onError,
  });
}

// --- AI ----------------------------------------------------------------------------------------

/** "Onayla" on an inbox card: the AI's suggestion becomes work, in the module the user chose. */
export function useConfirmSuggestion() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: async (db, args: { entry: InboxEntry; module: ModuleRow }) => {
      const suggestion = readSuggestion(args.entry);
      if (!suggestion) throw new Error("the entry carries no suggestion");
      const outcome = await applyEnrichment(db, {
        entry: args.entry,
        output: suggestion.output,
        parsed: suggestion.parsed,
        callId: suggestion.call_id,
        model: suggestion.model,
        moduleId: args.module.id,
        moduleSlug: args.module.slug,
        aiModuleSlug: suggestion.output.module.value,
        now: new Date(),
      });
      // No duration on the line or from the AI: the server estimates it (`size`).
      const sizeRequest = sizeRequestAfterEnrich(outcome);
      if (sizeRequest) void postAi("size", sizeRequest);
      return outcome;
    },
    optimistic: (args) => [{ key: keys.inbox, update: list.remove<InboxEntry>(args.entry.id) }],
    onError,
  });
}

/** "Böl" / "Bölme" on a suggested split. */
export function useAnswerSplit() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, args: { parentId: string; accept: boolean }) =>
      args.accept ? acceptSplit(db, args.parentId) : declineSplit(db, args.parentId),
    optimistic: ({ parentId, accept }) => [
      {
        key: keys.workItems,
        update: (current: unknown) =>
          ((current as WorkItem[] | undefined) ?? []).map((item) =>
            item.parent_id === parentId && item.status === "proposed"
              ? { ...item, status: accept ? ("active" as const) : ("dropped" as const) }
              : item,
          ),
      },
    ],
    onError,
  });
}

/** The AI switch and the monthly limit. */
export function useSaveAiSettings() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, patch: { enabled?: boolean; budgetUsd?: number }) => saveAiSettings(db, patch),
    invalidate: [keys.settings],
    onError,
  });
}

// --- Blocks ------------------------------------------------------------------------------------

export function useSetBlockCancelled() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, args: { blockId: string; cancelled: boolean }) =>
      args.cancelled ? cancelBlock(db, args.blockId) : restoreBlock(db, args.blockId),
    optimistic: ({ blockId, cancelled }) => [
      {
        key: keys.blocks,
        update: list.patch<Block>(blockId, { status: cancelled ? "cancelled" : "planned" }),
      },
    ],
    onError,
  });
}

/** One block is changed by hand; producing the series again leaves it as it is. */
export function useEditBlock() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, args: { id: string; patch: BlockEdit }) => updateBlock(db, args.id, args.patch),
    optimistic: ({ id, patch }) => [{ key: keys.blocks, update: list.patch<Block>(id, patch) }],
    onError,
  });
}

/** The series changes; its coming blocks follow, except the ones changed by hand. */
export function useEditSeries() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, args: { id: string; patch: SeriesEdit }) =>
      updateSeries(db, args.id, args.patch, new Date()),
    optimistic: ({ id, patch }) => [
      { key: keys.series, update: list.patch<BlockSeries>(id, patch) },
    ],
    onError,
  });
}

// --- Prompts -----------------------------------------------------------------------------------

export function useAnswerPrompt() {
  const registry = useRegistry();
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, args: { prompt: Prompt; value: string }) =>
      answerModulePrompt(db, registry, args.prompt, args.value),
    optimistic: ({ prompt }) => [{ key: keys.prompts, update: list.remove<Prompt>(prompt.id) }],
    onError,
  });
}

export function useSnoozePrompt() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, promptId: string) => snoozePrompt(db, promptId, new Date()),
    optimistic: (promptId) => [{ key: keys.prompts, update: list.remove<Prompt>(promptId) }],
    onError,
  });
}

/** Re-reads everything; for flows that write through a module (intake handlers, actions). */
export function useRefreshAll() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}
