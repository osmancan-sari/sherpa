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
