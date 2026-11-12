import { describe, expect, it } from "vitest";
import { dueJobs, JOB_ATTEMPTS, JOB_STALE_MS, type JobRun, slotOf } from "./schedule";

// The scheduler's pure rules (docs/02-mimari.md, "Zamanlanmış işler"): which period a job is in,
// whether it is due, and when a run is tried again.

const at = (iso: string) => new Date(iso);

describe("the period of a job", () => {
  it("is the Istanbul hour for an hourly job", () => {
    expect(slotOf({ every: "hour" }, at("2026-11-12T10:20:00+03:00"))).toBe("2026-11-12T10");
    // 23:30 in Istanbul is still the same day there, 20:30 UTC.
    expect(slotOf({ every: "hour" }, at("2026-11-12T20:30:00Z"))).toBe("2026-11-12T23");
    expect(slotOf({ every: "hour" }, at("2026-11-12T21:05:00Z"))).toBe("2026-11-13T00");
  });

  it("is the day for a daily job, once its hour has come", () => {
    const job = { every: "day" as const, at: "05:00" };
    expect(slotOf(job, at("2026-11-12T04:59:00+03:00"))).toBeNull();
    expect(slotOf(job, at("2026-11-12T05:00:00+03:00"))).toBe("2026-11-12");
    expect(slotOf(job, at("2026-11-12T23:59:00+03:00"))).toBe("2026-11-12");
    expect(slotOf({ every: "day" }, at("2026-11-12T00:01:00+03:00"))).toBe("2026-11-12");
  });

  it("is the week's Monday for a weekly job, once Monday's hour has come", () => {
    const job = { every: "week" as const, at: "06:00" };
    // Monday 9 November 2026.
    expect(slotOf(job, at("2026-11-09T05:00:00+03:00"))).toBeNull();
    expect(slotOf(job, at("2026-11-09T06:00:00+03:00"))).toBe("2026-11-09");
    // Missed on Monday: any later day of the week still runs it, once.
    expect(slotOf(job, at("2026-11-13T02:00:00+03:00"))).toBe("2026-11-09");
    expect(slotOf(job, at("2026-11-15T23:00:00+03:00"))).toBe("2026-11-09");
  });
});

describe("which jobs are due", () => {
  const jobs = [
    { id: "core/week", every: "day" as const, at: "00:15" },
    { id: "core/sessions", every: "hour" as const },
    { id: "deneme/ozet", every: "day" as const, at: "05:00" },
  ];
  const now = at("2026-11-12T03:20:00+03:00");
  const run = (over: Partial<JobRun>): JobRun => ({
    job: "core/week",
    slot: "2026-11-12",
    status: "done",
    attempts: 1,
    startedAt: at("2026-11-12T00:20:00+03:00"),
    ...over,
  });

  it("are the jobs whose period came and that have not run in it", () => {
    expect(dueJobs(jobs, now, []).map((due) => [due.job.id, due.slot, due.run])).toEqual([
      ["core/week", "2026-11-12", null],
      ["core/sessions", "2026-11-12T03", null],
    ]);
    // Yesterday's run is not today's.
    const yesterday = run({ slot: "2026-11-11" });
    expect(dueJobs(jobs, now, [yesterday]).map((due) => due.job.id)).toContain("core/week");
  });

  it("leaves a job alone once it ran in the period, or while it runs", () => {
    expect(dueJobs(jobs, now, [run({})]).map((due) => due.job.id)).toEqual(["core/sessions"]);
    const running = run({ status: "running", startedAt: at("2026-11-12T03:10:00+03:00") });
    expect(dueJobs(jobs, now, [running]).map((due) => due.job.id)).toEqual(["core/sessions"]);
  });

  it("tries a failed run again, up to three times in the period", () => {
    const failed = run({ status: "failed", attempts: 1 });
    const [again] = dueJobs(jobs, now, [failed]);
    expect(again).toMatchObject({ job: { id: "core/week" }, slot: "2026-11-12", run: failed });
    const spent = run({ status: "failed", attempts: JOB_ATTEMPTS });
    expect(dueJobs(jobs, now, [spent]).map((due) => due.job.id)).toEqual(["core/sessions"]);
  });

  it("takes a run left 'running' too long for cut off, and tries it again", () => {
    const stuck = run({
      status: "running",
      startedAt: new Date(now.getTime() - JOB_STALE_MS - 60_000),
    });
    expect(dueJobs(jobs, now, [stuck]).map((due) => due.job.id)).toContain("core/week");
  });
});
