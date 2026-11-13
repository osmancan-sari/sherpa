import type { Browser, BrowserContext, Page } from "@playwright/test";
import { deviceToken, insert, postIngest, rows, seedModule, update, waitFor } from "./data";
import { expect, test } from "./fixtures";
import { roomInTheDay, STORAGE_STATE } from "./helpers";
import { activateDeneme, addRecord } from "./scene-helpers";

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

  await roomInTheDay(desktop);
  await desktop.goto("/");
  const desktopNow = desktop.getByRole("region", { name: "Şimdi" });
  await expect(desktopNow.getByRole("button", { name: "Başla" })).toBeVisible();
  const desktopNavigations = forbidReloads(desktop);

  const mobile = await phone(browser, baseURL!);
  await roomInTheDay(mobile.page);
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
  const clock = await roomInTheDay(page);
  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now.getByRole("heading")).toHaveText("Rapor yazımı");
  const navigations = forbidReloads(page);

  // A meeting that started five minutes ago, added on another device.
  await insert("blocks", {
    title: "Acil toplantı",
    starts_at: new Date(clock.getTime() - 5 * 60_000).toISOString(),
    ends_at: new Date(clock.getTime() + 60 * 60_000).toISOString(),
  });
  await expect(now).toContainText("Sabit blok", { timeout: 3000 });
  await expect(now.getByRole("heading")).toHaveText("Acil toplantı");
  // The work is still on the day, after the block (or, late at night, for if there is time).
  await expect(page.getByRole("main")).toContainText("Rapor yazımı");
  expect(navigations()).toBe(0);
});

test("what the ingest endpoint writes reaches open screens: the waking, a record, the last use (Ç3d)", async ({
  page,
  browser,
  baseURL,
}) => {
  // The day's frame on, so the top bar shows the waking.
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
  });
  await insert("modules", { slug: "deneme", name: "Deneme", color: "#6250d6" });
  const { token } = await deviceToken(["core/wake", "deneme/kayit"]);

  await page.goto("/");
  const wake = page.getByTestId("wake-line");
  await expect(wake).toHaveText(/^beklenen uyanış/);
  const other = await browser.newContext({ baseURL, storageState: STORAGE_STATE });
  const moduleTab = await other.newPage();
  await moduleTab.goto("/m/deneme");
  await expect(moduleTab.getByRole("heading", { name: "Deneme", level: 1 })).toBeVisible();
  const settingsTab = await other.newPage();
  await settingsTab.goto("/ayarlar");
  await expect(settingsTab.getByTestId("device-token")).toContainText("Henüz kullanılmadı");
  const navigations = [forbidReloads(page), forbidReloads(moduleTab), forbidReloads(settingsTab)];

  // The phone's alarm automation: Today shows the waking.
  expect((await postIngest(baseURL!, "core/wake", token)).status).toBe(200);
  await expect(wake).toHaveText(/^uyanış \d\d:\d\d$/);

  // A collector's record: the module's page lists it, and its work is proposed.
  const sent = await postIngest(baseURL!, "deneme/kayit", token, {
    title: "Dışarıdan gelen kayıt",
  });
  expect(sent.status).toBe(200);
  await expect(moduleTab.getByText("Dışarıdan gelen kayıt").first()).toBeVisible();
  await waitFor(
    () => rows("work_items"),
    (list) => list.some((item) => item.title === "Dışarıdan gelen kayıt"),
  );
  // Settings shows the token's last use.
  await expect(settingsTab.getByTestId("device-token")).toContainText("Son kullanım:");
  expect(navigations.map((count) => count())).toEqual([0, 0, 0]);
  await other.close();
});

test("a topic added and colours changed reach open screens: the colour list, the other device (Ç3e)", async ({
  page: desktop,
  browser,
  baseURL,
}) => {
  await activateDeneme(desktop);
  await addRecord(desktop, "Sabah yürüyüşü", { minutes: "30", facet: "sabah" });
  const { context, page: mobile } = await phone(browser, baseURL!);
  await mobile.goto("/m/deneme");
  const dot = mobile
    .getByRole("region", { name: "Yaklaşanlar" })
    .getByRole("listitem")
    .filter({ hasText: "Sabah yürüyüşü" })
    .getByTestId("work-dot");
  await expect(dot).toHaveCSS("background-color", "rgb(217, 119, 6)");

  await desktop.goto("/ayarlar/moduller/deneme");
  const colours = desktop.getByRole("region", { name: "Renkler" });
  await expect(colours.getByTestId(/^color-row-/)).toHaveCount(3);
  const navigations = { desktop: forbidReloads(desktop), mobile: forbidReloads(mobile) };

  // A topic is written elsewhere: it is a facet in the open colour list at once.
  const [topic] = await insert<{ id: string }>("deneme_items", {
    title: "İstatistik",
    kind: "konu",
  });
  const row = colours.getByTestId(`color-row-konu-${topic.id.slice(0, 8)}`);
  await expect(row).toContainText("İstatistik");
  await expect(row.getByTestId("color-dot")).toHaveCSS("background-color", "rgb(13, 148, 136)");

  // A facet's colour changed on the desktop shows on the phone.
  const sabah = desktop.getByTestId("color-row-sabah");
  await sabah.getByRole("button", { name: "Sabah: rengi değiştir" }).click();
  await sabah
    .getByRole("group", { name: "Sabah: hazır renkler" })
    .getByRole("button", { name: "Gül" })
    .click();
  await expect(dot).toHaveCSS("background-color", "rgb(225, 29, 72)");
  expect(navigations.desktop()).toBe(0);
  expect(navigations.mobile()).toBe(0);
  await context.close();
});
