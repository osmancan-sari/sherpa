import { expect, type Page } from "@playwright/test";
import { holdRunClock, roomMoment, runNow } from "./clock";

/** The local Supabase stack catches every outgoing e-mail in Mailpit instead of sending it. */
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export const ALLOWED_EMAIL = requireEnv("ALLOWED_EMAIL");
export const STORAGE_STATE = "playwright/.auth/user.json";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; fill .env.local (see .env.example).`);
  return value;
}

type MailSummary = { ID: string; To: { Address: string }[] };

async function listMail(): Promise<MailSummary[]> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/messages`);
  if (!response.ok) throw new Error(`Mailpit answered ${response.status}`);
  const body = (await response.json()) as { messages: MailSummary[] };
  return body.messages;
}

export async function clearMail(): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
}

export async function countMail(): Promise<number> {
  return (await listMail()).length;
}

/** Waits for the newest e-mail to the address and returns the one-time code in it. */
export async function readLoginCode(email: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const message = (await listMail()).find((mail) =>
      mail.To.some((to) => to.Address.toLowerCase() === email.toLowerCase()),
    );
    if (message) {
      const response = await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`);
      const { Text } = (await response.json()) as { Text: string };
      const code = Text.match(/\b\d{8}\b/)?.[0];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No login code arrived for ${email} within ${timeoutMs} ms`);
}

/**
 * Asks for a login code through the form and returns the code that arrives.
 * `typedEmail` is what goes into the box; it may differ from the address in case or spacing.
 */
export async function requestCode(page: Page, typedEmail = ALLOWED_EMAIL): Promise<string> {
  // Supabase sends one e-mail per address per second locally (auth.email.max_frequency);
  // a request that comes sooner is refused, so leave that gap after the previous test.
  await page.waitForTimeout(1200);
  await clearMail();
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill(typedEmail);
  await page.getByRole("button", { name: "Kod gönder" }).click();
  await expect(page.getByLabel("Giriş kodu")).toBeVisible();
  return readLoginCode(typedEmail.trim());
}

/** Signs in through the real login form: e-mail, then the code from the mailbox. */
export async function signIn(page: Page, email = ALLOWED_EMAIL): Promise<void> {
  const code = await requestCode(page, email);
  await page.getByLabel("Giriş kodu").fill(code);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("heading", { name: "Bugün", exact: true })).toBeVisible();
}

/**
 * Room in the day for tests that need it. The test account's day ends at 22:00
 * (tests/e2e/data.ts; Ç4a); late in the evening a 30- or 60-minute task no longer fits and the
 * screen rightly offers nothing. Unless the run's moment (tests/e2e/clock.ts) is already the
 * default one, the test holds today's 10:00 (or the real time when it is earlier): its pages and
 * the data it writes from then on (`runNow`, `runAt`, `runDay`). Never ahead of the database's
 * clock, and on its day (the database stamps sessions and finished work itself).
 * Returns the pages' "now".
 */
export async function roomInTheDay(...pages: Page[]): Promise<Date> {
  const now = runNow();
  const room = roomMoment();
  // The run's moment already has room, on the database's day: nothing to hold.
  if (now.getTime() === room.getTime()) return now;
  holdRunClock(room);
  for (const page of pages) await page.clock.setFixedTime(room);
  return room;
}

/**
 * Opens quick add with its key, "N". The key works once the page has come alive (its listeners
 * attach a moment after the load event); pressing it right after `goto` can fall before that,
 * so it is pressed again until the sheet is there (never while it is open: the key would then be
 * typed into its line).
 */
export async function openQuickAdd(page: Page) {
  const sheet = page.getByRole("dialog", { name: "Yeni giriş" });
  await expect(async () => {
    if ((await sheet.count()) === 0) await page.keyboard.press("n");
    await expect(sheet).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
  // Tab walks through the modules only once their list has loaded.
  await expect(sheet.locator("form[data-modules=ready]")).toHaveCount(1);
}
