import { insert, rows, waitFor } from "./data";
import { expect, test } from "./fixtures";

// The scheduler through the app (Ç3d; docs/02-mimari.md "Zamanlanmış işler"): the tick is asked
// the way pg_cron asks it, with its secret and no session, while no screen of the account is
// open; the jobs run and leave their record. The rules themselves are in tests/db/jobs.test.ts.

const SECRET = "e2e-cron-secret"; // playwright.config.ts, E2E_CRON_SECRET

const tick = (base: string, authorization?: string, method = "POST") =>
  fetch(`${base}/api/jobs/tick`, {
    method,
    redirect: "manual",
    headers: authorization ? { Authorization: authorization } : {},
  });

test("the tick runs the jobs with the app closed, and only with its secret", async ({
  baseURL,
}) => {
  const base = baseURL!;
  await insert("modules", { slug: "deneme", name: "Deneme", color: "#6250d6" });

  for (const authorization of [undefined, "Bearer wrong", SECRET, `Bearer ${SECRET}x`]) {
    const refused = await tick(base, authorization);
    expect(refused.status, String(authorization)).toBe(401);
    expect(await refused.json()).toEqual({ error: "unauthorized" });
  }
  expect(await rows("job_runs")).toEqual([]);

  // pg_cron's POST: no page of the account is open in this test.
  const done = await tick(base, `Bearer ${SECRET}`);
  expect(done.status).toBe(200);
  const summary = (await done.json()) as Record<string, number | boolean>;
  expect(Object.keys(summary).sort()).toEqual(["accounts", "failed", "ok", "ran"]);
  const runs = await waitFor(
    () => rows("job_runs"),
    (list) => list.length >= 3,
  );
  const jobs = runs.map((run) => run.job);
  expect(jobs).toEqual(expect.arrayContaining(["core/week", "core/blocks", "core/sessions"]));
  expect(runs.every((run) => run.status === "done")).toBe(true);
  // The test module's morning digest, once its hour (05:00) has come.
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  if (hour >= 5) {
    expect(jobs).toContain("deneme/ozet");
    const [mod] = await rows("modules");
    expect(mod.settings).toMatchObject({ daily_digest: { open: 0 } });
  }

  // The host's daily GET, a moment later: nothing runs twice in its period.
  const again = await tick(base, `Bearer ${SECRET}`, "GET");
  expect(again.status).toBe(200);
  expect((await rows("job_runs")).length).toBe(runs.length);
});
