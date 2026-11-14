import type { NowState, PlanInput, PlanRows } from "@/core/planner";

// Rutin 1 (docs/06-modul-sozlesmesi.md, "Diziler" rule 6): after a scene's "Yatıyorum" its
// bedtime can be taken back for a while, and meanwhile the night screen is that scene's. Pure: the
// rows and the moment are parameters.

/** How long a scene's bedtime can be taken back (the database function holds the same). */
export const BED_UNDO_MINUTES = 10;

/**
 * Rutin 1: tonight's bedtime written by a scene's "Yatıyorum", while it can be taken back: the
 * session it closed, with its work, and until when. Null otherwise (or when the rows are not in).
 */
export function sceneBedtime(
  date: string,
  rows: PlanRows | undefined,
  now: Date,
): { state: Extract<NowState, { kind: "running" }>; at: Date; until: Date } | null {
  const day = rows?.days.find((row) => row.date === date);
  if (!rows || !day?.bed_session_id || !day.bed_at) return null;
  const until = new Date(Date.parse(day.bed_at) + BED_UNDO_MINUTES * 60_000);
  if (now >= until) return null;
  const session = rows.sessions.find((row) => row.id === day.bed_session_id);
  if (!session?.ended_at) return null;
  return {
    state: {
      kind: "running",
      session,
      task: session.task_id ? (rows.tasks.find((row) => row.id === session.task_id) ?? null) : null,
      rhythm: session.rhythm_id
        ? (rows.rhythms.find((row) => row.id === session.rhythm_id) ?? null)
        : null,
    },
    at: new Date(day.bed_at),
    until,
  };
}

/** Ç3g: "Yatıyorum" this long before tonight's bedtime range starts asks once (docs/05). */
export const BED_ASK_MINUTES = 120;

/**
 * Ç3g: whether a "Yatıyorum" at `at` asks first: when it is more than two hours before tonight's
 * bedtime range starts (without the frame: the finish line). Null when one tap is enough; else
 * the range's start and whether it is the frame's.
 */
export function bedAsks(
  input: Pick<PlanInput, "frame" | "finishLine">,
  at: Date,
): { start: Date; framed: boolean } | null {
  const start = input.frame?.bedStart ?? input.finishLine;
  if (at.getTime() >= start.getTime() - BED_ASK_MINUTES * 60_000) return null;
  return { start, framed: Boolean(input.frame?.bedStart) };
}
