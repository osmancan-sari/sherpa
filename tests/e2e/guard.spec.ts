import { expect, test } from "@playwright/test";
import { SESSION_COOKIE } from "./supabase";

// Acceptance: without signing in, no page and no API route returns data.

const pages = [
  "/",
  "/hafta",
  "/m",
  "/gelen",
  "/kapanis",
  "/ayarlar",
  "/ayarlar/moduller",
  "/ayarlar/moduller/deneme",
  "/ayarlar/bloklar",
  "/m/okul",
  "/m/deneme/bilesenler",
  "/m/deneme/tam/odak",
  "/boyle-bir-sayfa-yok",
];

for (const path of pages) {
  test(`page ${path} redirects to the login page`, async ({ request, page }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers()["location"], "http://x").pathname).toBe("/giris");
    expect(await response.text()).not.toContain("Bugün");

    await page.goto(path);
    await expect(page).toHaveURL(/\/giris$/);
    await expect(page.getByLabel("E-posta")).toBeVisible();
  });
}

test("the server-component payload of a page is guarded too", async ({ request }) => {
  const response = await request.get("/hafta", {
    maxRedirects: 0,
    headers: { RSC: "1", "Next-Router-Prefetch": "1" },
  });
  expect(response.status()).toBe(307);
  expect(await response.text()).not.toContain("Hafta");
});

for (const path of [
  "/api/me",
  "/api/export",
  "/api/boyle-bir-rota-yok",
  "/api/ai/enrich",
  "/api/ai/plan",
  "/api/ai/week",
  "/api/ai/month",
  "/api/ai/review",
  "/api/mcp",
]) {
  test(`API ${path} answers 401 without data`, async ({ request }) => {
    for (const method of ["get", "post"] as const) {
      const response = await request[method](path, { maxRedirects: 0 });
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthorized" });
    }
  });
}

test("a made-up session cookie does not get in", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const fakeSession = JSON.stringify({
    access_token: "not-a-real-token",
    refresh_token: "nope",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: "00000000-0000-0000-0000-000000000000", email: process.env.ALLOWED_EMAIL },
  });
  await context.addCookies([{ name: SESSION_COOKIE, value: fakeSession, url: baseURL! }]);

  const api = await context.request.get("/api/me", { maxRedirects: 0 });
  expect(api.status()).toBe(401);

  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/giris$/);
  await context.close();
});

test("only what the phone needs to install the app is public", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const body = await manifest.json();
  expect(body).toMatchObject({ name: "Sherpa", display: "standalone", start_url: "/" });

  for (const icon of body.icons as { src: string }[]) {
    const response = await request.get(icon.src);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
  expect((await request.get("/apple-icon.png")).status()).toBe(200);
});

test("paths that merely look like the public files are still gated", async ({ request }) => {
  const lookalikes = [
    "/icon.pngx",
    "/icon.png/hafta",
    "/apple-icon.png.txt",
    "/favicon.icox",
    "/robots.txt/x",
    "/manifest.webmanifest/x",
    "/icons/a/b.png",
    "/icons/hafta",
    "/_next/staticx",
    "/favicon.ico",
    // The image optimizer could otherwise be asked to fetch app pages on a stranger's behalf.
    "/_next/image?url=%2Ficons%2Ficon-192.png&w=64&q=75",
    "/_next/image?url=%2Fhafta&w=64&q=75",
    "/_next/imagex",
  ];
  for (const path of lookalikes) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(new URL(response.headers()["location"], "http://x").pathname, path).toBe("/giris");
  }
});

test("the app asks not to be indexed", async ({ request, page }) => {
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toMatch(/Disallow: \/\s*$/m);

  const login = await request.get("/giris");
  expect(login.headers()["x-robots-tag"]).toContain("noindex");

  await page.goto("/giris");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
