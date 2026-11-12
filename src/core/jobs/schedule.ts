import { dayKey, formatTime, istanbulInstant, weekStart } from "@/lib/date";

// The scheduler's rules (docs/02-mimari.md, "Zamanlanmış işler"). Pure: the time comes in as a
// parameter. A job runs once per period: every Istanbul hour, every day after its hour, every
// week after Monday's hour. A period that was missed runs once when the next tick comes; the
// periods before it are not run one by one.

export type JobEvery = "hour" | "day" | "week";
export type JobTiming = { every: JobEvery; at?: string };
export type ScheduledJob = JobTiming & { id: string };

export type JobRun = {
  job: string;
  slot: string;
  status: "running" | "done" | "failed";
  attempts: number;
  startedAt: Date;
};

/** Tries per period: a failing job is not run again and again. */
export const JOB_ATTEMPTS = 3;
/** A run "running" longer than this was cut off (the function's time ran out). */
export const JOB_STALE_MS = 30 * 60_000;

/** The period a job is in now, or null when its hour has not come yet in this period. */
export function slotOf(job: JobTiming, now: Date): string | null {
  const today = dayKey(now);
  if (job.every === "hour") return `${today}T${formatTime(now).slice(0, 2)}`;
  const first = job.every === "day" ? today : weekStart(today);
  return now.getTime() >= istanbulInstant(first, job.at ?? "00:00").getTime() ? first : null;
}

export type DueJob<J extends ScheduledJob = ScheduledJob> = {
  job: J;
  slot: string;
  /** The period's run so far (failed, or cut off), to be tried again; null: the first try. */
  run: JobRun | null;
};

/** The jobs to run now, in the order given. */
export function dueJobs<J extends ScheduledJob>(
  jobs: readonly J[],
  now: Date,
  runs: readonly JobRun[],
): DueJob<J>[] {
  const due: DueJob<J>[] = [];
  for (const job of jobs) {
    const slot = slotOf(job, now);
    if (!slot) continue;
    const run = runs.find((candidate) => candidate.job === job.id && candidate.slot === slot);
    if (!run) {
      due.push({ job, slot, run: null });
      continue;
    }
    if (run.status === "done" || run.attempts >= JOB_ATTEMPTS) continue;
    const cutOff = now.getTime() - run.startedAt.getTime() > JOB_STALE_MS;
    if (run.status === "failed" || cutOff) due.push({ job, slot, run });
  }
  return due;
}
