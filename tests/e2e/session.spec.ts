import { expect, test, type BrowserContext } from "@playwright/test";
import { ALLOWED_EMAIL } from "./helpers";
import {
  adminClient,
  isLiveAccessToken,
  PUBLISHABLE_KEY,
  readSession,
  removeUser,
  SESSION_COOKIE,
  sessionCookiesFor,
  SUPABASE_URL,
  writeSession,
  type Cookie,
} from "./supabase";

// What the login form cannot show: the gate holds against a genuine Supabase session of the
// wrong account, the long-lived session renews itself, and Supabase itself takes no new accounts.

const STRANGER = "baskasi@ornek.test";

async function hold(context: BrowserContext, cookies: Cookie[], baseURL: string) {
  await context.clearCookies();
  await context.addCookies(cookies.map((cookie) => ({ ...cookie, url: baseURL })));
}

test("a genuine session of another account is turned away", async ({ context, page, baseURL }) => {
  const admin = adminClient();
  // An interrupted earlier run may have left the stranger behind.
  await removeUser(STRANGER);
  const created = await admin.auth.admin.createUser({ email: STRANGER, email_confirm: true });
  expect(created.error).toBeNull();

  try {
    // Control: the same way of signing in does get the allowed account in,
    // so what follows is refused because of who it is, not because the cookies are malformed.
    await hold(context, await sessionCookiesFor(ALLOWED_EMAIL), baseURL!);
    const allowed = await context.request.get("/api/me", { maxRedirects: 0 });
    expect(allowed.status()).toBe(200);
    expect(await allowed.json()).toEqual({ email: ALLOWED_EMAIL });

    const cookies = await sessionCookiesFor(STRANGER);
    const session = await readSession(cookies);
    expect(session.user.email).toBe(STRANGER);
    expect(await isLiveAccessToken(session.access_token)).toBe(true);
    await hold(context, cookies, baseURL!);

    for (const method of ["get", "post"] as const) {
      const api = await context.request[method]("/api/me", { maxRedirects: 0 });
      expect(api.status()).toBe(401);
      expect(await api.json()).toEqual({ error: "unauthorized" });
    }

    for (const path of ["/", "/hafta", "/m", "/gelen", "/ayarlar"]) {
      const response = await context.request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      expect(new URL(response.headers()["location"], "http://x").pathname).toBe("/giris");
    }

    await page.goto("/ayarlar");
    await expect(page).toHaveURL(/\/giris$/);
    await expect(page.getByLabel("E-posta")).toBeVisible();
    await expect(page.getByText(STRANGER)).toHaveCount(0);
  } finally {
    await admin.auth.admin.deleteUser(created.data.user!.id);
  }
});

test("an expired session renews itself and stays long-lived", async ({ context, baseURL }) => {
  const original = await readSession(await sessionCookiesFor(ALLOWED_EMAIL));

  // The access token's hour is over, as it is on a second screen left open overnight.
  const expired = { ...original, expires_at: Math.floor(Date.now() / 1000) - 60, expires_in: 0 };
  await hold(context, writeSession(expired), baseURL!);

  const response = await context.request.get("/api/me", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ email: ALLOWED_EMAIL });

  // The answer carried a fresh session: new tokens, a new hour, a cookie that lasts for months.
  const held = (await context.cookies()).filter((cookie) => cookie.name.startsWith(SESSION_COOKIE));
  const renewed = await readSession(held);
  expect(renewed.refresh_token).not.toBe(original.refresh_token);
  expect(renewed.access_token).not.toBe(original.access_token);
  expect(renewed.expires_at!).toBeGreaterThan(Date.now() / 1000 + 3000);
  expect((held[0].expires - Date.now() / 1000) / 86_400).toBeGreaterThan(300);

  // And the renewed session keeps working on the next request.
  expect((await context.request.get("/api/me", { maxRedirects: 0 })).status()).toBe(200);
});

test("an expired session that cannot be renewed is signed out", async ({
  context,
  page,
  baseURL,
}) => {
  const original = await readSession(await sessionCookiesFor(ALLOWED_EMAIL));
  const dead = {
    ...original,
    refresh_token: "not-a-real-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) - 60,
    expires_in: 0,
  };
  await hold(context, writeSession(dead), baseURL!);

  const response = await context.request.get("/api/me", { maxRedirects: 0 });
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: "unauthorized" });

  // The useless cookie is cleared rather than kept around.
  const held = (await context.cookies()).filter((cookie) => cookie.name.startsWith(SESSION_COOKIE));
  expect(held.filter((cookie) => cookie.value !== "")).toHaveLength(0);

  // A page goes quietly to the login screen.
  await page.goto("/");
  await expect(page).toHaveURL(/\/giris$/);
});

test.describe("Supabase itself takes no new accounts", () => {
  const newcomer = "yeni-kayit@ornek.test";
  const headers = { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" };

  async function post(path: string, body: unknown) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as { error_code?: string } };
  }

  test("a login code request cannot create an account", async () => {
    const { status, body } = await post("otp", { email: newcomer, create_user: true });
    expect(status).toBe(422);
    expect(body.error_code).toBe("signup_disabled");
  });

  test("signing up with a password is refused", async () => {
    const { status, body } = await post("signup", {
      email: newcomer,
      password: "Uzun-bir-parola-1",
    });
    expect(status).toBe(422);
    expect(body.error_code).toBe("signup_disabled");
  });

  test("anonymous sign-in is refused", async () => {
    const { status, body } = await post("signup", {});
    expect(status).toBe(422);
    expect(body.error_code).toBe("anonymous_provider_disabled");
  });

  test("the project reports signups as closed and holds only the one account", async () => {
    const settings = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers });
    expect(((await settings.json()) as { disable_signup: boolean }).disable_signup).toBe(true);

    const { data, error } = await adminClient().auth.admin.listUsers();
    expect(error).toBeNull();
    expect(data.users.map((user) => user.email)).toEqual([ALLOWED_EMAIL]);
  });
});
