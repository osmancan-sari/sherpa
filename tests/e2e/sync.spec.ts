import type { Browser, BrowserContext, Page } from "@playwright/test";
import { deviceToken, insert, postIngest, rows, seedModule, update, waitFor } from "./data";
import { expect, test } from "./fixtures";
import { roomInTheDay, STORAGE_STATE } from "./helpers";
import { activateDeneme, addRecord } from "./scene-helpers";
import { runAt, runNow } from "./clock";

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
  await roomInTheDay(desktop);
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
  await roomInTheDay(page);
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
    starts_at: runAt(60),
    ends_at: runAt(120),
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
  // The day's frame on.
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
  });
  await insert("modules", { slug: "deneme", name: "Deneme", color: "#6250d6" });
  const { token } = await deviceToken(["core/wake", "deneme/kayit"]);

  // The server stamps the waking with the real time: the page holds that day.
  await roomInTheDay(page);
  // Ç4c: Today writes the waking only in the day's flow, which a quiet hour (the evening, the
  // night) does not draw; the records page shows it at every hour.
  await page.goto("/ayarlar/kayitlar");
  const wakes = page.getByLabel("Uyanış saati");
  await expect(wakes).toHaveCount(2);
  const values = () =>
    wakes.evaluateAll((list) => list.map((input) => (input as HTMLInputElement).value));
  expect(await values()).toEqual(["", ""]);
  const other = await browser.newContext({ baseURL, storageState: STORAGE_STATE });
  const moduleTab = await other.newPage();
  await moduleTab.goto("/m/deneme");
  await expect(moduleTab.getByRole("heading", { name: "Deneme", level: 1 })).toBeVisible();
  const settingsTab = await other.newPage();
  await settingsTab.goto("/ayarlar/baglantilar");
  await expect(settingsTab.getByTestId("device-token")).toContainText("Henüz kullanılmadı");
  const navigations = [forbidReloads(page), forbidReloads(moduleTab), forbidReloads(settingsTab)];

  // The phone's alarm automation: the open page shows the waking.
  expect((await postIngest(baseURL!, "core/wake", token)).status).toBe(200);
  await expect.poll(values).toContainEqual(expect.stringMatching(/^\d\d:\d\d$/));

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

test("an open Today shows a waking told from outside in its day's flow (Ç4c)", async ({
  page,
  baseURL,
}) => {
  // A waking that can be told at any real hour (core/wake takes a moment up to a day back, never
  // ahead): today's 07:15 once it has passed, else yesterday's. The page stands at 10:30 of that
  // day, or at the real time when that is earlier (never ahead of it), with a piece of work so the
  // day's flow is drawn. (Before 16 Nov 2026 it took yesterday's 07:15 between 07:15 and 10:00,
  // more than a day back: 400.)
  const zone = "Europe/Istanbul";
  const dayOf = (instant: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(instant);
  const real = new Date();
  real.setSeconds(0, 0);
  const todayWake = new Date(`${dayOf(real)}T07:15:00+03:00`);
  const woke = todayWake < real ? todayWake : new Date(todayWake.getTime() - 86_400_000);
  const pageAt = new Date(Math.min(woke.getTime() + (3 * 60 + 15) * 60_000, real.getTime()));
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
  });
  const mod = await seedModule();
  await insert("tasks", { module_id: mod.id, title: "Okuma", est_minutes: 30 });
  const { token } = await deviceToken(["core/wake"]);
  await page.clock.setFixedTime(pageAt);
  await page.goto("/");
  const ends = page.getByTestId("flow-ends");
  await expect(ends).toHaveText(/^09:00 uyanış · /);
  const navigations = forbidReloads(page);

  expect((await postIngest(baseURL!, "core/wake", token, { at: woke.toISOString() })).status).toBe(
    200,
  );
  await expect(ends).toHaveText(/^07:15 uyanış · /);
  expect(navigations()).toBe(0);
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
  await expect(dot).toHaveCSS("background-color", "rgb(255, 179, 107)");

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
  await expect(row.getByTestId("color-dot")).toHaveCSS("background-color", "rgb(95, 214, 198)");

  // A facet's colour changed on the desktop shows on the phone.
  const sabah = desktop.getByTestId("color-row-sabah");
  await sabah.getByRole("button", { name: "Sabah: rengi değiştir" }).click();
  await sabah
    .getByRole("group", { name: "Sabah: hazır renkler" })
    .getByRole("button", { name: "Pembe" })
    .click();
  await expect(dot).toHaveCSS("background-color", "rgb(255, 143, 184)");
  expect(navigations.desktop()).toBe(0);
  expect(navigations.mobile()).toBe(0);
  await context.close();
});

// --- Rutin 1: the routine's scene on two screens (criterion 9; simulation B5) --------------------

test("Rutin: Sonraki on one screen brings the other to the same sub-step within a second; only the touched screen speaks", async ({
  page: desktop,
  browser,
  baseURL,
}) => {
  const { context, page: hand } = await phone(browser, baseURL!);
  await desktop.goto("/ayarlar/moduller");
  await desktop.getByRole("button", { name: "Rutin: etkinleştir" }).click();
  const [morning] = await waitFor(
    () => rows("rhythms"),
    (list) => list.length === 3,
  ).then((list) => list.filter((row) => row.key === "rutin:sabah"));
  const [mod] = await rows("modules");
  // The waking came from outside: both screens open on Günaydın; the phone is the one touched.
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
  });
  // As core/wake writes it, on the planning day (the night ends at 05:00).
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
    new Date(runNow().getTime() - 5 * 3_600_000),
  );
  const woke = { woke_at: runAt(-2), woke_source: "outside" };
  const known = (await rows("days")).find((row) => row.date === day);
  if (known) await update("days", known.id as string, woke);
  else await insert("days", { date: day, ...woke });
  await insert("sessions", { rhythm_id: morning.id, module_id: mod.id });
  await Promise.all([desktop.goto("/"), hand.goto("/")]);
  const desk = desktop.getByTestId("rutin-scene");
  const phoneScene = hand.getByTestId("rutin-scene");
  await expect(phoneScene).toHaveAttribute("data-screen", "gunaydin");
  await expect(desk).toHaveAttribute("data-screen", "gunaydin");
  await phoneScene.getByRole("button", { name: "Kalktım" }).click();
  await expect(phoneScene).toHaveAttribute("data-screen", "adim");
  const said = (page: Page) =>
    page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  await expect.poll(async () => (await said(hand)).join(" ")).toContain("Günaydın.");

  // The second screen leaves Günaydın by itself and says nothing: only the touched screen speaks.
  await expect(desk).toHaveAttribute("data-screen", "adim");
  await expect(desk).toHaveAttribute("data-part", "0");
  // The phone moves the run; the second screen follows within a second.
  await phoneScene.getByRole("button", { name: "Sonraki" }).click();
  await expect(phoneScene).toHaveAttribute("data-part", "1");
  await expect(desk).toHaveAttribute("data-part", "1", { timeout: 1000 });
  await desktop.waitForTimeout(500);
  expect(await said(desktop)).toEqual([]);
  expect((await said(hand)).filter((text) => text.startsWith("Günaydın."))).toHaveLength(1);
  await context.close();
});

// --- Sabah açılışı (16 Nov 2026): the morning's welcome on two screens ---------------------------

/** Rutin on, the frame on, no waking; both screens at yesterday's 07:00, on the welcome. */
async function welcomeOnBoth(desktop: Page, hand: Page) {
  await desktop.goto("/ayarlar/moduller");
  await desktop.getByRole("button", { name: "Rutin: etkinleştir" }).click();
  await waitFor(
    () => rows("rhythms"),
    (list) => list.length === 3,
  );
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
    day_start_default: "08:00",
  });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
    new Date(Date.now() - 86_400_000),
  );
  const seven = new Date(`${day}T07:00:00+03:00`);
  await desktop.clock.setFixedTime(seven);
  await hand.clock.setFixedTime(seven);
  await Promise.all([desktop.goto("/"), hand.goto("/")]);
  await expect(desktop.getByTestId("rutin-welcome")).toBeVisible();
  await expect(hand.getByTestId("rutin-welcome")).toBeVisible();
  return day;
}

test("Şimdi değil on one screen leaves the welcome on the other too, live", async ({
  page: desktop,
  browser,
  baseURL,
}) => {
  const { context, page: hand } = await phone(browser, baseURL!);
  const day = await welcomeOnBoth(desktop, hand);
  const navigations = forbidReloads(desktop);
  await hand.getByTestId("rutin-welcome").getByRole("button", { name: "Şimdi değil" }).click();
  // The day's row holds it, for the account.
  await waitFor(
    () => rows("days"),
    (list) => list.some((row) => row.date === day && row.welcome_later_at !== null),
  );
  // The board leaves its welcome without a reload: Today with the Günaydın card.
  await expect(desktop.getByTestId("welcome")).toBeHidden();
  await expect(
    desktop.getByRole("region", { name: "Şimdi" }).getByRole("heading", { name: "Günaydın" }),
  ).toBeVisible();
  expect(navigations()).toBe(0);
  // Opened again on the board: still Today.
  await desktop.reload();
  await expect(
    desktop.getByRole("region", { name: "Şimdi" }).getByRole("heading", { name: "Günaydın" }),
  ).toBeVisible();
  await expect(desktop.getByTestId("welcome")).toBeHidden();
  await context.close();
});

test("Başla on one screen brings the other from its welcome to the scene, live", async ({
  page: desktop,
  browser,
  baseURL,
}) => {
  await roomInTheDay(desktop);
  const { context, page: hand } = await phone(browser, baseURL!);
  await welcomeOnBoth(desktop, hand);
  const navigations = forbidReloads(desktop);
  await hand.getByTestId("rutin-welcome").getByRole("button", { name: "Başla" }).click();
  await expect(hand.getByTestId("rutin-scene")).toHaveAttribute("data-screen", "adim");
  // The board goes from its welcome to the same step without a reload; one session.
  await expect(desktop.getByTestId("rutin-scene")).toHaveAttribute("data-screen", "adim");
  await expect(desktop.getByTestId("welcome")).toBeHidden();
  expect(navigations()).toBe(0);
  const open = (await rows("sessions")).filter((row) => row.ended_at === null);
  expect(open).toHaveLength(1);
  await context.close();
});

// Last: the older live tests run first, while Realtime is quietest.
test("Okul çekirdek A: a facet's colour changed elsewhere reaches an open scene's backdrop, live", async ({
  page,
}) => {
  await activateDeneme(page);
  const [mod] = await rows("modules");
  await update("modules", mod.id as string, { facet_colors: { sabah: "#0d9488" } });
  await addRecord(page, "Sabah esnemesi", { minutes: "20", facet: "sabah" });
  await page.goto("/m/deneme");
  await page
    .getByRole("region", { name: "Yaklaşanlar" })
    .getByRole("button", { name: "Başla: Sabah esnemesi" })
    .click();
  await page.goto("/");
  await expect(page.getByTestId("deneme-gunes")).toBeVisible();
  const backdrop = page.getByTestId("deneme-backdrop").filter({ visible: true }).first();
  await expect(backdrop).toHaveAttribute("data-color", "#0d9488");
  const reloads = forbidReloads(page);
  // Ayarlar on another device: the open scene's backdrop follows without a reload.
  await update("modules", mod.id as string, { facet_colors: { sabah: "#db2777" } });
  await expect(backdrop).toHaveAttribute("data-color", "#db2777");
  expect(reloads()).toBe(0);
});
