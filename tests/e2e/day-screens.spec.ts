import type { Page } from "@playwright/test";
import { insert, rows, seedModule, update, waitFor } from "./data";
import { expect, test } from "./fixtures";

// The day's frame on the screens (Ç3c; docs/05-arayuz.md, "Günün çerçevesi"): "Günaydın" and
// "Uyandım", the evening's card with tonight's bed and tomorrow's waking, the one-day changes,
// "Yatıyorum", the top bar, the strip's parts, "Onayla ve yat", Hafta's line. The frame is off
// in the test account; these tests switch it on. Hours are YESTERDAY's (see timing.spec.ts).

const ISTANBUL = "Europe/Istanbul";
const istanbulDay = (days = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ISTANBUL }).format(
    new Date(Date.now() + days * 86_400_000),
  );
const DAY = istanbulDay(-1);
const dayAt = (time: string, day = DAY) => new Date(`${day}T${time}:00+03:00`);
const FRAME = { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 };

/** The frame on, with an ordinary day (08:00–19:00) instead of the test account's whole day. */
async function frameOn(frame: Record<string, unknown> = FRAME) {
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, {
    day_frame: frame,
    day_start_default: "08:00",
    finish_line_default: "19:00",
  });
}

const card = (page: Page) => page.getByRole("region", { name: "Şimdi" });
const dayRow = async (date = DAY) => (await rows("days")).find((row) => row.date === date);

test("Günaydın: 'Uyandım' records the waking (not estimated), then the morning's routine is offered", async ({
  page,
}) => {
  await frameOn();
  const mod = await seedModule();
  const [routine] = await insert("tasks", {
    module_id: mod.id,
    title: "Sabah esnemesi",
    est_minutes: 15,
    timing: { anchor: "wake" },
  });
  await page.clock.setFixedTime(dayAt("07:30"));
  await page.goto("/");
  await expect(card(page).getByRole("heading", { name: "Günaydın" })).toBeVisible();
  await expect(card(page)).toContainText("Önce: Sabah esnemesi");
  await expect(page.getByTestId("wake-line")).toHaveText("beklenen uyanış 09:00");
  await expect(page.getByTestId("bed-range")).toHaveText("yatış 22:00–01:00");

  await card(page).getByRole("button", { name: "Uyandım" }).click();
  await expect(card(page).getByRole("heading", { name: "Sabah esnemesi" })).toBeVisible();
  const day = await waitFor(
    () => dayRow(),
    (row) => row?.woke_at != null,
  );
  expect(day?.woke_estimated).toBe(false);
  await expect(page.getByTestId("wake-line")).toHaveText("uyanış 07:30");
  // The strip shows the morning's part before the working window.
  await expect(page.getByTestId("strip-part-wake")).toHaveCount(1);
  const started = await waitFor(
    () => rows("events"),
    (list) => list.some((row) => row.type === "core.day_started"),
  );
  expect(started.find((row) => row.type === "core.day_started")?.payload).toMatchObject({
    estimated: false,
  });
  expect(routine.id).toBeTruthy();
});

test("'Biraz önce' takes the waking back by the chosen minutes; with the setting on, the routine starts", async ({
  page,
}) => {
  await frameOn({ ...FRAME, start_on_wake: true });
  const mod = await seedModule();
  const [routine] = await insert("tasks", {
    module_id: mod.id,
    title: "Sabah esnemesi",
    est_minutes: 15,
    timing: { anchor: "wake" },
  });
  await page.clock.setFixedTime(dayAt("07:40"));
  await page.goto("/");
  await card(page).getByRole("button", { name: "Biraz önce" }).click();
  await card(page).getByRole("button", { name: "30 dk önce" }).click();
  const day = await waitFor(
    () => dayRow(),
    (row) => row?.woke_at != null,
  );
  expect(Date.parse(day!.woke_at as string)).toBe(dayAt("07:10").getTime());
  const [session] = await waitFor(
    () => rows("sessions"),
    (list) => list.length === 1,
  );
  expect(session.task_id).toBe(routine.id);
});

test("the evening: tonight's bed, tomorrow's waking and the sleep; one-day changes; Yatıyorum to night", async ({
  page,
}) => {
  await frameOn();
  await insert("days", { date: DAY, woke_at: dayAt("07:00").toISOString() });
  await page.clock.setFixedTime(dayAt("20:00"));
  await page.goto("/");
  const evening = card(page);
  await expect(evening.getByRole("heading", { name: "Akşam" })).toBeVisible();
  await expect(page.getByTestId("sleep-line")).toHaveText(
    "Bu gece yatış 01:00 · yarın uyanış 09:00 · uyku 8 sa",
  );
  // The evening is calm: no list, no warnings.
  await expect(page.getByRole("region", { name: "Uyarılar" })).toHaveCount(0);

  // "Yarın erken kalkacağım" moves tomorrow only (its own row), and bed with it.
  await evening.getByRole("button", { name: "Yarın erken kalkacağım" }).click();
  await evening.getByRole("button", { name: "60 dk" }).click();
  await expect(page.getByTestId("sleep-line")).toHaveText(
    "Bu gece yatış 00:00 · yarın uyanış 08:00 · uyku 8 sa",
  );
  expect((await dayRow(istanbulDay(0)))?.expected_wake).toBe("08:00:00");
  expect((await dayRow())?.expected_wake).toBeNull();

  // "Bu gece geç yatacağım": tonight's bed later; the morning cannot follow past 09:00.
  await evening.getByRole("button", { name: "Bu gece geç yatacağım" }).click();
  await evening.getByRole("button", { name: "90 dk" }).click();
  await expect(page.getByTestId("sleep-line")).toHaveText(
    "Bu gece yatış 01:30 · yarın uyanış 08:00 · uyku 6 sa 30 dk",
  );
  await expect(evening.getByRole("note")).toHaveText("Erken kalkışla bu gece uyku 6 sa 30 dk.");

  await evening.getByRole("button", { name: "Yatıyorum" }).click();
  await expect(evening).toContainText("Yarın uyanış 08:00");
  const day = await waitFor(
    () => dayRow(),
    (row) => row?.bed_at != null,
  );
  expect(Date.parse(day!.bed_at as string)).toBe(dayAt("20:00").getTime());
  await waitFor(
    () => rows("events"),
    (list) => list.some((row) => row.type === "core.day_closed"),
  );
});

test("work that may go after the finish line is the evening's; Onayla ve yat closes the day and records bed", async ({
  page,
}) => {
  await frameOn();
  await insert("days", { date: DAY, woke_at: dayAt("07:00").toISOString() });
  const mod = await seedModule();
  await insert("tasks", {
    module_id: mod.id,
    title: "Akşam yürüyüşü",
    est_minutes: 45,
    energy: "physical",
    timing: { windows: [{ from: "20:00", to: "22:00" }], after_finish: true },
  });
  await page.clock.setFixedTime(dayAt("19:30"));
  await page.goto("/");
  await expect(card(page).getByRole("heading", { name: "Akşam yürüyüşü" })).toBeVisible();
  await expect(card(page).getByRole("button", { name: "Başla" })).toBeVisible();

  await page.goto("/kapanis");
  for (let step = 0; step < 4; step++) {
    await page.getByRole("button", { name: "İleri" }).click();
  }
  await page.getByRole("button", { name: "Onayla ve yat" }).click();
  await page.waitForURL("/");
  const day = await waitFor(
    () => dayRow(),
    (row) => row?.bed_at != null && row?.closed_at != null,
  );
  expect(day?.closed_at).not.toBeNull();
  await expect(card(page)).toContainText("Yarın uyanış");
});

test("Hafta: one line of the last week's waking, bedtime and sleep", async ({ page }) => {
  await frameOn();
  const before = istanbulDay(-2);
  await insert("days", [
    {
      date: before,
      woke_at: dayAt("07:00", before).toISOString(),
      bed_at: dayAt("23:00", before).toISOString(),
    },
    { date: DAY, woke_at: dayAt("07:00").toISOString() },
  ]);
  await page.clock.setFixedTime(dayAt("12:00"));
  await page.goto("/hafta");
  await expect(page.getByTestId("sleep-summary")).toHaveText(
    "Son 7 gün ortalaması: uyanış 07:00 · yatış 23:00 · uyku 8 sa",
  );
});
