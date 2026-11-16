import type { Page } from "@playwright/test";
import { insert, rows, update, waitFor } from "./data";
import { expect, test } from "./fixtures";
import { activateDeneme, spoken } from "./scene-helpers";
import { roomInTheDay } from "./helpers";

// Sabah açılışı (16 Nov 2026; prompts/sabah-acilisi.md; docs/06-modul-sozlesmesi.md, "Sahne",
// rule 7): in the morning the app opens on the welcome of the scene that shows the wake chain's
// first work (Rutin's morning), instead of the Today screen: "Günaydın" and one "Başla". On the
// board and on the phone (*.both). Hours are YESTERDAY's, as in rutin.spec.ts: the browser's clock
// is never ahead of the database's.

const ISTANBUL = "Europe/Istanbul";
const istanbulDay = (days = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ISTANBUL }).format(
    new Date(Date.now() + days * 86_400_000),
  );
const DAY = istanbulDay(-1);
const dayAt = (time: string, day = DAY) => new Date(`${day}T${time}:00+03:00`);
const FRAME = { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 };

/** The frame on (no start on waking), Rutin on; the day's waking as given (none by default). */
async function setUp(page: Page, woke: { at: string; source: "screen" | "outside" } | null = null) {
  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Rutin: etkinleştir" }).click();
  await expect(page.getByRole("link", { name: "Rutin ayarları" })).toBeVisible();
  await waitFor(
    () => rows("rhythms"),
    (list) => list.length === 3,
  );
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: FRAME,
    day_start_default: "08:00",
  });
  if (woke) {
    await insert("days", {
      date: DAY,
      woke_at: dayAt(woke.at).toISOString(),
      woke_source: woke.source,
    });
  }
}

const welcome = (page: Page) => page.getByTestId("welcome");
const scene = (page: Page) => page.getByTestId("rutin-scene");
const card = (page: Page) => page.getByRole("region", { name: "Şimdi" });
const dayRow = async () => (await rows("days")).find((row) => row.date === DAY);
const open = async () => (await rows("sessions")).filter((row) => row.ended_at === null);
const morningRhythm = async () =>
  (await rows("rhythms")).find((row) => row.key === "rutin:sabah") as { id: string };

test("the morning opens on the welcome; Başla records the waking and starts the routine in one tap", async ({
  page,
}) => {
  await roomInTheDay(page);
  await setUp(page);
  await page.clock.setFixedTime(dayAt("07:00"));
  await page.goto("/");

  // Instead of Today: Rutin's morning welcome, full screen, no strip, nothing said.
  await expect(welcome(page)).toBeVisible();
  const own = page.getByTestId("rutin-welcome");
  await expect(own.getByRole("heading", { name: "Günaydın" })).toBeVisible();
  await expect(own.getByRole("button", { name: "Biraz önce uyandım" })).toBeVisible();
  await expect(own.getByRole("button", { name: "Şimdi değil" })).toBeVisible();
  await expect(card(page)).toBeHidden();
  await expect(page.getByRole("banner", { name: "Sahne şeridi" })).toBeHidden();
  expect(await spoken(page)).toEqual([]);
  // A look at the welcome is no waking (the first touch's estimate does not count it).
  await own.getByRole("heading", { name: "Günaydın" }).click();
  await page.waitForTimeout(500);
  expect((await dayRow())?.woke_at ?? null).toBeNull();

  await own.getByRole("button", { name: "Başla" }).click();
  // The scene comes with the routine's first step at once (no second Günaydın) and tells the day.
  await expect(scene(page)).toHaveAttribute("data-screen", "adim");
  await expect(scene(page).getByRole("heading", { name: "Diş bakımı" })).toBeVisible();
  await expect.poll(async () => (await spoken(page)).join(" ")).toContain("Günaydın.");
  // The waking as "Uyandım" writes it (a screen's, not estimated), and its event.
  const day = await waitFor(dayRow, (row) => row?.woke_at != null);
  expect(Date.parse(day!.woke_at as string)).toBe(dayAt("07:00").getTime());
  expect(day).toMatchObject({ woke_estimated: false, woke_source: "screen" });
  const events = await waitFor(
    () => rows("events"),
    (list) => list.some((row) => row.type === "core.day_started"),
  );
  expect(events.find((row) => row.type === "core.day_started")?.payload).toMatchObject({
    estimated: false,
  });
  // One session, on the morning's routine.
  const sabah = await morningRhythm();
  const [session] = await waitFor(open, (list) => list.length === 1);
  expect(session.rhythm_id).toBe(sabah.id);
  await page.waitForTimeout(1000);
  expect(await rows("sessions")).toHaveLength(1);
});

test("Şimdi değil: the Today screen with Günaydın; the welcome does not come again that day", async ({
  page,
}) => {
  await setUp(page);
  await page.clock.setFixedTime(dayAt("07:00"));
  await page.goto("/");
  await page.getByTestId("rutin-welcome").getByRole("button", { name: "Şimdi değil" }).click();
  await expect(welcome(page)).toBeHidden();
  await expect(card(page).getByRole("heading", { name: "Günaydın" })).toBeVisible();
  // Saying "Şimdi değil" was no waking.
  await page.waitForTimeout(500);
  expect((await dayRow())?.woke_at ?? null).toBeNull();
  // Opened again (later that morning): Today, not the welcome.
  await page.clock.setFixedTime(dayAt("07:20"));
  await page.reload();
  await expect(card(page).getByRole("heading", { name: "Günaydın" })).toBeVisible();
  await expect(welcome(page)).toBeHidden();
  // "Uyandım" on the card goes on as before.
  await card(page).getByRole("button", { name: "Uyandım" }).click();
  await waitFor(dayRow, (row) => row?.woke_at != null);
  await expect(welcome(page)).toBeHidden();
});

test("Biraz önce uyandım: the waking at the chosen minutes before, and the routine starts", async ({
  page,
}) => {
  await roomInTheDay(page);
  await setUp(page);
  await page.clock.setFixedTime(dayAt("07:40"));
  await page.goto("/");
  const own = page.getByTestId("rutin-welcome");
  await own.getByRole("button", { name: "Biraz önce uyandım" }).click();
  await own.getByRole("button", { name: "30 dk önce" }).click();
  const day = await waitFor(dayRow, (row) => row?.woke_at != null);
  expect(Date.parse(day!.woke_at as string)).toBe(dayAt("07:10").getTime());
  expect(day?.woke_estimated).toBe(false);
  const sabah = await morningRhythm();
  await waitFor(open, (list) => list.length === 1 && list[0].rhythm_id === sabah.id);
  await expect(scene(page).getByRole("heading", { name: "Diş bakımı" })).toBeVisible();
});

test("a waking told from outside: the welcome's Başla starts the routine, the waking kept", async ({
  page,
}) => {
  await roomInTheDay(page);
  // The phone's alarm automation wrote it (as core/wake does); nothing starts by itself.
  await setUp(page, { at: "06:58", source: "outside" });
  await page.clock.setFixedTime(dayAt("07:05"));
  await page.goto("/");
  const own = page.getByTestId("rutin-welcome");
  await expect(own.getByRole("heading", { name: "Günaydın" })).toBeVisible();
  await expect(own).toHaveAttribute("data-woke", "");
  // The waking is known: no "Biraz önce uyandım".
  await expect(own.getByRole("button", { name: "Biraz önce uyandım" })).toBeHidden();
  await expect(own.getByRole("button", { name: "Şimdi değil" })).toBeVisible();
  await page.waitForTimeout(800);
  expect(await open()).toHaveLength(0);

  await own.getByRole("button", { name: "Başla" }).click();
  // Straight to the first step: the scene's own Günaydın ("Kalktım") does not come again.
  await expect(scene(page)).toHaveAttribute("data-screen", "adim");
  await expect(scene(page).getByRole("heading", { name: "Diş bakımı" })).toBeVisible();
  await expect.poll(async () => (await spoken(page)).join(" ")).toContain("Günaydın.");
  const day = await dayRow();
  expect(Date.parse(day!.woke_at as string)).toBe(dayAt("06:58").getTime());
  expect(day?.woke_source).toBe("outside");
  await waitFor(open, (list) => list.length === 1);
});

test("with no module staging the morning, the Günaydın card as before", async ({ page }) => {
  await setUp(page);
  // Rutin paused: nothing is bound to the waking.
  const [mod] = await rows("modules");
  await update("modules", mod.id as string, { status: "paused" });
  await page.clock.setFixedTime(dayAt("07:00"));
  await page.goto("/");
  await expect(card(page).getByRole("heading", { name: "Günaydın" })).toBeVisible();
  await expect(welcome(page)).toBeHidden();
});

test("outside the morning's window, Today", async ({ page }) => {
  await setUp(page);
  // Before the waking range.
  await page.clock.setFixedTime(dayAt("05:45"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bugün" }).first()).toBeVisible();
  await expect(welcome(page)).toBeHidden();
  // Two hours past the latest waking (09:00) and later: the afternoon.
  await page.clock.setFixedTime(dayAt("14:00"));
  await page.reload();
  await expect(card(page)).toBeVisible();
  await expect(welcome(page)).toBeHidden();
});

// --- The contract's example in "deneme": a focused sitting bound to the waking --------------------

async function denemeMorning(page: Page, title: string) {
  await activateDeneme(page);
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, { day_frame: FRAME, day_start_default: "08:00" });
  const [mod] = await rows("modules");
  const [task] = await insert<{ id: string }>("tasks", {
    module_id: mod.id,
    title,
    est_minutes: 20,
    meta: { kind: "odak" },
    timing: { anchor: "wake", order: 10 },
  });
  return task;
}

test("deneme's focus scene has a welcome too; its Başla starts that work", async ({ page }) => {
  await roomInTheDay(page);
  const task = await denemeMorning(page, "Sabah okuması");
  await page.clock.setFixedTime(dayAt("07:00"));
  await page.goto("/");
  const own = page.getByTestId("deneme-welcome");
  await expect(own).toContainText("Önce: Sabah okuması");
  await own.getByRole("button", { name: "Başla" }).click();
  await expect(page.getByTestId("deneme-focus")).toBeVisible();
  const [session] = await waitFor(open, (list) => list.length === 1);
  expect(session.task_id).toBe(task.id);
});

test("a welcome that fails gives the Today screen back", async ({ page }) => {
  await denemeMorning(page, "Sabah okuması [hata]");
  await page.clock.setFixedTime(dayAt("07:00"));
  await page.goto("/");
  await expect(card(page).getByRole("heading", { name: "Günaydın" })).toBeVisible();
  await expect(welcome(page)).toBeHidden();
});
