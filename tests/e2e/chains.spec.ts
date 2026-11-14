import type { Page } from "@playwright/test";
import { insert, rows, update, waitFor } from "./data";
import { expect, test } from "./fixtures";

// The anchored chains (Ç3f; docs/06-modul-sozlesmesi.md, "Diziler"): two modules' wake-bound
// work in one morning, the scene that sees all of it, the standard card's line. The frame is off
// in the test account; these tests switch it on. Hours are YESTERDAY's (see timing.spec.ts): the
// browser's clock is never ahead of the database's.

const ISTANBUL = "Europe/Istanbul";
const istanbulDay = (days = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ISTANBUL }).format(
    new Date(Date.now() + days * 86_400_000),
  );
const DAY = istanbulDay(-1);
const dayAt = (time: string, day = DAY) => new Date(`${day}T${time}:00+03:00`);
const FRAME = { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 };

type Row = Record<string, unknown> & { id: string };

/** The frame on, an ordinary day (08:00–19:00), the test module and a renamed template copy. */
async function setUp(frame: Record<string, unknown> = {}) {
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: { ...FRAME, ...frame },
    day_start_default: "08:00",
    finish_line_default: "19:00",
  });
  const [deneme] = await insert<Row>("modules", {
    slug: "deneme",
    name: "Deneme",
    color: "#7c3aed",
  });
  const [copy] = await insert<Row>("modules", {
    slug: "sablon-kopya",
    name: "Şablon kopyası",
    color: "#16a34a",
  });
  return { deneme, copy };
}

/** The morning: teeth (deneme, sunny facet), neck (the template copy), shower (deneme). */
async function morning(frame: Record<string, unknown> = {}) {
  const { deneme, copy } = await setUp(frame);
  await insert("days", { date: DAY, woke_at: dayAt("07:00").toISOString() });
  const [teeth, neck, shower] = await insert<Row>("tasks", [
    {
      module_id: deneme.id,
      title: "Diş ve su",
      est_minutes: 10,
      facet: "sabah",
      timing: { anchor: "wake", order: 10 },
    },
    { module_id: copy.id, title: "Boyun", est_minutes: 10, timing: { anchor: "wake", order: 20 } },
    {
      module_id: deneme.id,
      title: "Duş ve hazırlık",
      est_minutes: 15,
      facet: "sabah",
      timing: { anchor: "wake", order: 30 },
    },
  ]);
  return { deneme, copy, teeth, neck, shower };
}

const card = (page: Page) => page.getByRole("region", { name: "Şimdi" });
const chainItems = (page: Page) => page.getByTestId("scene-chain").getByRole("listitem");

test("two modules' wake-bound work is one chain: the scene gets all of it, the card its place", async ({
  page,
}) => {
  await morning();
  await page.clock.setFixedTime(dayAt("07:02"));
  await page.goto("/");
  await expect(card(page).getByRole("heading", { name: "Diş ve su" })).toBeVisible();
  await expect(card(page).getByTestId("chain-line")).toHaveText("Sabah dizisi 1/3 · sırada Boyun");

  await card(page).getByRole("button", { name: "Başla", exact: true }).click();
  const scene = page.getByTestId("deneme-gunes");
  await expect(scene).toBeVisible();
  const items = chainItems(page);
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toHaveAttribute("data-state", "running");
  await expect(items.nth(0)).toHaveAttribute("data-mine", "true");
  await expect(items.nth(1)).toContainText("Boyun");
  await expect(items.nth(1)).toContainText("Şablon kopyası · 10 dk · sırada");
  await expect(items.nth(1)).toHaveAttribute("data-mine", "false");
  await expect(items.nth(2)).toContainText("Duş ve hazırlık");
  await expect(items.nth(2)).toHaveAttribute("data-state", "next");

  // Out of the scene: the standard card says where the work stands.
  await page.getByRole("button", { name: "Çık" }).click();
  await expect(card(page).getByTestId("chain-line")).toHaveText("Sabah dizisi 1/3 · sırada Boyun");
  await expect(card(page).getByRole("button", { name: "Sahneye dön" })).toBeVisible();
});

test("the evening's card shows the bed chain's place of the work it offers", async ({ page }) => {
  const { deneme, copy } = await setUp();
  await insert("days", { date: DAY, woke_at: dayAt("07:00").toISOString() });
  await insert("tasks", [
    {
      module_id: copy.id,
      title: "Akşam esnemesi",
      est_minutes: 10,
      timing: { anchor: "bed", order: 10 },
    },
    {
      module_id: deneme.id,
      title: "Yüz",
      est_minutes: 10,
      facet: "aksam",
      timing: { anchor: "bed", order: 20 },
    },
  ]);
  // Tomorrow is light: bed at 01:00, the bed-bound work from 00:40.
  await page.clock.setFixedTime(dayAt("21:00"));
  await page.goto("/");
  await expect(card(page).getByRole("heading", { name: "Akşam esnemesi" })).toBeVisible();
  await expect(card(page).getByTestId("chain-line")).toHaveText("Akşam dizisi 1/2 · sırada Yüz");
});

// --- Going on by itself (day_frame.chain_auto) -------------------------------------------------

const open = async () => (await rows("sessions")).filter((row) => row.ended_at === null);

/** Waits until the open session is on this work. */
const runningOn = (workId: string) =>
  waitFor(open, (list) => list.length === 1 && list[0].task_id === workId);

/** No session starts within a short while (the start would come right after the end). */
async function nothingStarts(page: Page) {
  await page.waitForTimeout(1500);
  expect(await open()).toEqual([]);
}

test("Bitti in a chain starts the next work on this device: another module's card, then the scene again", async ({
  page,
}) => {
  const { teeth, neck, shower } = await morning();
  await page.clock.setFixedTime(dayAt("07:02"));
  await page.goto("/");
  await card(page).getByRole("button", { name: "Başla", exact: true }).click();
  await expect(page.getByTestId("deneme-gunes")).toBeVisible();
  await runningOn(teeth.id);

  // The scene's Bitti: the template copy's work has no scene; its standard card comes.
  await page.getByTestId("deneme-gunes").getByRole("button", { name: "Bitti" }).click();
  await expect(page.getByTestId("deneme-gunes")).toBeHidden();
  await expect(card(page).getByRole("heading", { name: "Boyun" })).toBeVisible();
  await expect(card(page).getByTestId("chain-line")).toHaveText(
    "Sabah dizisi 2/3 · sırada Duş ve hazırlık",
  );
  await expect(card(page).getByRole("button", { name: "Bitti" })).toBeVisible();
  await runningOn(neck.id);

  // The card's Bitti: back to the test module's sunny scene, the first two done.
  await card(page).getByRole("button", { name: "Bitti" }).click();
  await expect(page.getByTestId("deneme-gunes")).toBeVisible();
  await expect(page.getByTestId("deneme-gunes").getByRole("heading")).toHaveText("Duş ve hazırlık");
  const items = chainItems(page);
  await expect(items.nth(0)).toHaveAttribute("data-state", "done");
  await expect(items.nth(1)).toHaveAttribute("data-state", "done");
  await expect(items.nth(2)).toHaveAttribute("data-state", "running");
  await runningOn(shower.id);

  // The last one: the standard screen comes back, nothing more starts.
  await page.getByTestId("deneme-gunes").getByRole("button", { name: "Bitti" }).click();
  await expect(page.getByTestId("deneme-gunes")).toBeHidden();
  await nothingStarts(page);
  const sessions = await rows("sessions");
  expect(sessions.map((row) => row.task_id).sort()).toEqual([teeth.id, neck.id, shower.id].sort());
  const tasks = await rows("tasks");
  expect(tasks.every((row) => row.status === "done")).toBe(true);
});

test("with the setting off, Bitti starts nothing; the next work is offered", async ({ page }) => {
  const { teeth } = await morning({ chain_auto: false });
  await page.clock.setFixedTime(dayAt("07:02"));
  await page.goto("/");
  await card(page).getByRole("button", { name: "Başla", exact: true }).click();
  await runningOn(teeth.id);
  await page.getByTestId("deneme-gunes").getByRole("button", { name: "Bitti" }).click();
  await expect(card(page).getByRole("heading", { name: "Boyun" })).toBeVisible();
  await expect(card(page).getByRole("button", { name: "Başla", exact: true })).toBeVisible();
  await nothingStarts(page);
});

test("Ertele goes on with the next work; Durdur and Takıldım do not", async ({ page }) => {
  const { teeth, neck, shower } = await morning();
  await page.clock.setFixedTime(dayAt("07:02"));
  await page.goto("/");
  await card(page).getByRole("button", { name: "Başla", exact: true }).click();
  await runningOn(teeth.id);
  // Out of the scene to the card's Ertele: the teeth go to tomorrow, the neck starts.
  await page.getByRole("button", { name: "Çık" }).click();
  await card(page).getByRole("button", { name: "Ertele" }).click();
  await expect(card(page).getByRole("heading", { name: "Boyun" })).toBeVisible();
  await expect(card(page).getByRole("button", { name: "Bitti" })).toBeVisible();
  await runningOn(neck.id);
  await expect(card(page).getByTestId("chain-line")).toHaveText(
    "Sabah dizisi 1/2 · sırada Duş ve hazırlık",
  );

  // Durdur: nothing starts; the neck is offered again.
  await card(page).getByRole("button", { name: "Durdur" }).click();
  await expect(card(page).getByRole("button", { name: "Başla", exact: true })).toBeVisible();
  await nothingStarts(page);

  // Takıldım (from the scene of the shower): nothing starts.
  await page.goto("/m/deneme");
  await page
    .getByRole("region", { name: "Yaklaşanlar" })
    .getByRole("button", { name: "Başla: Duş ve hazırlık" })
    .click();
  await runningOn(shower.id);
  await page.goto("/");
  await page.getByTestId("deneme-gunes").getByRole("button", { name: "Takıldım" }).click();
  await expect(card(page).getByRole("button", { name: "Adımı küçült" })).toBeVisible();
  await nothingStarts(page);
});

test("a session closed unanswered does not start the next work", async ({ page }) => {
  const { teeth } = await morning();
  await update("tasks", teeth.id, { status: "doing" });
  // Ten minutes planned, started at 07:01: asked at 07:21, closed unanswered at 07:51.
  await insert("sessions", {
    task_id: teeth.id,
    module_id: teeth.module_id,
    started_at: dayAt("07:01").toISOString(),
  });
  await page.clock.setFixedTime(dayAt("07:55"));
  await page.goto("/");
  await waitFor(open, (list) => list.length === 0, 10_000);
  await nothingStarts(page);
  expect(await rows("sessions")).toHaveLength(1);
});

test("the bed chain goes on the same way", async ({ page }) => {
  const { deneme, copy } = await setUp();
  await insert("days", { date: DAY, woke_at: dayAt("07:00").toISOString() });
  const [stretch, face] = await insert<Row>("tasks", [
    {
      module_id: copy.id,
      title: "Akşam esnemesi",
      est_minutes: 10,
      timing: { anchor: "bed", order: 10 },
    },
    {
      module_id: deneme.id,
      title: "Yüz",
      est_minutes: 10,
      facet: "aksam",
      timing: { anchor: "bed", order: 20 },
    },
  ]);
  await page.clock.setFixedTime(dayAt("21:00"));
  await page.goto("/");
  await card(page).getByRole("button", { name: "Başla", exact: true }).click();
  await runningOn(stretch.id);
  await card(page).getByRole("button", { name: "Bitti" }).click();
  // The test module's night scene, with the bed chain.
  await expect(page.getByTestId("deneme-gece")).toBeVisible();
  await expect(page.getByTestId("scene-chain")).toHaveAttribute("aria-label", "Bu akşam");
  await expect(chainItems(page).nth(0)).toHaveAttribute("data-state", "done");
  await runningOn(face.id);
  await page.getByTestId("deneme-gece").getByRole("button", { name: "Bitti" }).click();
  await expect(page.getByTestId("deneme-gece")).toBeHidden();
  await nothingStarts(page);
});

test("Ayarlar: the chain setting is on at first and can be switched off", async ({ page }) => {
  await setUp();
  await page.goto("/ayarlar");
  const form = page.getByRole("form", { name: "Günün çerçevesi" });
  const box = form.getByLabel("Dizide sıradaki iş kendiliğinden başlasın");
  await expect(box).toBeChecked();
  await box.uncheck();
  await form.getByRole("button", { name: "Kaydet" }).click();
  const [settings] = await waitFor(
    () => rows("settings"),
    (list) => (list[0].day_frame as Record<string, unknown>)?.chain_auto === false,
  );
  expect(settings.day_frame).toEqual({ ...FRAME, chain_auto: false });
  await page.reload();
  await expect(box).not.toBeChecked();
});

test("Space ends the running work and goes on in the chain, as Bitti does", async ({ page }) => {
  const { teeth, neck } = await morning();
  await page.clock.setFixedTime(dayAt("07:02"));
  await page.goto("/");
  await card(page).getByRole("button", { name: "Başla", exact: true }).click();
  await runningOn(teeth.id);
  await expect(page.getByTestId("deneme-gunes")).toBeVisible();
  await page.keyboard.press(" ");
  await expect(card(page).getByRole("heading", { name: "Boyun" })).toBeVisible();
  await runningOn(neck.id);
});

// --- A waking told from outside (core/wake) ------------------------------------------------------

const START_ON_WAKE = { start_on_wake: true };

/** The chain with no waking yet; `woke` writes it as the ingest endpoint does. */
async function morningUnwoken(frame: Record<string, unknown> = START_ON_WAKE) {
  const seeded = await morning(frame);
  const [day] = (await rows("days")).filter((row) => row.date === DAY);
  await update("days", day.id as string, { woke_at: null });
  const woke = (time: string) =>
    update("days", day.id as string, { woke_at: dayAt(time).toISOString() });
  return { ...seeded, woke };
}

test("after a waking told from outside, the app coming to the front starts the chain once, on one device", async ({
  page,
  browser,
}) => {
  const { teeth } = await morning(START_ON_WAKE);
  const phone = await browser.newPage({ storageState: "playwright/.auth/user.json" });
  await page.clock.setFixedTime(dayAt("07:05"));
  await phone.clock.setFixedTime(dayAt("07:05"));
  // Both screens come to the front at the same moment.
  await Promise.all([page.goto("/"), phone.goto("/")]);
  await runningOn(teeth.id);
  await expect(page.getByTestId("deneme-gunes")).toBeVisible();
  await expect(phone.getByTestId("deneme-gunes")).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await rows("sessions")).toHaveLength(1);
  // Once a day on a device: back to the front after the work was stopped, nothing more starts.
  await page.getByTestId("deneme-gunes").getByRole("button", { name: "Takıldım" }).click();
  await page.reload();
  await phone.reload();
  await nothingStarts(page);
  await phone.close();
});

test("after a waking told from outside nothing starts with the setting off", async ({ page }) => {
  await morning();
  await page.clock.setFixedTime(dayAt("07:05"));
  await page.goto("/");
  await expect(card(page).getByRole("heading", { name: "Diş ve su" })).toBeVisible();
  await nothingStarts(page);
});

test("a chain an hour past its end is not started by the waking told from outside", async ({
  page,
}) => {
  await morning(START_ON_WAKE);
  // The line runs 07:00–07:35; it is offered until 08:35.
  await page.clock.setFixedTime(dayAt("08:40"));
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Şimdi" })).toBeVisible();
  await nothingStarts(page);
});

test("'Uyandım' said on the screen works as before: one start", async ({ page }) => {
  const { teeth } = await morningUnwoken();
  await page.clock.setFixedTime(dayAt("07:30"));
  await page.goto("/");
  await card(page).getByRole("button", { name: "Uyandım" }).click();
  await runningOn(teeth.id);
  await page.waitForTimeout(1500);
  expect(await rows("sessions")).toHaveLength(1);
});

test("a screen that stays open does not start the chain; coming back to the front does", async ({
  page,
}) => {
  const { teeth, woke } = await morningUnwoken();
  await page.clock.install({ time: dayAt("06:50") });
  await page.goto("/");
  await expect(card(page).getByRole("heading", { name: "Günaydın" })).toBeVisible();
  // Long after the page came to the front, the phone's automation records the waking.
  await page.clock.fastForward("00:30");
  await woke("06:50");
  await expect(card(page).getByRole("heading", { name: "Diş ve su" })).toBeVisible();
  await nothingStarts(page);
  // The app comes back to the front.
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await runningOn(teeth.id);
});
