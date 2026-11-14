import type { SceneChain } from "@/core/contract/types";
import type { Candidate, Plan, PlanInput } from "@/core/planner";
import { nextSessionMinutes } from "@/core/contract/envelope";
import { candidatesOf, estimateMultiplier } from "@/core/planner/candidates";
import { effectiveTiming, rhythmTiming } from "@/core/planner/timing";
import type { Rhythm, Task, WorkItem } from "@/core/types";
import { istanbulInstant, shiftDay } from "@/lib/date";

// The anchored chains (docs/06-modul-sozlesmesi.md, "Diziler"; docs/04-planlayici.md, "Diziler
// (Ç3f)"): the day's wake-bound and bed-bound work as one list each, built from the plan's
// anchored slots and the day's records. Pure: it reads the plan, it never changes it. The
// planner gives the order; what was done or passed today keeps its place by its `order`.

export type Anchor = "wake" | "bed";
export type ChainState = SceneChain["items"][number]["state"];

/** A row of a chain as the core holds it; a scene gets less of it (`sceneChain`). */
export type ChainRow = {
  /** The task or the rhythm (an item's sitting: the sitting). */
  id: string;
  title: string;
  moduleId: string;
  minutes: number;
  state: ChainState;
  /** What "Başla" starts; null for work that is done or passed. */
  target: Pick<Candidate, "type" | "id"> | null;
  /** The work as the colour resolver reads it. */
  work: {
    type?: string;
    id?: string;
    task?: Task | null;
    item?: WorkItem | null;
    rhythm?: Rhythm | null;
  };
  order: number | null;
};

export type Chain = { anchor: Anchor; rows: ChainRow[] };

/** What the screens resolve for a chain's rows: the module, the colour, the facet. */
export type ChainLook = {
  module: (moduleId: string) => { slug: string; name: string } | null;
  color: (row: ChainRow) => string;
  facet: (row: ChainRow) => { key: string; name: string } | null;
};

const RANK: Record<ChainState, number> = { running: 3, next: 2, done: 1, passed: 0 };

/** The planner's rounding of a length (candidates.ts): the same minutes as the plan shows. */
const round5 = (minutes: number) => Math.max(5, Math.round(minutes / 5) * 5);

/** The day's chain on one anchor; null when the frame is off or nothing is bound to it. */
export function chainOf(input: PlanInput, plan: Plan, anchor: Anchor): Chain | null {
  if (!input.frame) return null;
  const session = input.openSession ?? null;
  const runningIds = new Set([session?.task_id, session?.rhythm_id].filter(Boolean) as string[]);
  const itemOf = (task: Task) =>
    task.work_item_id ? input.workItems.find((row) => row.id === task.work_item_id) : undefined;
  const taskAnchor = (task: Task) => effectiveTiming(task, itemOf(task))?.anchor ?? null;
  const taskOrder = (task: Task) => effectiveTiming(task, itemOf(task))?.order ?? null;
  // "Today" is the planning day, not the calendar day: past midnight, until the night ends, the
  // bed chain is still the evening's (docs/04-planlayici.md, `planningDay`). From the day's
  // midnight on; nothing is recorded ahead of the clock.
  const dayFrom = istanbulInstant(input.date).getTime();
  const today = (instant: string | null) => instant !== null && Date.parse(instant) >= dayFrom;

  const found = new Map<string, ChainRow & { seq: number }>();
  let seq = 0;
  const add = (row: ChainRow) => {
    const known = found.get(row.id);
    if (known && RANK[known.state] >= RANK[row.state]) return;
    found.set(row.id, { ...row, seq: known?.seq ?? seq++ });
  };
  const fromCandidate = (candidate: Candidate, state: ChainState): ChainRow => ({
    id: candidate.id,
    title: candidate.title,
    moduleId: candidate.moduleId,
    minutes: candidate.minutes,
    state,
    target:
      state === "next" || state === "running" ? { type: candidate.type, id: candidate.id } : null,
    work: candidate,
    order: candidate.timing?.order ?? null,
  });
  const fromTask = (task: Task, state: ChainState): ChainRow => ({
    id: task.id,
    title: task.title,
    moduleId: task.module_id,
    minutes: round5(task.est_minutes * estimateMultiplier(input, task.module_id, task.kind)),
    state,
    target: state === "running" ? { type: "task", id: task.id } : null,
    work: { type: "task", id: task.id, task, item: itemOf(task) ?? null },
    order: taskOrder(task),
  });
  const fromRhythm = (rhythm: Rhythm, state: ChainState): ChainRow => ({
    id: rhythm.id,
    title: rhythm.title,
    moduleId: rhythm.module_id,
    minutes: Math.min(90, round5(rhythm.est_minutes)),
    state,
    target: state === "running" ? { type: "rhythm", id: rhythm.id } : null,
    work: { type: "rhythm", id: rhythm.id, rhythm },
    order: rhythmTiming(rhythm)?.order ?? null,
  });
  const active = new Set(
    input.modules.filter((mod) => mod.status === "active").map((mod) => mod.id),
  );

  // Done today: tasks (and an item's sittings) finished today, rhythms logged today.
  const doneTasks = input.tasks
    .filter(
      (task) =>
        task.status === "done" &&
        today(task.done_at) &&
        active.has(task.module_id) &&
        taskAnchor(task) === anchor,
    )
    .sort((a, b) => Date.parse(a.done_at!) - Date.parse(b.done_at!));
  for (const task of doneTasks) add(fromTask(task, "done"));
  // A log carries the calendar day; past midnight the evening's log is on the next one.
  const tomorrow = shiftDay(input.date, 1);
  const loggedToday = new Set(
    input.rhythmLogs
      .filter(
        (log) => log.done_on === input.date || (log.done_on === tomorrow && today(log.created_at)),
      )
      .map((log) => log.rhythm_id),
  );
  for (const rhythm of input.rhythms) {
    if (!loggedToday.has(rhythm.id) || !rhythm.active || !active.has(rhythm.module_id)) continue;
    if (rhythmTiming(rhythm)?.anchor === anchor) add(fromRhythm(rhythm, "done"));
  }
  const done = new Set(found.keys());

  // The plan's anchored slots: running or next.
  for (const slot of plan.slots) {
    if (slot.part !== anchor || !slot.assignment) continue;
    const { candidate } = slot.assignment;
    const running = runningIds.has(candidate.id);
    // What is done today is done, even where the plan (by its calendar day) still offers it.
    if (!running && done.has(candidate.id)) continue;
    add(fromCandidate(candidate, running ? "running" : "next"));
  }
  // A running anchored work whose line is no longer offered is still the chain's.
  if (session?.task_id) {
    const task = input.tasks.find((row) => row.id === session.task_id);
    if (task && taskAnchor(task) === anchor) add(fromTask(task, "running"));
  } else if (session?.rhythm_id) {
    const rhythm = input.rhythms.find((row) => row.id === session.rhythm_id);
    if (rhythm && rhythmTiming(rhythm)?.anchor === anchor) add(fromRhythm(rhythm, "running"));
  }

  // Passed today: anchored work the plan no longer offers (its time went by), and work put off
  // today with "Ertele" (a task moved to tomorrow today, an item or a rhythm skipped).
  for (const candidate of candidatesOf(input).anchored) {
    if (candidate.timing?.anchor === anchor && !done.has(candidate.id)) {
      add(fromCandidate(candidate, "passed"));
    }
  }
  const skipped = new Set(input.skipped ?? []);
  for (const rhythm of input.rhythms) {
    if (
      skipped.has(rhythm.id) &&
      active.has(rhythm.module_id) &&
      rhythmTiming(rhythm)?.anchor === anchor
    ) {
      add(fromRhythm(rhythm, "passed"));
    }
  }
  for (const item of input.workItems) {
    if (!skipped.has(item.id) || !active.has(item.module_id) || item.status !== "active") continue;
    const timing = effectiveTiming(undefined, item);
    if (timing?.anchor !== anchor) continue;
    add({
      id: item.id,
      title: item.title,
      moduleId: item.module_id,
      minutes: nextSessionMinutes(item),
      state: "passed",
      target: null,
      work: { type: "item", id: item.id, item },
      order: timing.order ?? null,
    });
  }
  // A task put off today ("Ertele" moves it to tomorrow): planned for tomorrow, put off at least
  // once, changed today. A task moved to tomorrow by hand after an earlier "Ertele" reads the
  // same (known limit, docs/ILERLEME.md).
  for (const task of input.tasks) {
    if (task.status !== "todo" || !active.has(task.module_id) || task.defer_count === 0) continue;
    if (task.planned_date !== tomorrow || !today(task.updated_at)) continue;
    if (taskAnchor(task) === anchor) add(fromTask(task, "passed"));
  }

  if (found.size === 0) return null;
  const rows = [...found.values()]
    .sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
        a.seq - b.seq,
    )
    .map(({ seq: _seq, ...row }) => {
      void _seq;
      return row;
    });
  return { anchor, rows };
}

/** Both chains of the day. */
export function chainsOf(input: PlanInput, plan: Plan): { wake: Chain | null; bed: Chain | null } {
  return { wake: chainOf(input, plan, "wake"), bed: chainOf(input, plan, "bed") };
}

/** The chain a piece of work belongs to, if any. */
export function chainWith(
  chains: { wake: Chain | null; bed: Chain | null },
  id: string | null | undefined,
): Chain | null {
  if (!id) return null;
  for (const chain of [chains.wake, chains.bed]) {
    if (chain?.rows.some((row) => row.id === id)) return chain;
  }
  return null;
}

/** The first work still to do after `id` in its chain; null after the last or outside it. */
export function nextInChain(chain: Chain, id: string): ChainRow | null {
  const index = chain.rows.findIndex((row) => row.id === id);
  if (index < 0) return null;
  return chain.rows.slice(index + 1).find((row) => row.state === "next" && row.target) ?? null;
}

/**
 * The chain as a scene gets it: only the fields of `SceneChain` (rule 2: another module's row
 * carries no source, no meta, none of its module's data).
 */
export function sceneChain(chain: Chain, sceneModuleId: string, look: ChainLook): SceneChain {
  return {
    anchor: chain.anchor,
    items: chain.rows.map((row) => {
      const mod = look.module(row.moduleId);
      return {
        id: row.id,
        title: row.title,
        module: { slug: mod?.slug ?? "", name: mod?.name ?? "" },
        facet: look.facet(row),
        color: look.color(row),
        minutes: row.minutes,
        state: row.state,
        mine: row.moduleId === sceneModuleId,
      };
    }),
  };
}

const CHAIN_NAME: Record<Anchor, string> = { wake: "Sabah dizisi", bed: "Akşam dizisi" };

/**
 * The standard card's line (docs/05-arayuz.md, "Diziler"): "Sabah dizisi 2/3 · sırada Duş ve
 * hazırlık". What was passed is not counted. Null when the work is not in the chain.
 */
export function chainLine(chain: Chain, id: string): string | null {
  const counted = chain.rows.filter((row) => row.state !== "passed" || row.id === id);
  const index = counted.findIndex((row) => row.id === id);
  if (index < 0) return null;
  const next = nextInChain(chain, id);
  return `${CHAIN_NAME[chain.anchor]} ${index + 1}/${counted.length} · ${
    next ? `sırada ${next.title}` : "son iş"
  }`;
}

/**
 * Ç3f: what to start when the app comes to the front after a waking told from outside
 * (docs/06-modul-sozlesmesi.md, "Diziler" rule 5): the wake chain's first work, if "Uyandım
 * kendiliğinden başlatsın" is on, the waking is recorded (not estimated from a touch) and came
 * before the app came to the front (a "Uyandım" said on this screen starts its own way), nothing
 * runs, the chain has not begun today (nothing in it done or running) and it is still offered
 * (an hour after its end at most: then its work is passed). Null otherwise.
 */
export function wakeChainStart(
  input: PlanInput,
  wake: Chain | null,
  frontAt: Date,
): { target: Pick<Candidate, "type" | "id">; since: Date } | null {
  const frame = input.frame;
  if (!frame || !input.settings.frame?.startOnWake) return null;
  if (!frame.woke || frame.estimated || frame.wake.getTime() > frontAt.getTime()) return null;
  if (input.openSession || !wake) return null;
  if (wake.rows.some((row) => row.state === "done" || row.state === "running")) return null;
  const first = wake.rows.find((row) => row.state === "next" && row.target);
  return first?.target ? { target: first.target, since: frame.wake } : null;
}
