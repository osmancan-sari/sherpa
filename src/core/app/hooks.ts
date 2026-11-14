"use client";

import {
  type QueryClient,
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";
import { usageThisMonth } from "@/core/ai/budget";
import type { AiStatus } from "@/core/ai/status";
import type { ModuleDefinition } from "@/core/contract/types";
import { listBlocks, listSeries } from "@/core/data/blocks";
import { createModuleContext } from "@/core/data/context";
import { getSettings, listDuePrompts, listInbox } from "@/core/data/inbox";
import { listModules } from "@/core/data/module-rows";
import { getOpenSession, listSessions } from "@/core/data/sessions";
import { listDays, listLifeModes, listStats, listWeekPlans } from "@/core/data/planning";
import { listDeviceTokens } from "@/core/data/tokens";
import { listRhythmLogs, listRhythms, listTasks, listWorkItems } from "@/core/data/work";
import {
  buildPlan,
  dayStartClock,
  type PlanRows,
  planInput,
  plannerSettings,
  planningDay,
} from "@/core/planner";
import { type Context, type Db, type ModuleRow, unwrap } from "@/core/types";
import { dayKey, shiftDay, weekStart } from "@/lib/date";
import { readClock, readServerClock, subscribeClock } from "./clock";
import { CORE, MODULE, useDb, useRegistry } from "./CoreProvider";

// --- Time ------------------------------------------------------------------------------------

/**
 * The current time: re-read every half minute, when the window comes back to the front, and
 * whenever data changes. Screens derive "now", elapsed minutes and "today" from this instead
 * of keeping their own clocks.
 */
export function useNow(): Date {
  return useSyncExternalStore(subscribeClock, readClock, readServerClock);
}

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

// --- Queries -----------------------------------------------------------------------------------
// One query per table; screens select what they need from the rows. The key is ["core", table],
// which is exactly what the live connection invalidates when that table changes.

export const keys = {
  modules: [CORE, "modules"] as const,
  tasks: [CORE, "tasks"] as const,
  workItems: [CORE, "work_items"] as const,
  rhythms: [CORE, "rhythms"] as const,
  rhythmLogs: [CORE, "rhythm_logs"] as const,
  blocks: [CORE, "blocks"] as const,
  series: [CORE, "block_series"] as const,
  openSession: [CORE, "sessions", "open"] as const,
  sessions: [CORE, "sessions", "recent"] as const,
  inbox: [CORE, "inbox_entries"] as const,
  prompts: [CORE, "prompts"] as const,
  settings: [CORE, "settings"] as const,
  // Under "settings": a change of the AI switch or budget refreshes both.
  aiStatus: [CORE, "settings", "ai_status"] as const,
  aiUsage: [CORE, "settings", "ai_usage"] as const,
  days: [CORE, "days"] as const,
  weekPlans: [CORE, "week_plans"] as const,
  lifeModes: [CORE, "life_mode_periods"] as const,
  stats: [CORE, "planner_stats"] as const,
  weeklyReviews: [CORE, "weekly_reviews"] as const,
  horizonReviews: [CORE, "horizon_reviews"] as const,
  deviceTokens: [CORE, "device_tokens"] as const,
};

/** Ç3d: the device tokens (Settings → Bağlantılar); their last use comes in live. */
export function useDeviceTokens() {
  const db = useDb();
  return useQuery({ queryKey: keys.deviceTokens, queryFn: () => listDeviceTokens(db) });
}

export function useModuleRows() {
  const db = useDb();
  return useQuery({ queryKey: keys.modules, queryFn: () => listModules(db) });
}

export function useTasks() {
  const db = useDb();
  return useQuery({ queryKey: keys.tasks, queryFn: () => listTasks(db, new Date()) });
}

export function useWorkItems() {
  const db = useDb();
  return useQuery({ queryKey: keys.workItems, queryFn: () => listWorkItems(db) });
}

export function useRhythms() {
  const db = useDb();
  return useQuery({ queryKey: keys.rhythms, queryFn: () => listRhythms(db) });
}

/** Logs of the last 31 days: enough for the longest period (a month). */
export function useRhythmLogs() {
  const db = useDb();
  return useQuery({
    queryKey: keys.rhythmLogs,
    queryFn: () => listRhythmLogs(db, shiftDay(dayKey(new Date()), -31)),
  });
}

export function useBlocks() {
  const db = useDb();
  return useQuery({ queryKey: keys.blocks, queryFn: () => listBlocks(db, new Date()) });
}

export function useSeries() {
  const db = useDb();
  return useQuery({ queryKey: keys.series, queryFn: () => listSeries(db, new Date()) });
}

export function useOpenSession() {
  const db = useDb();
  return useQuery({ queryKey: keys.openSession, queryFn: () => getOpenSession(db) });
}

export function useSessions() {
  const db = useDb();
  return useQuery({ queryKey: keys.sessions, queryFn: () => listSessions(db, new Date()) });
}

export function useInbox() {
  const db = useDb();
  return useQuery({ queryKey: keys.inbox, queryFn: () => listInbox(db) });
}

export function useDuePrompts() {
  const db = useDb();
  return useQuery({ queryKey: keys.prompts, queryFn: () => listDuePrompts(db, new Date()) });
}

export function useSettings() {
  const db = useDb();
  return useQuery({ queryKey: keys.settings, queryFn: () => getSettings(db) });
}

/**
 * Whether the AI answers now, and this month's spending (`/api/ai/status`; the key stays on the
 * server). Null when the server could not be asked: the screens then say nothing about the AI.
 */
export function useAiStatus() {
  return useQuery({
    queryKey: keys.aiStatus,
    queryFn: async (): Promise<AiStatus | null> => {
      try {
        const response = await fetch("/api/ai/status");
        return response.ok ? ((await response.json()) as AiStatus) : null;
      } catch {
        return null;
      }
    },
  });
}

// --- The planner's own rows ---------------------------------------------------------------

/** Day records of the last eight weeks (the return state, learning) and the days ahead. */
export function useDays() {
  const db = useDb();
  return useQuery({
    queryKey: keys.days,
    queryFn: () => listDays(db, shiftDay(dayKey(new Date()), -56)),
  });
}

/** This week's commitment and the ones around it. */
export function useWeekPlans() {
  const db = useDb();
  return useQuery({
    queryKey: keys.weekPlans,
    queryFn: () => listWeekPlans(db, shiftDay(weekStart(dayKey(new Date())), -7)),
  });
}

export function useLifeModes() {
  const db = useDb();
  return useQuery({ queryKey: keys.lifeModes, queryFn: () => listLifeModes(db) });
}

export function usePlannerStats() {
  const db = useDb();
  return useQuery({ queryKey: keys.stats, queryFn: () => listStats(db) });
}

/** The AI's look back on recent weeks (`review`). */
export function useWeeklyReviews() {
  const db = useDb();
  return useQuery({
    queryKey: keys.weeklyReviews,
    queryFn: async () =>
      unwrap(
        await db
          .from("weekly_reviews")
          .select("*")
          .gte("week_start", shiftDay(weekStart(dayKey(new Date())), -7))
          .order("week_start"),
      ),
  });
}

/** The AI's proposals for the coming weeks (`month`). */
export function useHorizonReviews() {
  const db = useDb();
  return useQuery({
    queryKey: keys.horizonReviews,
    queryFn: async () =>
      unwrap(
        await db
          .from("horizon_reviews")
          .select("*")
          .eq("scope", "month")
          .gte("period_start", shiftDay(dayKey(new Date()), -62))
          .order("period_start"),
      ),
  });
}

// --- The device's context ------------------------------------------------------------------

const CONTEXT_KEY = "sherpa:context";
const CONTEXT_EVENT = "sherpa:context";
const CONTEXTS: readonly Context[] = ["desk", "home", "office", "campus", "out", "commute"];

function readContext(): Context {
  try {
    const value = window.localStorage.getItem(CONTEXT_KEY);
    if (value && (CONTEXTS as readonly string[]).includes(value)) return value as Context;
  } catch {
    // Storage can be unavailable (private window); the default stands.
  }
  return "desk";
}

function subscribeContext(listener: () => void) {
  window.addEventListener(CONTEXT_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CONTEXT_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Where this device is (docs/04-planlayici.md, "Bağlam eşleşmesi"): the second screen is at the
 * desk; on the phone the user chooses. Kept on the device, not in the database.
 */
export function useDeviceContext(): Context {
  return useSyncExternalStore(subscribeContext, readContext, () => "desk" as Context);
}

export function setDeviceContext(context: Context): void {
  try {
    window.localStorage.setItem(CONTEXT_KEY, context);
  } catch {
    // Not kept, but this screen still follows the choice until it closes.
  }
  window.dispatchEvent(new Event(CONTEXT_EVENT));
}

// --- The plan ------------------------------------------------------------------------------

/** Every row the planner reads, once all of them have arrived. */
export function usePlanRows() {
  const queries = {
    settings: useSettings(),
    modules: useModuleRows(),
    tasks: useTasks(),
    workItems: useWorkItems(),
    rhythms: useRhythms(),
    rhythmLogs: useRhythmLogs(),
    blocks: useBlocks(),
    sessions: useSessions(),
    openSession: useOpenSession(),
    prompts: useDuePrompts(),
    inbox: useInbox(),
    days: useDays(),
    weekPlans: useWeekPlans(),
    lifeModes: useLifeModes(),
    stats: usePlannerStats(),
  };
  const all = Object.values(queries);
  const loading = all.some((query) => query.isLoading);
  // A failed read is not "nothing to do": the screen says so instead of showing an empty day.
  const failed = all.some((query) => query.isError && query.data === undefined);
  const q = queries;
  const rows = useMemo<PlanRows | null>(
    () =>
      loading || failed
        ? null
        : {
            settings: q.settings.data ?? null,
            modules: q.modules.data ?? [],
            tasks: q.tasks.data ?? [],
            workItems: q.workItems.data ?? [],
            rhythms: q.rhythms.data ?? [],
            rhythmLogs: q.rhythmLogs.data ?? [],
            blocks: q.blocks.data ?? [],
            sessions: q.sessions.data ?? [],
            openSession: q.openSession.data ?? null,
            prompts: q.prompts.data ?? [],
            inbox: q.inbox.data ?? [],
            days: q.days.data ?? [],
            weekPlans: q.weekPlans.data ?? [],
            lifeModes: q.lifeModes.data ?? [],
            stats: q.stats.data ?? [],
          },
    [
      loading,
      failed,
      q.settings.data,
      q.modules.data,
      q.tasks.data,
      q.workItems.data,
      q.rhythms.data,
      q.rhythmLogs.data,
      q.blocks.data,
      q.sessions.data,
      q.openSession.data,
      q.prompts.data,
      q.inbox.data,
      q.days.data,
      q.weekPlans.data,
      q.lifeModes.data,
      q.stats.data,
    ],
  );
  const retry = () => all.forEach((query) => void query.refetch());
  return { rows, loading, failed, retry };
}

/**
 * Today's plan, re-made on every change and every minute (docs/04-planlayici.md, "Yeniden
 * planlama"). Null until the rows are in.
 */
export function useTodayPlan() {
  const now = useNow();
  const context = useDeviceContext();
  const { rows, loading, failed, retry } = usePlanRows();
  const result = useMemo(() => {
    if (!rows || now.getTime() === 0) return null;
    const settings = plannerSettings(rows.settings);
    const date = planningDay(now, dayStartClock(settings));
    const input = planInput(rows, { date, now, context });
    return { input, plan: buildPlan(input), rows };
  }, [rows, now, context]);
  return { ...result, loading, failed, retry, now, context };
}

/** This month's AI calls by kind and model. */
export function useAiUsage() {
  const db = useDb();
  return useQuery({ queryKey: keys.aiUsage, queryFn: () => usageThisMonth(db, new Date()) });
}

// --- Modules -----------------------------------------------------------------------------------

export type KnownModule = {
  row: ModuleRow;
  /** Missing for a row whose module has no code (sample data, a module that was removed). */
  definition: ModuleDefinition | undefined;
};

/** Module rows joined with their definitions. */
export function useModules(): { modules: KnownModule[]; isLoading: boolean } {
  const registry = useRegistry();
  const { data, isLoading } = useModuleRows();
  const modules = useMemo(
    () => (data ?? []).map((row) => ({ row, definition: registry.get(row.slug) })),
    [data, registry],
  );
  return { modules, isLoading };
}

/** Ids of the modules whose work is offered: the active ones. */
export function useActiveModuleIds(): ReadonlySet<string> {
  const { data } = useModuleRows();
  return useMemo(
    () => new Set((data ?? []).filter((row) => row.status === "active").map((row) => row.id)),
    [data],
  );
}

/**
 * A query a module computes through its context (a chip, a list on its page). Keyed under
 * ["module", slug, …], so every change in the data refreshes it.
 */
export function useModuleQuery<T>(
  mod: ModuleRow | undefined,
  key: readonly unknown[],
  fn: (ctx: ReturnType<typeof createModuleContext>) => Promise<T>,
) {
  const db = useDb();
  const registry = useRegistry();
  return useQuery({
    queryKey: [MODULE, mod?.slug ?? "", ...key, mod?.updated_at ?? ""],
    queryFn: () => fn(createModuleContext({ db, registry, module: mod! })),
    enabled: mod !== undefined,
  });
}

// --- Mutations ---------------------------------------------------------------------------------

export type Optimistic = { key: QueryKey; update: (current: unknown) => unknown }[];

/**
 * A write with an optimistic interface: the caches named in `optimistic` change at once, the
 * write goes out in the background, and a failure puts the previous state back. Afterwards
 * everything the write may have touched is re-read.
 */
export function useCoreMutation<TArgs, TResult>(options: {
  mutate: (db: Db, args: TArgs) => Promise<TResult>;
  optimistic?: (args: TArgs, queryClient: QueryClient) => Optimistic;
  /** Query keys to re-read afterwards; default: everything of the core and the modules. */
  invalidate?: QueryKey[];
  onError?: (error: unknown) => void;
}) {
  const db = useDb();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: TArgs) => options.mutate(db, args),
    onMutate: async (args) => {
      const changes = options.optimistic?.(args, queryClient) ?? [];
      await Promise.all(changes.map(({ key }) => queryClient.cancelQueries({ queryKey: key })));
      const previous = changes.map(({ key }) => [key, queryClient.getQueryData(key)] as const);
      for (const { key, update } of changes) {
        queryClient.setQueryData(key, (current: unknown) => update(current));
      }
      return { previous };
    },
    onError: (error, _args, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
      options.onError?.(error);
    },
    onSettled: () => {
      const targets = options.invalidate ?? [[CORE], [MODULE]];
      return Promise.all(targets.map((key) => queryClient.invalidateQueries({ queryKey: key })));
    },
  });
}

/** Helpers for optimistic list updates. */
export const list = {
  add:
    <T>(row: T) =>
    (current: unknown) => [...((current as T[] | undefined) ?? []), row],
  patch:
    <T extends { id: string }>(id: string, patch: Partial<T>) =>
    (current: unknown) =>
      ((current as T[] | undefined) ?? []).map((row) =>
        row.id === id ? { ...row, ...patch } : row,
      ),
  remove:
    <T extends { id: string }>(id: string) =>
    (current: unknown) =>
      ((current as T[] | undefined) ?? []).filter((row) => row.id !== id),
};
