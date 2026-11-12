import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiConfig } from "@/core/ai/types";
import type { ModuleDefinition, ModuleRegistry } from "@/core/contract/types";
import { jobs as denemeJobs } from "@/modules/deneme/jobs";
import { adminDb, makeModule, ok, ownerDb, ownerId, strangerDb, strangerId, wipe } from "./helpers";

// Scheduled jobs (Ç3d; docs/02-mimari.md "Zamanlanmış işler"): the tick runs what is due, for
// each account in its own name, once per period; a failing job is tried again at most three
// times; two ticks at once run a job once; the endpoint needs its secret.

vi.mock("server-only", () => ({}));
const { handleTick, runJobs, tickAuthorized } = await import("@/core/server/jobs");

const owner = ownerDb();
const stranger = strangerDb();
const NO_AI: AiConfig = {
  provider: null,
  models: { fast: null, plan: null },
  timeouts: { fast: 2_000, plan: 2_000 },
};

let counted: { user: string; slot: string }[] = [];
const sinama: ModuleDefinition = {
  slug: "sinama",
  name: "Sınama",
  kind: "lifelong",
  color: "#2563eb",
  chip: async () => ({ text: "", health: "ok" }),
  intake: [],
  emits: [],
  modeBehavior: {
    normal: { weightMultiplier: 1, floorMultiplier: 1 },
    busy: { weightMultiplier: 1, floorMultiplier: 1 },
    minimum: { weightMultiplier: 1, floorMultiplier: 1 },
    holiday: { weightMultiplier: 1, floorMultiplier: 1 },
  },
  weeklyReport: async () => ({ metrics: [], suggestions: [] }),
  jobs: [
    {
      key: "say",
      every: "day",
      at: "05:00",
      async run(ctx) {
        counted.push({ user: ctx.module.user_id, slot: ctx.now().toISOString() });
        await ctx.saveSettings({ last: ctx.now().toISOString() });
      },
    },
    {
      key: "bozuk",
      every: "day",
      async run() {
        throw new Error("the source was down");
      },
    },
  ],
  ui: { tabs: [{ key: "genel", label: "Genel", component: () => null }] },
};
// The test module of the app with its real job, under its own slug.
const deneme = { ...sinama, slug: "deneme", name: "Deneme", jobs: denemeJobs };
const registry: ModuleRegistry = {
  list: [sinama, deneme],
  get: (slug) => [sinama, deneme].find((def) => def.slug === slug),
};

const MORNING = new Date("2026-11-12T06:00:00+03:00");
const tick = (now = MORNING, users = [ownerId()]) =>
  runJobs({ registry, now: () => now, ai: NO_AI, users });
const runsOf = async (user = ownerId()) =>
  ok(await adminDb().from("job_runs").select("*").eq("user_id", user).order("job"));

beforeEach(async () => {
  await wipe();
  counted = [];
});
afterAll(wipe);

describe("the tick", () => {
  it("runs the core's jobs and the modules' that are due, and writes each run", async () => {
    await makeModule(owner);
    const summary = await tick();
    expect(summary).toEqual({ accounts: 1, ran: 4, failed: 1 });
    const runs = await runsOf();
    expect(runs.map((run) => [run.job, run.slot, run.status, run.attempts])).toEqual([
      ["core/blocks", "2026-11-12", "done", 1],
      ["core/sessions", "2026-11-12T06", "done", 1],
      ["core/week", "2026-11-12", "done", 1],
      ["sinama/bozuk", "2026-11-12", "failed", 1],
      ["sinama/say", "2026-11-12", "done", 1],
    ]);
    expect(runs.find((run) => run.job === "sinama/bozuk")?.error).toBe("the source was down");
    expect(counted).toEqual([{ user: ownerId(), slot: MORNING.toISOString() }]);
    // The week was committed without any screen open.
    expect(ok(await owner.from("week_plans").select("week_start"))).toEqual([
      { week_start: "2026-11-09" },
    ]);
  });

  it("runs a job once per period, and a failing one at most three times", async () => {
    await makeModule(owner);
    await tick();
    expect(await tick()).toEqual({ accounts: 1, ran: 0, failed: 1 });
    expect(await tick()).toEqual({ accounts: 1, ran: 0, failed: 1 });
    expect(await tick()).toEqual({ accounts: 1, ran: 0, failed: 0 });
    expect(counted).toHaveLength(1);
    const bozuk = (await runsOf()).find((run) => run.job === "sinama/bozuk");
    expect(bozuk).toMatchObject({ status: "failed", attempts: 3 });
    // The next hour runs the hourly job again; the next day the daily ones.
    await tick(new Date("2026-11-12T07:05:00+03:00"));
    expect((await runsOf()).filter((run) => run.job === "core/sessions")).toHaveLength(2);
    await tick(new Date("2026-11-13T06:00:00+03:00"));
    expect(counted).toHaveLength(2);
  });

  it("waits for a job's hour, and runs a missed one once at the next tick", async () => {
    await makeModule(owner);
    await tick(new Date("2026-11-12T04:00:00+03:00"));
    expect(counted).toEqual([]);
    expect((await runsOf()).map((run) => run.job)).not.toContain("sinama/say");
    await tick(new Date("2026-11-12T15:40:00+03:00"));
    expect(counted).toHaveLength(1);
  });

  it("runs a job once when two ticks come at the same time", async () => {
    await makeModule(owner);
    const [first, second] = await Promise.all([tick(), tick()]);
    expect(first.ran + second.ran).toBe(4);
    expect(counted).toHaveLength(1);
    expect((await runsOf()).filter((run) => run.job === "sinama/say")).toHaveLength(1);
  });

  it("runs each account's jobs in that account's name, and a module's only where it is on", async () => {
    await makeModule(stranger);
    await tick(MORNING, [ownerId(), strangerId()]);
    expect(counted).toEqual([{ user: strangerId(), slot: MORNING.toISOString() }]);
    expect((await runsOf()).map((run) => run.job)).toEqual([
      "core/blocks",
      "core/sessions",
      "core/week",
    ]);
    const [theirs] = ok(await stranger.from("modules").select("settings"));
    expect(theirs.settings).toEqual({ last: MORNING.toISOString() });
    expect(ok(await owner.from("modules").select("id"))).toEqual([]);
  });

  it("does the core's nightly work: the series' blocks, an unanswered session closed", async () => {
    const mod = await makeModule(owner);
    ok(
      await owner
        .from("block_series")
        .insert({
          module_id: mod.id,
          title: "Ders",
          weekday: 1,
          start_time: "09:00",
          end_time: "11:00",
          valid_from: "2026-11-01",
        })
        .select(),
    );
    const [task] = ok(
      await owner
        .from("tasks")
        .insert({ module_id: mod.id, title: "Unutulan iş", est_minutes: 30 })
        .select(),
    );
    // Started three hours ago and never answered for: twice the estimate and more.
    const started = new Date(Date.now() - 3 * 3_600_000).toISOString();
    ok(
      await owner
        .from("sessions")
        .insert({ task_id: task.id, module_id: mod.id, started_at: started })
        .select(),
    );
    await runJobs({ registry, ai: NO_AI, users: [ownerId()] });
    const blocks = ok(await owner.from("blocks").select("occurrence_on"));
    expect(blocks.length).toBeGreaterThanOrEqual(7);
    const [session] = ok(await owner.from("sessions").select("ended_at, measured"));
    expect(session.ended_at).not.toBeNull();
    expect(session.measured).toBe(false);
  });

  it("the test module's digest is idempotent: a second run of the day writes the same", async () => {
    await makeModule(owner, "deneme", "Deneme");
    await tick();
    const [first] = ok(await owner.from("modules").select("settings"));
    expect(first.settings).toMatchObject({ daily_digest: { date: "2026-11-12", open: 0 } });
    // Tried again by hand (a retry): the same row, the same digest.
    ok(
      await adminDb()
        .from("job_runs")
        .delete()
        .eq("user_id", ownerId())
        .eq("job", "deneme/ozet")
        .select(),
    );
    await tick();
    const [second] = ok(await owner.from("modules").select("settings"));
    expect(second.settings).toEqual(first.settings);
  });
});

describe("the tick endpoint", () => {
  it("answers only to its secret, and with counts only", async () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "the-cron-secret";
    try {
      expect(tickAuthorized(null)).toBe(false);
      expect(tickAuthorized("Bearer wrong")).toBe(false);
      expect(tickAuthorized("Bearer the-cron-secretx")).toBe(false);
      expect(tickAuthorized("the-cron-secret")).toBe(false);
      expect(tickAuthorized("Bearer the-cron-secret")).toBe(true);
      expect(tickAuthorized("Bearer the-cron-secret", "")).toBe(false);

      const ask = (authorization?: string) =>
        handleTick(
          new Request("http://sherpa.test/api/jobs/tick", {
            method: "POST",
            headers: authorization ? { Authorization: authorization } : {},
          }),
          { registry, now: () => MORNING, ai: NO_AI, users: [ownerId()] },
        );
      const refused = await ask();
      expect(refused.status).toBe(401);
      expect(await refused.json()).toEqual({ error: "unauthorized" });
      expect(await runsOf()).toEqual([]);
      const done = await ask("Bearer the-cron-secret");
      expect(done.status).toBe(200);
      expect(await done.json()).toEqual({ ok: true, accounts: 1, ran: 3, failed: 0 });
    } finally {
      process.env.CRON_SECRET = previous;
    }
  });

  it("is refused for everyone while no secret is set", async () => {
    const previous = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      expect(tickAuthorized("Bearer ")).toBe(false);
      expect(tickAuthorized("Bearer undefined")).toBe(false);
    } finally {
      process.env.CRON_SECRET = previous;
    }
  });
});

describe("the job runs", () => {
  it("are the user's own; which job and period a run is cannot be changed", async () => {
    await tick();
    expect(ok(await stranger.from("job_runs").select("id"))).toEqual([]);
    const [run] = await runsOf();
    for (const change of [{ job: "core/x" }, { slot: "2000-01-01" }]) {
      const { error } = await owner.from("job_runs").update(change).eq("id", run.id);
      expect(error?.code, JSON.stringify(change)).toBe("42501");
    }
  });
});
