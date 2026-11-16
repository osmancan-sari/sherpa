import { rangesFor } from "@/core/contract/frame";
import type { Candidate, PlanInput } from "@/core/planner";
import { istanbulInstant } from "@/lib/date";
import type { Chain, ChainRow } from "./chain";

// Sabah açılışı (16 Nov 2026; docs/06-modul-sozlesmesi.md, "Sahne", rule 7; docs/09-kararlar.md):
// in the morning the app opens on the welcome of the scene that would show the wake chain's first
// work, instead of the Today screen. Pure: whether the moment is the welcome's, and for what.
// Which module draws it (its scene and its `welcome`) the screen resolves.

/** How long after the day's latest waking the welcome still comes, in minutes. */
export const WELCOME_AFTER_LATEST = 120;

export type Welcome = {
  /** The recorded waking (told from outside); null: "Başla" records it. */
  woke: Date | null;
  /** What "Başla" starts: the wake chain's first work. */
  target: Pick<Candidate, "type" | "id">;
  row: ChainRow;
};

/**
 * The welcome, when the moment is its own: the day's frame is on; no waking is recorded, or one
 * told from outside (`core/wake`; one said on a screen or estimated from a touch has had its
 * moment); the clock is between the start of today's waking range and two hours after today's
 * latest waking; nothing runs; the wake chain has not begun (nothing in it done, running or put
 * off today; with a recorded waking, all of it still offered) and its first work can be started;
 * and "Şimdi değil" was not said today on this device (`dismissed`). Null otherwise: the Today
 * screen as it is.
 */
export function welcomeOf(
  input: PlanInput,
  wake: Chain | null,
  dismissed: boolean,
): Welcome | null {
  const frame = input.frame;
  const settings = input.settings.frame;
  if (dismissed || !frame || !settings || !wake) return null;
  if (input.openSession || frame.bedAt) return null;
  let woke: Date | null = null;
  if (frame.woke) {
    if (frame.estimated || frame.wokeFrom !== "outside") return null;
    woke = frame.wake;
  }
  const now = input.now.getTime();
  const from = istanbulInstant(input.date, rangesFor(settings, input.dayType).wake[0]).getTime();
  const until = frame.lastNight.latestWake.getTime() + WELCOME_AFTER_LATEST * 60_000;
  if (now < from || now > until) return null;
  if (woke) {
    // A real waking: its chain must still be offered as a whole, as for the start the waking told
    // from outside makes by itself (`wakeChainStart`); once its time went by, its moment is over.
    if (wake.rows.some((row) => row.state !== "next")) return null;
  } else if (wake.rows.some((row) => row.state === "done" || row.state === "running")) {
    return null;
  } else if (wake.rows.some((row) => putOffToday(input, row))) {
    // Without a waking the plan runs from the expected one, so its wake-bound work may read as
    // passed by the clock; "Başla" writes the waking now and the chain is offered again. Only
    // work put off today ("Ertele") means the chain was begun.
    return null;
  }
  const first = wake.rows[0];
  const target = first?.target ?? (first ? targetOf(first) : null);
  if (!first || !target) return null;
  return { woke, target, row: first };
}

/** A row's own work as a session's target (a row passed by the clock carries none). */
function targetOf(row: ChainRow): Pick<Candidate, "type" | "id"> | null {
  const { type, id } = row.work;
  return (type === "task" || type === "item" || type === "rhythm") && id ? { type, id } : null;
}

/** Put off today with "Ertele": a skipped item or rhythm, a task moved to tomorrow today. */
function putOffToday(input: PlanInput, row: ChainRow): boolean {
  if ((input.skipped ?? []).includes(row.id)) return true;
  const task = row.work.task;
  if (!task || task.status !== "todo" || task.defer_count === 0) return false;
  const dayFrom = istanbulInstant(input.date).getTime();
  return (
    task.planned_date !== null &&
    task.planned_date > input.date &&
    Date.parse(task.updated_at) >= dayFrom
  );
}
