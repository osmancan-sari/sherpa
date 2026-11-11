import { nextSessionMinutes } from "@/core/contract/envelope";
import type { RhythmProgress } from "@/core/contract/types";
import type { Block, Period, Rhythm, RhythmLog, Session, Task, WorkItem } from "@/core/types";
import { dayKey, istanbulInstant, monthStart, shiftDay, weekStart } from "@/lib/date";

// What the first Today screen shows, as pure functions of the data and the current time.
// There is no planner yet (Ç3): the list is everything that can be done now, ordered by
// deadline and importance.

/** First day of the period (day, week from Monday, month) the given day is in. */
export function periodStart(period: Period, day: string): string {
  if (period === "day") return day;
  return period === "week" ? weekStart(day) : monthStart(day);
}

/**
 * Where a rhythm stands in its current period. Debt never carries over: logs of earlier
 * periods are not counted at all.
 */
export function rhythmProgress(rhythm: Rhythm, logs: RhythmLog[], now: Date): RhythmProgress {
  const start = periodStart(rhythm.period, dayKey(now));
  const done = logs.filter((log) => log.rhythm_id === rhythm.id && log.done_on >= start).length;
  return {
    rhythm,
    done,
    target: rhythm.target_count,
    debt: Math.max(0, rhythm.target_count - done),
  };
}

export type Candidate = {
  type: "task" | "item" | "rhythm";
  id: string;
  title: string;
  moduleId: string;
  minutes: number;
  dueAt: string | null;
  importance: number;
  createdAt: string;
  /** Rhythms: "1/2". */
  progress?: string;
  task?: Task;
  item?: WorkItem;
};

/** Earlier deadline first, then higher importance, then older. Things without a deadline go last. */
export function compareCandidates(a: Candidate, b: Candidate): number {
  if (a.dueAt !== b.dueAt) {
    if (a.dueAt === null) return 1;
    if (b.dueAt === null) return -1;
    const diff = Date.parse(a.dueAt) - Date.parse(b.dueAt);
    if (diff !== 0) return diff;
  }
  if (a.importance !== b.importance) return b.importance - a.importance;
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

/**
 * A work item is blocked while something it depends on is still open. A dependency that was
 * dropped no longer holds anything back.
 */
export function isBlocked(item: WorkItem, all: WorkItem[]): boolean {
  if (item.depends_on.length === 0 && item.depends_on_keys.length === 0) return false;
  // A key that has not been resolved to a record yet is a dependency that does not exist yet.
  if (item.depends_on.length < item.depends_on_keys.length) return true;
  return item.depends_on.some((id) => {
    const dependency = all.find((other) => other.id === id);
    return (
      dependency !== undefined && dependency.status !== "done" && dependency.status !== "dropped"
    );
  });
}

export type TodayInput = {
  tasks: Task[];
  workItems: WorkItem[];
  rhythms: Rhythm[];
  rhythmLogs: RhythmLog[];
  /** Ids of modules that are active; work of paused and archived modules is not offered. */
  activeModuleIds: ReadonlySet<string>;
  now: Date;
};

/** Everything that can be worked on now, in order. */
export function todayCandidates(input: TodayInput): Candidate[] {
  const { tasks, workItems, rhythms, rhythmLogs, activeModuleIds, now } = input;
  const today = dayKey(now);
  const candidates: Candidate[] = [];

  const openTasks = tasks.filter(
    (task) =>
      (task.status === "todo" || task.status === "doing") && activeModuleIds.has(task.module_id),
  );
  for (const task of openTasks) {
    // A task planned for a later day waits for that day.
    if (task.planned_date !== null && task.planned_date > today) continue;
    candidates.push({
      type: "task",
      id: task.id,
      title: task.title,
      moduleId: task.module_id,
      minutes: task.est_minutes,
      dueAt: task.due_at,
      importance: task.importance,
      createdAt: task.created_at,
      task,
    });
  }

  const itemsWithOpenTask = new Set(openTasks.map((task) => task.work_item_id));
  // An item split into pieces is done through its pieces: the pieces stand for it.
  const splitItems = new Set(
    workItems
      .filter((item) => item.status === "active" || item.status === "waiting")
      .map((item) => item.parent_id),
  );
  for (const item of workItems) {
    if (item.status !== "active" || !activeModuleIds.has(item.module_id)) continue;
    // Its open sitting already stands for it in the list.
    if (itemsWithOpenTask.has(item.id)) continue;
    if (splitItems.has(item.id)) continue;
    if (item.earliest_at !== null && Date.parse(item.earliest_at) > now.getTime()) continue;
    if (isBlocked(item, workItems)) continue;
    candidates.push({
      type: "item",
      id: item.id,
      title: item.title,
      moduleId: item.module_id,
      minutes: nextSessionMinutes(item),
      dueAt: item.due_at,
      importance: item.importance,
      createdAt: item.created_at,
      item,
    });
  }

  for (const rhythm of rhythms) {
    if (!rhythm.active || !activeModuleIds.has(rhythm.module_id)) continue;
    const progress = rhythmProgress(rhythm, rhythmLogs, now);
    if (progress.debt === 0) continue;
    // Not twice on the same day unless it is a daily rhythm with a higher target.
    const doneToday = rhythmLogs.filter(
      (log) => log.rhythm_id === rhythm.id && log.done_on === today,
    ).length;
    if (rhythm.period !== "day" && doneToday > 0) continue;
    candidates.push({
      type: "rhythm",
      id: rhythm.id,
      title: rhythm.title,
      moduleId: rhythm.module_id,
      minutes: rhythm.est_minutes,
      dueAt: null,
      importance: 2,
      createdAt: rhythm.created_at,
      progress: `${progress.done}/${progress.target}`,
    });
  }

  return candidates.sort(compareCandidates);
}

/**
 * Blocks that touch the given day and have not been cancelled, in order. A block that runs
 * past midnight belongs to both days.
 */
export function blocksOfDay(blocks: Block[], day: string): Block[] {
  const dayStart = istanbulInstant(day).getTime();
  const dayEnd = istanbulInstant(shiftDay(day, 1)).getTime();
  return blocks
    .filter(
      (block) =>
        block.status !== "cancelled" &&
        Date.parse(block.starts_at) < dayEnd &&
        Date.parse(block.ends_at) > dayStart,
    )
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

/** The block that is running at this moment, if any. */
export function currentBlock(blocks: Block[], now: Date): Block | null {
  const time = now.getTime();
  return (
    blocks.find(
      (block) =>
        block.status === "planned" &&
        Date.parse(block.starts_at) <= time &&
        time < Date.parse(block.ends_at),
    ) ?? null
  );
}

export type NowState =
  | { kind: "running"; session: Session; task: Task | null; rhythm: Rhythm | null }
  | { kind: "block"; block: Block }
  | { kind: "suggest"; candidate: Candidate }
  | { kind: "empty" };

/**
 * What the "now" card shows. A running session wins over everything; then a fixed block that
 * is in progress; then the first thing in the list.
 */
export function nowState(input: {
  openSession: Session | null;
  tasks: Task[];
  rhythms: Rhythm[];
  blocks: Block[];
  candidates: Candidate[];
  now: Date;
}): NowState {
  const { openSession, tasks, rhythms, blocks, candidates, now } = input;
  if (openSession) {
    return {
      kind: "running",
      session: openSession,
      task: tasks.find((task) => task.id === openSession.task_id) ?? null,
      rhythm: rhythms.find((rhythm) => rhythm.id === openSession.rhythm_id) ?? null,
    };
  }
  const block = currentBlock(blocks, now);
  if (block) return { kind: "block", block };
  if (candidates.length > 0) return { kind: "suggest", candidate: candidates[0] };
  return { kind: "empty" };
}

/** Whole minutes a session has been running, from the server's start time. */
export function elapsedMinutes(startedAt: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(startedAt)) / 60_000));
}

/**
 * Everything of one module that is still open, in date order: for the "upcoming" region of
 * the module's page. Unlike the Today list it also shows what is waiting or not due to start
 * yet, because the page is where the whole picture of the module lives.
 */
export function moduleUpcoming(input: {
  moduleId: string;
  tasks: Task[];
  workItems: WorkItem[];
  rhythms: Rhythm[];
  rhythmLogs: RhythmLog[];
  now: Date;
}): Candidate[] {
  const { moduleId, now } = input;
  const candidates: Candidate[] = [];
  const openItems = input.workItems.filter(
    (item) => item.module_id === moduleId && item.status !== "done" && item.status !== "dropped",
  );
  const openItemIds = new Set(openItems.map((item) => item.id));
  const openTasks = input.tasks.filter(
    (task) => task.module_id === moduleId && ["todo", "doing", "waiting"].includes(task.status),
  );
  for (const task of openTasks) {
    // A sitting of an open work item is not listed on its own: the item's row stands for it,
    // and that row is where the item is edited, finished or dropped. "Başla" on the item
    // goes on with the sitting that is already open.
    if (task.work_item_id !== null && openItemIds.has(task.work_item_id)) continue;
    candidates.push({
      type: "task",
      id: task.id,
      title: task.title,
      moduleId,
      minutes: task.est_minutes,
      dueAt: task.due_at,
      importance: task.importance,
      createdAt: task.created_at,
      task,
    });
  }
  for (const item of openItems) {
    candidates.push({
      type: "item",
      id: item.id,
      title: item.title,
      moduleId,
      minutes: nextSessionMinutes(item),
      dueAt: item.due_at,
      importance: item.importance,
      createdAt: item.created_at,
      item,
    });
  }
  for (const rhythm of input.rhythms) {
    if (rhythm.module_id !== moduleId || !rhythm.active) continue;
    const progress = rhythmProgress(rhythm, input.rhythmLogs, now);
    candidates.push({
      type: "rhythm",
      id: rhythm.id,
      title: rhythm.title,
      moduleId,
      minutes: rhythm.est_minutes,
      dueAt: null,
      importance: 2,
      createdAt: rhythm.created_at,
      progress: `${progress.done}/${progress.target}`,
    });
  }
  return candidates.sort(compareCandidates);
}

/**
 * Minutes spent per week in a module over the last `weeks` weeks, oldest first, the current
 * week last. Only finished, measured sessions count.
 */
export function minutesPerWeek(
  sessions: Session[],
  moduleId: string,
  now: Date,
  weeks = 8,
): { weekStart: string; minutes: number }[] {
  const current = weekStart(dayKey(now));
  const starts = Array.from({ length: weeks }, (_, index) =>
    shiftDay(current, -7 * (weeks - 1 - index)),
  );
  const totals = new Map(starts.map((start) => [start, 0]));
  for (const session of sessions) {
    if (session.module_id !== moduleId || session.ended_at === null || !session.measured) continue;
    const week = weekStart(dayKey(new Date(session.started_at)));
    if (!totals.has(week)) continue;
    const minutes = (Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60_000;
    totals.set(week, totals.get(week)! + minutes);
  }
  return starts.map((start) => ({ weekStart: start, minutes: Math.round(totals.get(start)!) }));
}
