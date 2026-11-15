import type { WeekLoad } from "@/core/planner";
import type { Rhythm, Session, Task, WorkItem } from "@/core/types";
import { dayKey, formatMinutes, inIstanbul, shiftDay } from "@/lib/date";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import type { FlowWork } from "./flow";

// Takvim's words and lists (docs/tasarim/ekranlar/takvim.md; Ç4c): a day's deadlines, what was
// done on a day, the week's name, a deadline's line and a coming week's note. Pure; the screen
// resolves colours and draws.

/** "9–15 Kasım"; across months "30 Kasım–6 Aralık"; across years with the year. */
export function weekLabel(week: string): string {
  const from = inIstanbul(new Date(`${week}T12:00:00Z`));
  const to = inIstanbul(new Date(`${shiftDay(week, 6)}T12:00:00Z`));
  if (from.getMonth() === to.getMonth()) {
    return `${from.getDate()}–${format(to, "d MMMM", { locale: tr })}`;
  }
  const end = from.getFullYear() === to.getFullYear() ? "d MMMM" : "d MMMM yyyy";
  return `${format(from, "d MMMM", { locale: tr })}–${format(to, end, { locale: tr })}`;
}

/**
 * The deadline's line under a week's work: "Teslim Pazar, 15 Kas" within the coming six days,
 * else "Teslim 3 Ara".
 */
export function dueText(dueAt: string | Date, now: Date): string {
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  const day = dayKey(due);
  const today = dayKey(now);
  const local = inIstanbul(due);
  if (day >= today && day <= shiftDay(today, 6)) {
    return `Teslim ${format(local, "EEEE, d MMM", { locale: tr })}`;
  }
  return `Teslim ${format(local, "d MMM", { locale: tr })}`;
}

/** A coming week that asks more than its time: "30 Kasım haftası: 34 sa iş, 30 sa vakit · 3 teslim". */
export function horizonNote(load: WeekLoad): string {
  const start = format(inIstanbul(new Date(`${load.weekStart}T12:00:00Z`)), "d MMMM", {
    locale: tr,
  });
  const base = `${start} haftası: ${formatMinutes(load.demandMinutes)} iş, ${formatMinutes(load.capacityMinutes)} vakit`;
  return load.deadlines.length > 0 ? `${base} · ${load.deadlines.length} teslim` : base;
}

export type DueRow = {
  id: string;
  title: string;
  moduleId: string;
  dueAt: Date;
  work: FlowWork;
};

/** "Teslim ve sınav": the work items and the tasks of their own due on the day, by the hour. */
export function dueOn(day: string, items: WorkItem[], tasks: Task[]): DueRow[] {
  const rows: DueRow[] = [];
  for (const item of items) {
    if (!item.due_at || item.status === "dropped" || dayKey(new Date(item.due_at)) !== day)
      continue;
    rows.push({
      id: item.id,
      title: item.title,
      moduleId: item.module_id,
      dueAt: new Date(item.due_at),
      work: { item },
    });
  }
  for (const task of tasks) {
    if (task.work_item_id !== null || !task.due_at || task.status === "dropped") continue;
    if (dayKey(new Date(task.due_at)) !== day) continue;
    rows.push({
      id: task.id,
      title: task.title,
      moduleId: task.module_id,
      dueAt: new Date(task.due_at),
      work: { task },
    });
  }
  return rows.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

export type DoneRow = {
  key: string;
  title: string;
  moduleId: string | null;
  minutes: number;
  work: FlowWork;
};

/**
 * "Yapılanlar": the work done on a day, from its ended sessions (a work's sessions added up), in
 * the order it was first started. Unfinished work is not shown (product rule 2).
 */
export function doneOn(
  day: string,
  sessions: Session[],
  rows: { tasks: Task[]; items: WorkItem[]; rhythms: Rhythm[] },
): DoneRow[] {
  const byKey = new Map<string, DoneRow & { first: number }>();
  for (const session of sessions) {
    if (!session.ended_at || dayKey(new Date(session.started_at)) !== day) continue;
    const task = session.task_id
      ? (rows.tasks.find((row) => row.id === session.task_id) ?? null)
      : null;
    const item = task?.work_item_id
      ? (rows.items.find((row) => row.id === task.work_item_id) ?? null)
      : null;
    const rhythm = session.rhythm_id
      ? (rows.rhythms.find((row) => row.id === session.rhythm_id) ?? null)
      : null;
    const key = session.task_id ?? session.rhythm_id ?? `session-${session.id}`;
    const title = task?.title ?? rhythm?.title ?? session.title;
    if (!title) continue;
    const started = Date.parse(session.started_at);
    const minutes = Math.max(0, Math.round((Date.parse(session.ended_at) - started) / 60_000));
    const known = byKey.get(key);
    if (known) {
      known.minutes += minutes;
      known.first = Math.min(known.first, started);
    } else {
      byKey.set(key, {
        key,
        title,
        moduleId: session.module_id,
        minutes,
        work: { task, item, rhythm },
        first: started,
      });
    }
  }
  return [...byKey.values()]
    .sort((a, b) => a.first - b.first)
    .map((row) => ({
      key: row.key,
      title: row.title,
      moduleId: row.moduleId,
      minutes: row.minutes,
      work: row.work,
    }));
}

/** The task ids of a day's sessions whose rows the screen may not have (older finished work). */
export function sessionTaskIds(day: string, sessions: Session[]): string[] {
  return [
    ...new Set(
      sessions
        .filter((row) => row.task_id && dayKey(new Date(row.started_at)) === day)
        .map((row) => row.task_id!),
    ),
  ];
}
