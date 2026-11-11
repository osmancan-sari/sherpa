import type { Browser, BrowserContext, Page } from "@playwright/test";
import { insert, rows, seedModule, waitFor } from "./data";
import { expect, test } from "./fixtures";
import { STORAGE_STATE } from "./helpers";

// Two devices, one account: what happens on the phone shows on the second screen without a
// reload (docs/11-yayin-ve-cihazlar.md, "Eşitleme"). Both pages stay open the whole time;
// nothing here reloads or navigates after the first load.

async function phone(
  browser: Browser,
  baseURL: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL,
    storageState: STORAGE_STATE,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
  });
  return { context, page: await context.newPage() };
}

/** Fails the test if the page loads a document again after this point. */
function forbidReloads(page: Page): () => number {
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations += 1;
  });
  return () => navigations;
}

test("a task added on the phone appears on the desktop Today screen without a reload", async ({
  page: desktop,
  browser,
  baseURL,
}) => {
  await seedModule();
  await desktop.goto("/");
  await expect(desktop.getByRole("region", { name: "Şimdi" })).toContainText(
    "Bugün için planlanan bir şey yok.",
  );
  const desktopNavigations = forbidReloads(desktop);

  const mobile = await phone(browser, baseURL!);
  await mobile.page.goto("/");
  await mobile.page.getByRole("button", { name: "Yeni giriş" }).tap();
  const dialog = mobile.page.getByRole("dialog", { name: "Yeni giriş" });
  await dialog.getByLabel("Giriş").fill("Telefondan eklenen iş");
  await dialog.getByRole("button", { name: "Okul" }).tap();
  await dialog.getByRole("button", { name: "Ekle", exact: true }).tap();
  await expect(dialog).toBeHidden();

  // Within three seconds, on a page nobody touched.
  await expect(
    desktop
      .getByRole("region", { name: "Şimdi" })
      .getByRole("heading", { name: "Telefondan eklenen iş" }),
  ).toBeVisible({ timeout: 3000 });
  expect(desktopNavigations()).toBe(0);

  await mobile.context.close();
});

test("a session started on the phone runs on the desktop, and Bitti there ends it on the phone", async ({
  page: desktop,
  browser,
  baseURL,
}) => {
  const mod = await seedModule();
  await insert("tasks", {
    module_id: mod.id,
    title: "HW2: lokalizasyon soruları",
    est_minutes: 45,
  });

  await desktop.goto("/");
  const desktopNow = desktop.getByRole("region", { name: "Şimdi" });
  await expect(desktopNow.getByRole("button", { name: "Başla" })).toBeVisible();
  const desktopNavigations = forbidReloads(desktop);

  const mobile = await phone(browser, baseURL!);
  await mobile.page.goto("/");
  const mobileNow = mobile.page.getByRole("region", { name: "Şimdi" });
  await mobileNow.getByRole("button", { name: "Başla" }).tap();
  await expect(mobileNow.getByRole("button", { name: "Bitti" })).toBeVisible();
  const mobileNavigations = forbidReloads(mobile.page);

  // The desktop switches to the running state by itself.
  await expect(desktopNow.getByRole("button", { name: "Bitti" })).toBeVisible({ timeout: 3000 });
  await expect(desktopNow).toContainText("geçti · tahmin 45 dk");

  // Both screens count from the same start time: the one the server wrote.
  const [session] = await rows("sessions");
  expect(session.ended_at).toBeNull();
  const elapsed = async (region: typeof desktopNow) =>
    (await region.getByText(/geçti/).textContent())!.split(" geçti")[0];
  expect(await elapsed(desktopNow)).toBe(await elapsed(mobileNow));

  // Finish on the desktop; the phone follows.
  await desktopNow.getByRole("button", { name: "Bitti" }).click();
  await expect(mobileNow.getByRole("button", { name: "Bitti" })).toBeHidden({ timeout: 3000 });
  // The day's only work is finished: the day is done (Ç3, the finish line).
  await expect(mobileNow).toContainText("Bugün tamam");
  expect(desktopNavigations()).toBe(0);
  expect(mobileNavigations()).toBe(0);

  const sessions = await waitFor(
    () => rows("sessions"),
    (list) => list[0]?.ended_at !== null,
  );
  expect(sessions).toHaveLength(1);
  expect((await rows("tasks"))[0].status).toBe("done");

  await mobile.context.close();
});

test("a change made outside the app reaches an open screen too", async ({ page }) => {
  // The way a module's collector or the Claude bridge will write: straight to the database.
  const mod = await seedModule();
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Şimdi" })).toContainText(
    "Bugün için planlanan bir şey yok.",
  );
  const navigations = forbidReloads(page);

  await insert("tasks", { module_id: mod.id, title: "Dışarıdan gelen iş" });
  await expect(page.getByRole("heading", { name: "Dışarıdan gelen iş" })).toBeVisible({
    timeout: 3000,
  });
  await insert("inbox_entries", { raw_text: "dışarıdan gelen not" });
  await insert("blocks", {
    title: "Dışarıdan gelen blok",
    starts_at: new Date(Date.now() + 3_600_000).toISOString(),
    ends_at: new Date(Date.now() + 7_200_000).toISOString(),
  });
  expect(navigations()).toBe(0);
});

test("a fixed block added elsewhere re-plans the open screen at once (Ç3)", async ({ page }) => {
  const mod = await seedModule();
  await insert("tasks", { module_id: mod.id, title: "Rapor yazımı", est_minutes: 45 });
  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now.getByRole("heading")).toHaveText("Rapor yazımı");
  const navigations = forbidReloads(page);

  // A meeting that started five minutes ago, added on another device.
  await insert("blocks", {
    title: "Acil toplantı",
    starts_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  });
  await expect(now).toContainText("Sabit blok", { timeout: 3000 });
  await expect(now.getByRole("heading")).toHaveText("Acil toplantı");
  // The work is still on the day, after the block (or, late at night, for if there is time).
  await expect(page.getByRole("main")).toContainText("Rapor yazımı");
  expect(navigations()).toBe(0);
});
