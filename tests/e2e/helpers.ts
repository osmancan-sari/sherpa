import { expect, type Page } from "@playwright/test";

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
 * Room in the day for tests that need it. The test account's day ends at 23:59
 * (tests/e2e/data.ts); late in the evening a 30- or 60-minute task no longer fits and the screen
 * rightly offers nothing. Once the real time is past 10:00 the page's clock is held at 10:00
 * TODAY: the calendar day stays the one the data is written for (today(), due in an hour), and
 * the clock is never ahead of the server, so a session the server stamps never looks overdue.
 * Before 10:00 the real time already leaves the whole day. Returns the pages' "now". (Ç3d step
 * 3 audit: seven tests failed after 22:30.)
 */
export async function roomInTheDay(...pages: Page[]): Promise<Date> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
    new Date(),
  );
  const morning = new Date(`${today}T10:00:00+03:00`);
  if (Date.now() <= morning.getTime()) return new Date();
  for (const page of pages) await page.clock.setFixedTime(morning);
  // The pages' "now": data meant to be "five minutes ago" on the screen is written from it.
  return morning;
}
