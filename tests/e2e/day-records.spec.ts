import type { Page } from "@playwright/test";
import { insert, rows, update, waitFor } from "./data";
import { expect, test } from "./fixtures";

// Ç3g (docs/05-arayuz.md, "Günün çerçevesi"): "Yatıyorum" far before the bedtime range asks once;
// in it and near it one tap as before. A waking or bedtime written by mistake is set right or
// deleted in Ayarlar → "Uyanış ve yatış kayıtları", also after the scene's 10 minutes.
// Hours are yesterday's (the browser's clock is never ahead of the database's).

const ISTANBUL = "Europe/Istanbul";
const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: ISTANBUL }).format(
  new Date(Date.now() - 86_400_000),
);
const dayAt = (time: string) => new Date(`${DAY}T${time}:00+03:00`);
const card = (page: Page) => page.getByRole("region", { name: "Şimdi" });
const today = async () => (await rows("days")).find((row) => row.date === DAY);

async function setUp() {
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
    day_start_default: "08:00",
    finish_line_default: "19:00",
  });
  await insert("days", { date: DAY, woke_at: dayAt("07:00").toISOString() });
}

test("Yatıyorum more than two hours before the bedtime range asks; Vazgeç keeps the day open", async ({
  page,
}) => {
  await setUp();
  await page.clock.setFixedTime(dayAt("19:30"));
  await page.goto("/");
  await card(page).getByRole("button", { name: "Yatıyorum" }).click();
  const ask = page.getByRole("dialog", { name: "Saat 19:30. Şimdi yatıyor musun?" });
  await expect(ask).toContainText("Yatış aralığının başı: 22:00.");
  await ask.getByRole("button", { name: "Vazgeç" }).click();
  await expect(ask).toBeHidden();
  await page.waitForTimeout(300);
  expect((await today())?.bed_at).toBeNull();

  await card(page).getByRole("button", { name: "Yatıyorum" }).click();
  await page.getByRole("button", { name: "Evet, yatıyorum" }).click();
  await waitFor(today, (row) => Boolean(row?.bed_at));
});

test("in the range and near it Yatıyorum is one tap", async ({ page }) => {
  await setUp();
  await page.clock.setFixedTime(dayAt("21:00"));
  await page.goto("/");
  await card(page).getByRole("button", { name: "Yatıyorum" }).click();
  await waitFor(today, (row) => Boolean(row?.bed_at));
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a wrong bedtime and waking are set right or deleted in Ayarlar; the night card leads there", async ({
  page,
}) => {
  await setUp();
  const row = await today();
  await update("days", row!.id as string, { bed_at: dayAt("16:49").toISOString() });
  await page.clock.setFixedTime(dayAt("20:00"));
  await page.goto("/");
  await card(page).getByRole("link", { name: "Yatışı düzelt" }).click();
  await expect(page).toHaveURL(/\/ayarlar#kayitlar$/);
  const records = page.getByTestId("day-records");
  const day = records.getByRole("region", { name: /^Bugün/ });
  await expect(day.getByLabel("Yatış saati")).toHaveValue("16:49");
  await day.getByLabel("Yatış saati").fill("2310");
  await day.getByRole("button", { name: "Kaydet" }).nth(1).click();
  await waitFor(
    today,
    (value) =>
      value?.bed_at !== null && Date.parse(value!.bed_at as string) === dayAt("23:10").getTime(),
  );
  // Deleted: the day is open again.
  await day.getByRole("button", { name: "Yatışı sil" }).click();
  await waitFor(today, (value) => value?.bed_at === null);
  await day.getByRole("button", { name: "Uyanışı sil" }).click();
  await waitFor(today, (value) => value?.woke_at === null && value?.woke_source === null);
  await page.goto("/");
  await expect(card(page).getByRole("heading", { name: "Akşam", exact: true })).toBeVisible();
});

test("a scene's Yatıyorum far before bed asks too: Vazgeç keeps the work running, Evet records it", async ({
  page,
}) => {
  await setUp();
  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Deneme: etkinleştir" }).click();
  await waitFor(
    () => rows("modules"),
    (list) => list.length === 1,
  );
  const [mod] = await rows("modules");
  const [task] = await insert<{ id: string }>("tasks", {
    module_id: mod.id,
    title: "Gece notu",
    est_minutes: 20,
    facet: "aksam",
  });
  await insert("sessions", { task_id: task.id, module_id: mod.id });
  await page.clock.setFixedTime(dayAt("19:30"));
  await page.goto("/");
  const scene = page.getByTestId("deneme-gece");
  await scene.getByRole("button", { name: "Yatıyorum" }).click();
  const ask = page.getByRole("dialog", { name: "Saat 19:30. Şimdi yatıyor musun?" });
  await ask.getByRole("button", { name: "Vazgeç" }).click();
  await expect(ask).toBeHidden();
  await expect(scene).toBeVisible();
  await page.waitForTimeout(300);
  expect((await today())?.bed_at).toBeNull();
  expect((await rows("sessions")).filter((row) => row.ended_at === null)).toHaveLength(1);

  await scene.getByRole("button", { name: "Yatıyorum" }).click();
  await page.getByRole("button", { name: "Evet, yatıyorum" }).click();
  await expect(page.getByTestId("deneme-gece-bed")).toBeVisible();
  await waitFor(today, (row) => Boolean(row?.bed_at && row.bed_session_id));
});

test("Rutin's last step: Vazgeç on the question puts the evening back on its last step", async ({
  page,
}) => {
  await setUp();
  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Rutin: etkinleştir" }).click();
  const rhythms = await waitFor(
    () => rows("rhythms"),
    (list) => list.length === 3,
  );
  const evening = rhythms.find((row) => row.key === "rutin:aksam")!;
  const [mod] = await rows("modules");
  await insert("sessions", { rhythm_id: evening.id, module_id: mod.id });
  await page.clock.setFixedTime(dayAt("19:30"));
  await page.goto("/");
  const scene = page.getByTestId("rutin-scene");
  await expect(scene).toHaveAttribute("data-routine", "aksam");
  const routine = (await rows("rutin_routines")).find((row) => row.key === "aksam")!;
  const run = await waitFor(
    async () => (await rows("rutin_runs")).find((row) => row.routine_id === routine.id),
    (row) => Boolean(row),
  );
  await update("rutin_runs", run!.id as string, { step_position: 3, part_position: 1 });
  await page.reload();
  await scene.getByRole("button", { name: "Yatıyorum" }).click();
  await page
    .getByRole("dialog", { name: "Saat 19:30. Şimdi yatıyor musun?" })
    .getByRole("button", { name: "Vazgeç" })
    .click();
  await expect(scene.getByRole("heading", { name: "Telefonu salona bırak" })).toBeVisible();
  await waitFor(
    async () => (await rows("rutin_runs")).find((row) => row.id === run!.id),
    (row) => row?.step_position === 3,
  );
  expect((await today())?.bed_at).toBeNull();
  expect((await rows("sessions")).filter((row) => row.ended_at === null)).toHaveLength(1);
});

test("yesterday's records are set right too, and the modules hear it", async ({ page }) => {
  await setUp();
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: ISTANBUL }).format(
    new Date(Date.now() - 2 * 86_400_000),
  );
  const row = await today();
  await update("days", row!.id as string, { bed_at: dayAt("21:30").toISOString() });
  await page.clock.setFixedTime(dayAt("22:00"));
  await page.goto("/ayarlar#kayitlar");
  const before = page.getByTestId("day-records").getByRole("region", { name: /^Dün/ });
  await before.getByLabel("Uyanış saati").fill("0715");
  await before.getByRole("button", { name: "Kaydet" }).first().click();
  await before.getByLabel("Yatış saati").fill("0030");
  await before.getByRole("button", { name: "Kaydet" }).nth(1).click();
  await waitFor(
    async () => (await rows("days")).find((value) => value.date === yesterday),
    (value) =>
      Date.parse(value?.woke_at as string) === new Date(`${yesterday}T07:15:00+03:00`).getTime() &&
      // 00:30 is that night's: past midnight, on the next calendar day.
      Date.parse(value?.bed_at as string) === new Date(`${DAY}T00:30:00+03:00`).getTime() &&
      value?.woke_source === "screen",
  );
  // Today's bedtime deleted: the day is open again, and the modules are told.
  const day = page.getByTestId("day-records").getByRole("region", { name: /^Bugün/ });
  await day.getByRole("button", { name: "Yatışı sil" }).click();
  await waitFor(today, (value) => value?.bed_at === null);
  const events = await waitFor(
    () => rows("events"),
    (list) =>
      list.some((event) => event.type === "core.bed_undone") &&
      list.some(
        (event) =>
          event.type === "core.day_started" &&
          (event.payload as { date?: string; source?: string }).date === yesterday,
      ),
  );
  const started = events.find((event) => event.type === "core.day_started")!;
  expect(started.payload).toMatchObject({ date: yesterday, source: "screen", estimated: false });
  expect(events.some((event) => event.type === "core.day_closed")).toBe(true);
});
