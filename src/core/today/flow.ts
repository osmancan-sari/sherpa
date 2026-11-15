import type { Assignment, Plan, PlanInput } from "@/core/planner";
import type { Block, Rhythm, Session, Task, WorkItem } from "@/core/types";
import { formatMinutes } from "@/lib/date";
import { blocksOfDay } from "./select";

// Today's day flow and "Sıradakiler" as data (docs/tasarim/ekranlar/bugun.md, 4.2; Ç4c): the
// strip runs from the waking to the expected bedtime; what was done is drawn from the day's
// sessions, what comes from the plan; fixed blocks over both. "Sıradakiler" is the day's rest in
// order: work, the breaks between it, the fixed blocks. Pure: the screens resolve the colours.

/** The rows of a piece of work, for its colour (the facet's, else the module's). */
export type FlowWork = { task?: Task | null; item?: WorkItem | null; rhythm?: Rhythm | null };

export type FlowPiece = {
  key: string;
  kind: "work" | "block" | "travel";
  start: Date;
  end: Date;
  /** The work's or the block's name; for travel "yol 35 dk". */
  label: string;
  moduleId: string | null;
  work: FlowWork;
};

export type DayFlow = {
  /** The strip's ends: the waking (or the day's start) and the expected bedtime. */
  from: Date;
  to: Date;
  /** For the header ("07:02 uyanış · 23:00 yatış"): the waking only with the day's frame. */
  wake: Date | null;
  bed: Date;
  pieces: FlowPiece[];
  /** The wake-bound and the bed-bound parts of the day, drawn a shade lighter. */
  parts: { key: "wake" | "bed"; start: Date; end: Date; label: string }[];
};

function workOf(input: PlanInput, session: Session): FlowWork {
  const task = session.task_id
    ? (input.tasks.find((row) => row.id === session.task_id) ?? null)
    : null;
  const item = task?.work_item_id
    ? (input.workItems.find((row) => row.id === task.work_item_id) ?? null)
    : null;
  const rhythm = session.rhythm_id
    ? (input.rhythms.find((row) => row.id === session.rhythm_id) ?? null)
    : null;
  return { task, item, rhythm };
}

function assignmentWork(assignment: Assignment): FlowWork {
  const { candidate } = assignment;
  return { task: candidate.task, item: candidate.item, rhythm: candidate.rhythm };
}

export function dayFlowOf(input: PlanInput, plan: Plan, sessions: Session[]): DayFlow {
  const now = input.now.getTime();
  const wake = plan.frame?.wake ?? null;
  const fromTime = Math.min((wake ?? input.dayStart).getTime(), now);
  const bed = plan.frame?.bed ?? input.bedtime;
  const toTime = Math.max(bed.getTime(), fromTime + 60 * 60_000);
  const pieces: FlowPiece[] = [];

  // What was done today, and the work that runs now: from the sessions.
  for (const session of sessions) {
    const started = Date.parse(session.started_at);
    const ended = session.ended_at ? Date.parse(session.ended_at) : now;
    if (ended <= fromTime || started >= toTime || ended <= started) continue;
    const work = workOf(input, session);
    pieces.push({
      key: `session-${session.id}`,
      kind: "work",
      start: new Date(started),
      end: new Date(Math.min(ended, toTime)),
      label: work.task?.title ?? work.rhythm?.title ?? session.title ?? "Oturum",
      moduleId: session.module_id,
      work,
    });
  }

  // What comes: the plan's work, with its travel before and after.
  for (const slot of plan.slots) {
    const assignment = slot.assignment;
    if (!assignment) continue;
    const { candidate } = assignment;
    const work = assignmentWork(assignment);
    const start = slot.start.getTime();
    const end = slot.end.getTime();
    const trip = (from: number, to: number, side: string, minutes: number) =>
      pieces.push({
        key: `travel-${side}-${candidate.type}-${candidate.id}-${start}`,
        kind: "travel",
        start: new Date(from),
        end: new Date(to),
        label: `yol ${minutes} dk`,
        moduleId: candidate.moduleId,
        work,
      });
    if (assignment.travelBefore) {
      trip(start - assignment.travelBefore * 60_000, start, "b", assignment.travelBefore);
    }
    pieces.push({
      key: `slot-${candidate.type}-${candidate.id}-${start}`,
      kind: "work",
      start: slot.start,
      end: slot.end,
      label: candidate.title,
      moduleId: candidate.moduleId,
      work,
    });
    if (assignment.travelAfter) {
      trip(end, end + assignment.travelAfter * 60_000, "a", assignment.travelAfter);
    }
  }

  // The fixed blocks, the whole height of the strip.
  for (const block of blocksOfDay(input.blocks, input.date)) {
    if (block.status === "cancelled") continue;
    const start = Date.parse(block.starts_at);
    const end = Date.parse(block.ends_at);
    if (end <= fromTime || start >= toTime) continue;
    pieces.push({
      key: `block-${block.id}`,
      kind: "block",
      start: new Date(start),
      end: new Date(end),
      label: block.title,
      moduleId: null,
      work: {},
    });
  }
  pieces.sort((a, b) => a.start.getTime() - b.start.getTime());

  const parts: DayFlow["parts"] = plan.frame
    ? [
        {
          key: "wake" as const,
          start: plan.frame.wake,
          end: plan.frame.workStart,
          label: "uyanışa bağlı",
        },
        {
          key: "bed" as const,
          start: plan.frame.workEnd,
          end: plan.frame.bed,
          label: "yatışa bağlı",
        },
      ].filter((part) => part.end > part.start)
    : [];

  return { from: new Date(fromTime), to: new Date(toTime), wake, bed, pieces, parts };
}

export type UpNextRow =
  | {
      kind: "work";
      key: string;
      assignment: Assignment;
      start: Date;
      end: Date;
      /** Bound to the waking or the bedtime: its time is written ("Rutin · 9 dk · 22:20"). */
      anchored: boolean;
    }
  | { kind: "break"; key: string; start: Date; end: Date; minutes: number }
  | { kind: "block"; key: string; block: Block; start: Date; end: Date };

/**
 * "Sıradakiler" (Ç4a, Ç4c): the day's rest of the plan in time order, without the work on the
 * card. Work, the breaks that lie between work ("mola · 15 dk"), and the fixed blocks still to
 * come. Closed, the list shows only its first work rows.
 */
export function upNextOf(input: PlanInput, plan: Plan, currentId: string | null): UpNextRow[] {
  const now = input.now.getTime();
  const rows: UpNextRow[] = [];
  for (const slot of plan.slots) {
    const assignment = slot.assignment;
    if (assignment) {
      if (assignment.candidate.id === currentId) continue;
      rows.push({
        kind: "work",
        key: `${assignment.candidate.type}-${assignment.candidate.id}-${slot.start.getTime()}`,
        assignment,
        start: slot.start,
        end: slot.end,
        anchored: slot.part !== undefined,
      });
    } else if (slot.kind === "break" && slot.end.getTime() > now) {
      rows.push({
        kind: "break",
        key: `break-${slot.start.getTime()}`,
        start: slot.start,
        end: slot.end,
        minutes: slot.minutes,
      });
    }
  }
  for (const block of blocksOfDay(input.blocks, input.date)) {
    if (block.status === "cancelled" || Date.parse(block.starts_at) < now) continue;
    rows.push({
      kind: "block",
      key: `block-${block.id}`,
      block,
      start: new Date(block.starts_at),
      end: new Date(block.ends_at),
    });
  }
  rows.sort((a, b) => a.start.getTime() - b.start.getTime());
  // A break counts only between two pieces of work: not before the first, not after the last.
  const works = rows.flatMap((row, index) => (row.kind === "work" ? [index] : []));
  const first = works[0] ?? Infinity;
  const last = works[works.length - 1] ?? -Infinity;
  return rows.filter((row, index) => row.kind !== "break" || (index > first && index < last));
}

/** The first `count` work rows: "Sıradakiler" closed. */
export function closedUpNext(rows: UpNextRow[], count: number) {
  return rows.filter((row) => row.kind === "work").slice(0, count);
}

/** "mola · 15 dk". */
export function breakText(minutes: number): string {
  return `mola · ${formatMinutes(minutes)}`;
}
