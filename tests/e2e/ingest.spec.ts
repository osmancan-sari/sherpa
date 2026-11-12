import { createHash, randomBytes } from "node:crypto";
import { type APIRequestContext, request as playwrightRequest } from "@playwright/test";
import { insert, rows, update, waitFor } from "./data";
import { expect, test } from "./fixtures";

// The ingest endpoint through the app (Ç3d; docs/02-mimari.md "Cihaz anahtarları ve giriş
// ucu"): asked the way the phone's automation asks it, with no session at all, and the open
// screens following what it wrote. Every refusal is tried in depth in tests/db/ingest.test.ts;
// here each answer is seen once through Next and its proxy.

const BASE = "http://127.0.0.1:3100";

/** A token in the test account, as Settings would make it: only its digest is stored. */
async function makeToken(scopes: string[]): Promise<{ id: string; token: string }> {
  const token = `shp_${randomBytes(32).toString("base64url")}`;
  const [row] = await insert<{ id: string }>("device_tokens", {
    name: "Kestirmeler",
    token_hash: createHash("sha256").update(token).digest("hex"),
    hint: token.slice(0, 8),
    scopes,
  });
  return { id: row.id, token };
}

let api: APIRequestContext;
test.beforeEach(async () => {
  // No cookies, no stored session: the phone's automation.
  api = await playwrightRequest.newContext({ baseURL: BASE });
});
test.afterEach(async () => api.dispose());

const post = (path: string, token: string | null, body?: unknown, key?: string) =>
  api.post(`/api/ingest/${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    data: body ?? {},
    maxRedirects: 0,
  });

test("the endpoint answers by its rules, with no session, and never returns data", async () => {
  const { id, token } = await makeToken(["core/wake"]);

  const none = await post("core/wake", null);
  expect(none.status()).toBe(401);
  expect(await none.json()).toEqual({ error: "unauthorized" });
  expect((await post("core/wake", `${token.slice(0, -1)}A`)).status()).toBe(401);
  // Reading is not a thing it does.
  expect((await api.get("/api/ingest/core/wake", { maxRedirects: 0 })).status()).toBe(405);

  const outside = await post("core/bed", token);
  expect(outside.status()).toBe(403);
  expect(await outside.json()).toEqual({ error: "forbidden" });
  expect((await post("core/yok", token)).status()).toBe(404);

  const broken = await post("core/wake", token, { at: "sabah", fazla: 1 });
  expect(broken.status()).toBe(400);
  const issues = ((await broken.json()) as { issues: { path: string }[] }).issues;
  expect(issues.map((issue) => issue.path).sort()).toEqual(["(body)", "at"]);

  const done = await post("core/wake", token, {}, "alarm-1");
  expect(done.status()).toBe(200);
  expect(await done.json()).toEqual({ ok: true });
  expect(done.headers()["cache-control"]).toContain("no-store");
  const again = await post("core/wake", token, {}, "alarm-1");
  expect(await again.json()).toEqual({ ok: true, duplicate: true });
  expect(again.headers()["idempotent-replayed"]).toBe("true");
  const days = await rows("days");
  expect(days.filter((day) => day.woke_at !== null)).toHaveLength(1);
  expect(days[0].woke_estimated).toBe(false);

  // Revoked: refused from the next request on.
  await update("device_tokens", id, { revoked_at: new Date().toISOString() });
  expect((await post("core/wake", token)).status()).toBe(401);
  const log = await rows("ingest_requests");
  expect(JSON.stringify(log)).not.toContain(token.slice(4));
});

test("open screens follow what came in: the waking on Today, a record on its module's page, the last use in Settings", async ({
  page,
  browser,
}) => {
  // The day's frame on, so the top bar shows the waking.
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
  });
  await insert("modules", { slug: "deneme", name: "Deneme", color: "#6250d6" });
  const { token } = await makeToken(["core/wake", "deneme/kayit"]);

  await page.goto("/");
  const wake = page.getByTestId("wake-line");
  await expect(wake).toHaveText(/^beklenen uyanış/);
  const moduleTab = await browser.newPage({ storageState: "playwright/.auth/user.json" });
  await moduleTab.goto("/m/deneme");
  await expect(moduleTab.getByText("Dışarıdan gelen kayıt")).toHaveCount(0);
  const settingsTab = await browser.newPage({ storageState: "playwright/.auth/user.json" });
  await settingsTab.goto("/ayarlar");
  await expect(settingsTab.getByTestId("device-token")).toContainText("Henüz kullanılmadı");

  // The phone's alarm automation: Today shows the waking, without a reload.
  expect((await post("core/wake", token)).status()).toBe(200);
  await expect(wake).toHaveText(/^uyanış \d\d:\d\d$/);

  // A collector's record: the module's page lists it, and its work is proposed.
  expect((await post("deneme/kayit", token, { title: "Dışarıdan gelen kayıt" })).status()).toBe(
    200,
  );
  await expect(moduleTab.getByText("Dışarıdan gelen kayıt").first()).toBeVisible();
  await waitFor(
    () => rows("work_items"),
    (list) => list.some((item) => item.title === "Dışarıdan gelen kayıt"),
  );
  // Settings shows the token's last use.
  await expect(settingsTab.getByTestId("device-token")).toContainText("Son kullanım:");
  await moduleTab.close();
  await settingsTab.close();
});
