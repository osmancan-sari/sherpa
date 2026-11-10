import { expect, test } from "@playwright/test";
import { ALLOWED_EMAIL, clearMail, countMail, requestCode, signIn } from "./helpers";

// Acceptance: the allowed e-mail signs in with a code typed into the app; any other is rejected.

test("another e-mail address is rejected and gets no code", async ({ page }) => {
  await clearMail();
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("baskasi@ornek.test");
  await page.getByRole("button", { name: "Kod gönder" }).click();

  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Bu e-posta ile giriş yapılamıyor.",
  );
  await expect(page.getByLabel("Giriş kodu")).toHaveCount(0);
  await expect(page).toHaveURL(/\/giris$/);

  // Give a wrongly sent mail time to arrive before concluding that none was sent.
  await page.waitForTimeout(1500);
  expect(await countMail()).toBe(0);
});

test("a wrong code does not sign in", async ({ page }) => {
  const realCode = await requestCode(page);
  // Same length as the real one, one digit off.
  const wrongCode = (realCode[0] === "0" ? "1" : "0") + realCode.slice(1);
  expect(realCode).toMatch(/^\d{8}$/);
  await page.getByLabel("Giriş kodu").fill(wrongCode);
  await page.getByRole("button", { name: "Giriş yap" }).click();

  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Kod geçersiz ya da süresi dolmuş.",
  );
  await expect(page).toHaveURL(/\/giris$/);
  expect((await page.request.get("/api/me", { maxRedirects: 0 })).status()).toBe(401);
});

test("the allowed e-mail signs in with the code, stays signed in, and can sign out", async ({
  page,
  context,
}) => {
  // The address is matched whatever its case.
  const code = await requestCode(page, ` ${ALLOWED_EMAIL.toUpperCase()} `);
  await page.getByLabel("Giriş kodu").fill(code);
  await page.getByRole("button", { name: "Giriş yap" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Bugün" })).toBeVisible();

  // The API now answers, and only with this user's own address.
  const me = await page.request.get("/api/me");
  expect(me.status()).toBe(200);
  expect(await me.json()).toEqual({ email: ALLOWED_EMAIL });

  // Long-lived session: the cookie outlives the browser by many months.
  const sessionCookies = (await context.cookies()).filter((cookie) =>
    /^sb-.*-auth-token/.test(cookie.name),
  );
  expect(sessionCookies.length).toBeGreaterThan(0);
  const days = (sessionCookies[0].expires - Date.now() / 1000) / 86_400;
  expect(days).toBeGreaterThan(300);

  // A reload and a second window are still signed in; the login page sends you back in.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bugün" })).toBeVisible();
  const second = await context.newPage();
  await second.goto("/giris");
  await expect(second).toHaveURL(/\/$/);
  await second.close();

  // Sign out from settings.
  await page.goto("/ayarlar");
  await expect(page.locator("section", { hasText: "Hesap" }).getByRole("paragraph")).toHaveText(
    ALLOWED_EMAIL,
  );
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/giris$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/giris$/);
  expect((await page.request.get("/api/me", { maxRedirects: 0 })).status()).toBe(401);
});

test("signing in again after signing out works (helper used by the other suites)", async ({
  page,
}) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/$/);
});
