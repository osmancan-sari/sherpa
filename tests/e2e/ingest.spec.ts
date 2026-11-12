import { deviceToken, postIngest, rows, update } from "./data";
import { expect, test } from "./fixtures";

// The ingest endpoint through the app (Ç3d; docs/02-mimari.md "Cihaz anahtarları ve giriş
// ucu"): asked the way the phone's automation asks it, with no session at all. Every refusal is
// tried in depth in tests/db/ingest.test.ts; here each answer is seen once through Next and its
// proxy. That open screens follow what it writes is in sync.spec.ts (live sync runs first).

test("the endpoint answers by its rules, with no session, and never returns data", async ({
  baseURL,
}) => {
  const base = baseURL!;
  const { id, token } = await deviceToken(["core/wake"]);
  // A token one character off, whatever its last character is.
  const wrong = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;

  const none = await postIngest(base, "core/wake", null);
  expect(none.status).toBe(401);
  expect(await none.json()).toEqual({ error: "unauthorized" });
  expect((await postIngest(base, "core/wake", wrong)).status).toBe(401);
  // Reading is not a thing it does.
  expect((await fetch(`${base}/api/ingest/core/wake`, { redirect: "manual" })).status).toBe(405);

  const outside = await postIngest(base, "core/bed", token);
  expect(outside.status).toBe(403);
  expect(await outside.json()).toEqual({ error: "forbidden" });
  expect((await postIngest(base, "core/yok", token)).status).toBe(404);

  const broken = await postIngest(base, "core/wake", token, { at: "sabah", fazla: 1 });
  expect(broken.status).toBe(400);
  const issues = ((await broken.json()) as { issues: { path: string }[] }).issues;
  expect(issues.map((issue) => issue.path).sort()).toEqual(["(body)", "at"]);

  const done = await postIngest(base, "core/wake", token, {}, "alarm-1");
  expect(done.status).toBe(200);
  expect(await done.json()).toEqual({ ok: true });
  expect(done.headers.get("cache-control")).toContain("no-store");
  const again = await postIngest(base, "core/wake", token, {}, "alarm-1");
  expect(await again.json()).toEqual({ ok: true, duplicate: true });
  expect(again.headers.get("idempotent-replayed")).toBe("true");
  const days = await rows("days");
  expect(days.filter((day) => day.woke_at !== null)).toHaveLength(1);
  expect(days[0].woke_estimated).toBe(false);

  // Revoked: refused from the next request on.
  await update("device_tokens", id, { revoked_at: new Date().toISOString() });
  expect((await postIngest(base, "core/wake", token)).status).toBe(401);
  const log = await rows("ingest_requests");
  expect(JSON.stringify(log)).not.toContain(token.slice(4));
});
