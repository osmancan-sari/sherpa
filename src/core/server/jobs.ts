import "server-only";
import { timingSafeEqual } from "node:crypto";
import { aiConfigFromEnv } from "@/core/ai/config";
import type { ModuleContext, ModuleRegistry } from "@/core/contract/types";
import { ensureBlocksAhead } from "@/core/data/blocks";
import { closeUnansweredTold } from "@/core/data/session-events";
import { getOpenSession } from "@/core/data/sessions";
import { dueJobs, type JobRun, type ScheduledJob } from "@/core/jobs/schedule";
import { overrun } from "@/core/planner";
import type { Db } from "@/core/types";
import { activeModule, type ServerDeps, serverTold } from "./context";
import { actAs, jobUsers } from "./db";
import { keepWeekOnServer } from "./plan";

// The scheduler (docs/02-mimari.md, "Zamanlanmış işler"): one endpoint, /api/jobs/tick, called
// every 15 minutes by the database's own scheduler (pg_cron) and once a day by the host's. For
// every account, in that account's name, it runs the jobs whose period has come: the core's own
// and those of the modules switched on. Each run is written to `job_runs`; (account, job,
// period) is unique, so two ticks at once run a job once. A failing job is tried again at the
// next tick, at most three times in its period. Nothing here depends on a screen being open.

type CoreJob = ScheduledJob & { run: (deps: ServerDeps) => Promise<void> };

/** The core's own jobs, the same work the screens' keeper does while the app is open. */
export const CORE_JOBS: CoreJob[] = [
  {
    // The week's commitment: made when there is none (a new week), re-made on a trigger.
    id: "core/week",
    every: "day",
    at: "00:15",
    run: async (deps) => {
      await keepWeekOnServer(deps);
    },
  },
  {
    // The coming eight weeks of every weekly series.
    id: "core/blocks",
    every: "day",
    at: "00:30",
    run: async (deps) => {
      await ensureBlocksAhead(deps.db, deps.now());
    },
  },
  {
    // A session nobody answered "Devam ediyor musun?" for is closed at its estimate.
    id: "core/sessions",
    every: "hour",
    run: async (deps) => {
      const open = await getOpenSession(deps.db);
      if (!open) return;
      const estimate = open.task_id
        ? (await deps.db.from("tasks").select("est_minutes").eq("id", open.task_id).maybeSingle())
            .data?.est_minutes
        : open.rhythm_id
          ? (
              await deps.db
                .from("rhythms")
                .select("est_minutes")
                .eq("id", open.rhythm_id)
                .maybeSingle()
            ).data?.est_minutes
          : null;
      if (overrun(open, estimate ?? null, deps.now()) === "close") {
        await closeUnansweredTold(serverTold(deps), open.id);
      }
    },
  },
];

type Runnable = ScheduledJob & { run: () => Promise<void> };

export type TickSummary = { accounts: number; ran: number; failed: number };

/** Runs what is due, for every account (or the ones given: the tests). */
export async function runJobs(env: {
  registry: ModuleRegistry;
  now?: () => Date;
  ai?: ServerDeps["ai"];
  users?: string[];
}): Promise<TickSummary> {
  const now = env.now ?? (() => new Date());
  const users = env.users ?? (await jobUsers());
  const summary: TickSummary = { accounts: users.length, ran: 0, failed: 0 };
  for (const userId of users) {
    try {
      const db = await actAs(userId);
      const deps: ServerDeps = { db, registry: env.registry, now, ai: env.ai ?? aiConfigFromEnv() };
      const result = await runFor(deps);
      summary.ran += result.ran;
      summary.failed += result.failed;
    } catch (error) {
      // One account's trouble does not keep the others' jobs from running.
      summary.failed += 1;
      console.error("jobs for an account failed", error instanceof Error ? error.message : "");
    }
  }
  return summary;
}

async function runFor(deps: ServerDeps): Promise<{ ran: number; failed: number }> {
  const jobs: Runnable[] = CORE_JOBS.map((job) => ({ ...job, run: () => job.run(deps) }));
  for (const definition of deps.registry.list) {
    if (!definition.jobs?.length) continue;
    const active = await activeModule(deps, definition.slug);
    if (!active) continue;
    const ctx: ModuleContext = active.ctx;
    for (const job of definition.jobs) {
      jobs.push({
        id: `${definition.slug}/${job.key}`,
        every: job.every,
        at: job.at,
        run: () => job.run(ctx),
      });
    }
  }

  const runs = await recentRuns(deps.db);
  let ran = 0;
  let failed = 0;
  for (const due of dueJobs(jobs, deps.now(), runs)) {
    const id = await claim(deps.db, due.job.id, due.slot, due.run);
    if (!id) continue; // Another tick took it.
    try {
      await due.job.run();
      await finish(deps.db, id, "done", null);
      ran += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "failed";
      await finish(deps.db, id, "failed", message.slice(0, 300));
    }
  }
  return { ran, failed };
}

/** The runs of the last eight days: enough to know the week's. */
async function recentRuns(db: Db): Promise<JobRun[]> {
  const { data, error } = await db
    .from("job_runs")
    .select("job, slot, status, attempts, started_at")
    // Stamped by the database's clock, so counted back from the real time.
    .gte("started_at", new Date(Date.now() - 8 * 86_400_000).toISOString());
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    job: row.job,
    slot: row.slot,
    status: row.status,
    attempts: row.attempts,
    startedAt: new Date(row.started_at),
  }));
}

/**
 * Takes the period's run: a new row, or the failed (or cut-off) one, tried again. Null when
 * another tick took it first: the unique row, or the row changed under us.
 */
async function claim(db: Db, job: string, slot: string, previous: JobRun | null) {
  if (!previous) {
    const { data, error } = await db
      .from("job_runs")
      .insert({ job, slot, status: "running", attempts: 1 })
      .select("id")
      .single();
    if (error?.code === "23505") return null;
    if (error) throw new Error(error.message);
    return data.id;
  }
  const { data, error } = await db
    .from("job_runs")
    .update({
      status: "running",
      attempts: previous.attempts + 1,
      started_at: new Date().toISOString(),
      finished_at: null,
      error: null,
    })
    .eq("job", job)
    .eq("slot", slot)
    .eq("status", previous.status)
    .eq("attempts", previous.attempts)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.[0]?.id ?? null;
}

async function finish(db: Db, id: string, status: "done" | "failed", error: string | null) {
  const { error: failure } = await db
    .from("job_runs")
    .update({ status, error, finished_at: new Date().toISOString() })
    .eq("id", id);
  if (failure) throw new Error(failure.message);
}

/** The tick's key: `Authorization: Bearer <CRON_SECRET>`. False when no secret is set. */
export function tickAuthorized(header: string | null, secret = process.env.CRON_SECRET): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** GET (the host's cron) and POST (pg_cron) of /api/jobs/tick. Never returns anyone's data. */
export async function handleTick(
  request: Request,
  env: { registry: ModuleRegistry; now?: () => Date; ai?: ServerDeps["ai"]; users?: string[] },
): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  if (!tickAuthorized(request.headers.get("authorization"))) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }
  try {
    return Response.json({ ok: true, ...(await runJobs(env)) }, { headers });
  } catch (error) {
    console.error("tick failed", error instanceof Error ? error.message : "");
    return Response.json({ error: "server_error" }, { status: 500, headers });
  }
}
