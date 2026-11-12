import type { Page } from "@playwright/test";
import { insert, rows, seedModule, waitFor } from "./data";
import { expect, test } from "./fixtures";

// Time constraints end to end (Ç3b; docs/07-yol-haritasi.md, "Ç3b" acceptance criteria). The
// account's day runs from midnight to 23:59 (tests/e2e/data.ts). Tests that need a given hour
// fix the browser's clock to that hour of YESTERDAY: always in the past, so the session's token
// never looks expired (a clock ahead of the real one makes the app refresh it endlessly), and
// the run does not depend on the hour it starts at.

const ISTANBUL = "Europe/Istanbul";
/** A calendar day in Istanbul, `days` from today. */
const istanbulDay = (days = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ISTANBUL }).format(
    new Date(Date.now() + days * 86_400_000),
  );
/** An instant of yesterday, the day these tests are set on (Istanbul is UTC+3, no daylight saving). */
const dayAt = (time: string) => new Date(`${istanbulDay(-1)}T${time}:00+03:00`);
/** ISO weekday of that day: 1 = Monday … 7 = Sunday. */
function weekdayOfDay(): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: ISTANBUL, weekday: "short" }).format(
    dayAt("12:00"),
  );
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(name) + 1;
}

const nowCard = (page: Page) => page.getByRole("region", { name: "Şimdi" });

test("the Zaman section saves what it should, refuses what it should, and sums it up", async ({
  page,
}) => {
  const mod = await seedModule();
  const [task] = await insert("tasks", { module_id: mod.id, title: "Salon" });
  await page.goto(`/m/${mod.slug}`);
  await page.getByRole("button", { name: "Düzenle: Salon" }).click();
  let dialog = page.getByRole("dialog", { name: "İşi düzenle" });
  await dialog.getByText("Zaman", { exact: true }).click();

  // A window the wrong way round is not saved, and says why.
  await dialog.getByRole("button", { name: "Yalnızca şu saatlerde: aralık ekle" }).click();
  await dialog.getByLabel("Yalnızca şu saatlerde 1: başlangıç").fill("18:00");
  await dialog.getByLabel("Yalnızca şu saatlerde 1: bitiş").fill("16:00");
  await expect(dialog.getByRole("alert")).toHaveText("Bitiş saati başlangıçtan sonra olmalı.");
  await expect(dialog.getByRole("button", { name: "Kaydet" })).toBeDisabled();

  await dialog.getByLabel("Yalnızca şu saatlerde 1: başlangıç").fill("16:00");
  await dialog.getByLabel("Yalnızca şu saatlerde 1: bitiş").fill("18:00");
  await dialog.getByRole("button", { name: "Kaçınılan saatler: aralık ekle" }).click();
  await dialog.getByLabel("Kaçınılan saatler 1: günler").selectOption({ label: "Hafta içi" });
  await dialog.getByLabel("Kaçınılan saatler 1: başlangıç").fill("18:00");
  await dialog.getByLabel("Kaçınılan saatler 1: bitiş").fill("20:30");
  await dialog.getByLabel("Yol: gidiş (dk)").fill("20");
  await dialog.getByLabel("Yol: dönüş (dk)").fill("20");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog).toBeHidden();

  const [saved] = await waitFor(
    () => rows("tasks"),
    (list) => list[0]?.timing !== null,
  );
  expect(saved.id).toBe(task.id);
  expect(saved.timing).toEqual({
    windows: [{ from: "16:00", to: "18:00" }],
    avoid: [{ days: [1, 2, 3, 4, 5], from: "18:00", to: "20:30" }],
    travel: { before: 20, after: 20 },
  });

  // Closed, the section sums the constraint up in one line.
  await page.getByRole("button", { name: "Düzenle: Salon" }).click();
  dialog = page.getByRole("dialog", { name: "İşi düzenle" });
  await expect(dialog.getByTestId("timing-summary")).toHaveText(
    "· 16:00–18:00 · kaçın: hafta içi 18:00–20:30 · yol 20+20 dk",
  );
});

test("a rhythm's rest days must fit its target; the ones that fit are saved", async ({ page }) => {
  const mod = await seedModule();
  await insert("rhythms", {
    module_id: mod.id,
    title: "Koşu",
    target_count: 3,
    period: "week",
    est_minutes: 30,
  });
  await page.goto(`/m/${mod.slug}`);
  await page.getByRole("button", { name: "Düzenle: Koşu" }).click();
  const dialog = page.getByRole("dialog", { name: "Ritmi düzenle" });
  await dialog.getByText("Zaman", { exact: true }).click();
  // Three times a week with three days between needs ten days.
  await dialog.getByLabel("Dinlenme (gün)").fill("3");
  await expect(dialog.getByRole("alert")).toHaveText(
    "Bu kadar dinlenme günüyle hedef döneme sığmıyor.",
  );
  await expect(dialog.getByRole("button", { name: "Kaydet" })).toBeDisabled();
  // With a target of two it fits.
  await dialog.getByLabel("Hedef").fill("2");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog).toBeHidden();
  const [saved] = await waitFor(
    () => rows("rhythms"),
    (all) => all[0]?.timing !== null,
  );
  expect(saved).toMatchObject({ target_count: 2, timing: { rest_days: 3 } });
  expect(saved.provenance).toMatchObject({ "timing.rest_days": "user", target_count: "user" });
});

test("work with a 16:00–18:00 window is not put in the morning; when its time comes it is offered, and it can be started by hand before", async ({
  page,
}) => {
  const mod = await seedModule();
  await insert("tasks", {
    module_id: mod.id,
    title: "Salon",
    est_minutes: 60,
    timing: { windows: [{ from: "16:00", to: "18:00" }] },
  });
  await page.clock.setFixedTime(dayAt("09:00"));
  await page.goto("/");
  const card = nowCard(page);
  await expect(card.getByRole("heading")).toHaveText("Salon");
  // Planned inside its window, said on the card: "Başlangıç 16:00" or later.
  await expect(card.getByTestId("suggest-at")).toHaveText(/^Başlangıç 1[67]:\d\d$/);

  await page.clock.setFixedTime(dayAt("16:00"));
  await page.reload();
  await expect(card.getByRole("heading")).toHaveText("Salon");
  await expect(card.getByTestId("suggest-at")).toHaveCount(0);

  // The window binds the planner, not the user: at nine it can still be started by hand.
  await page.clock.setFixedTime(dayAt("09:00"));
  await page.reload();
  await card.getByRole("button", { name: "Başla" }).click();
  await waitFor(
    () => rows("sessions"),
    (list) => list.length === 1,
  );
  await expect(card).toContainText("geçti");
});

test("60 minutes with 20 + 20 travel: the travel is drawn on its own, the session measures the work", async ({
  page,
}) => {
  const mod = await seedModule();
  await insert("tasks", {
    module_id: mod.id,
    title: "Salon",
    est_minutes: 60,
    context: "out",
    energy: "physical",
    timing: { travel: { before: 20, after: 20 } },
  });
  // A fixed hour: late in the evening a 100-minute footprint would not fit before 23:59.
  await page.clock.setFixedTime(dayAt("10:00"));
  await page.goto("/");
  const card = nowCard(page);
  // Work elsewhere is offered on the second screen too, with its travel.
  await expect(card.getByRole("heading")).toHaveText("Salon");
  await expect(card).toContainText("yol 20+20 dk");
  const strip = page.getByRole("region", { name: "Günün şeridi" });
  await expect(strip.getByTestId("strip-travel")).toHaveCount(2);
  await expect(strip.getByLabel("yol 20 dk")).toHaveCount(2);

  await card.getByRole("button", { name: "Başla" }).click();
  const [session] = await waitFor(
    () => rows("sessions"),
    (list) => list.length === 1,
  );
  // The session is the work's: it starts when Başla is pressed, travel is not part of it.
  // The database stamps it with its own (real) clock.
  expect(Date.now() - Date.parse(session.started_at as string)).toBeLessThan(60_000);
  await card.getByRole("button", { name: "Bitti" }).click();
  await waitFor(
    () => rows("sessions"),
    (list) => list[0]?.ended_at !== null,
  );
});

test("on the phone, in the work's own context, its travel is not counted", async ({ page }) => {
  const mod = await seedModule();
  await insert("tasks", {
    module_id: mod.id,
    title: "Salon",
    est_minutes: 60,
    context: "out",
    energy: "physical",
    timing: { travel: { before: 20, after: 20 } },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(dayAt("10:00"));
  await page.goto("/");
  const card = nowCard(page);
  await expect(card).toContainText("yol 20+20 dk");
  await page.getByLabel("Bağlam").selectOption({ label: "Dışarıda" });
  await expect(card.getByRole("heading")).toHaveText("Salon");
  await expect(card).not.toContainText("yol");
});

test("a rhythm with a rest day is not offered the day after it was done", async ({ page }) => {
  const mod = await seedModule();
  const [gym] = await insert("rhythms", {
    module_id: mod.id,
    title: "Ağırlık",
    target_count: 3,
    period: "week",
    est_minutes: 30,
    timing: { rest_days: 1 },
  });
  await insert("tasks", { module_id: mod.id, title: "Okuma" });
  await insert("rhythm_logs", { rhythm_id: gym.id, done_on: istanbulDay(-1) });
  await page.goto("/");
  await expect(nowCard(page).getByRole("heading")).toHaveText("Okuma");
  await expect(page.getByRole("main")).not.toContainText("Ağırlık");
});

test("work due today whose window is gone stays out and says so; the week says when it has no time", async ({
  page,
}) => {
  const mod = await seedModule();
  await insert("tasks", {
    module_id: mod.id,
    title: "Banka",
    due_at: dayAt("23:00").toISOString(),
    timing: { windows: [{ from: "09:00", to: "12:00" }] },
  });
  // Due today, its only window is on today's weekday and already gone.
  await insert("work_items", {
    module_id: mod.id,
    title: "Belediye başvurusu",
    effort_total_minutes: 45,
    due_at: dayAt("23:00").toISOString(),
    timing: { windows: [{ days: [weekdayOfDay()], from: "09:00", to: "12:00" }] },
  });
  await insert("tasks", { module_id: mod.id, title: "Okuma" });
  await page.clock.setFixedTime(dayAt("14:00"));
  await page.goto("/");
  await expect(nowCard(page).getByRole("heading")).toHaveText("Okuma");
  await expect(page.getByRole("region", { name: "Uyarılar" })).toContainText(
    "Bugün uygun saat kalmadı: Banka.",
  );
  await expect(page.getByRole("region", { name: "Günün şeridi" })).not.toContainText("Banka");

  await page.goto("/hafta");
  await expect(page.getByRole("region", { name: "Uygun saat" })).toContainText(
    "Bu hafta uygun saat yok: Belediye başvurusu.",
  );
});

test("the deneme module's workout carries every time constraint into its rhythm", async ({
  page,
}) => {
  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Deneme: etkinleştir" }).click();
  await expect(page.getByRole("link", { name: "Deneme ayarları" })).toBeVisible();
  await page.goto("/m/deneme");
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Yeni giriş" });
  await dialog.getByLabel("Giriş").fill("Salon antrenmanı");
  await page.keyboard.press("Tab");
  await dialog
    .getByRole("group", { name: "Kayıt türü" })
    .getByRole("button", { name: "Kayıt" })
    .click();
  await dialog.getByLabel("Tür", { exact: true }).selectOption({ label: "Antrenman" });
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog).toBeHidden();
  const [rhythm] = await waitFor(
    () => rows("rhythms"),
    (list) => list.length === 1,
  );
  expect(rhythm).toMatchObject({ title: "Salon antrenmanı", target_count: 3, floor_count: 1 });
  expect(rhythm.timing).toEqual({
    windows: [{ from: "07:00", to: "22:00" }],
    prefer: [{ days: [6, 7], from: "10:00", to: "12:00" }],
    avoid: [{ days: [1, 2, 3, 4, 5], from: "18:00", to: "20:30" }],
    travel: { before: 20, after: 20 },
    rest_days: 1,
  });
  expect(rhythm.provenance).toMatchObject({
    "timing.windows": "module",
    "timing.rest_days": "module",
  });
});
