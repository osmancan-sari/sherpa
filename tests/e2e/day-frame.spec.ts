import type { Page } from "@playwright/test";
import { insert, rows, seedModule, update, waitFor } from "./data";
import { expect, test } from "./fixtures";

// The day's frame and the core's events end to end (Ç3c; docs/07-yol-haritasi.md, "Ç3c"):
// the settings, the first touch as an estimated waking, the session events each way out of a
// session. The frame is off in the test account (tests/e2e/data.ts); these tests switch it on.
// Hours are YESTERDAY's (see timing.spec.ts): a clock ahead of the real one breaks the session.

const ISTANBUL = "Europe/Istanbul";
const istanbulDay = (days = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ISTANBUL }).format(
    new Date(Date.now() + days * 86_400_000),
  );
const dayAt = (time: string) => new Date(`${istanbulDay(-1)}T${time}:00+03:00`);

const FRAME = { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 };

async function frameOn(frame: Record<string, unknown> = FRAME) {
  const [settings] = await rows("settings");
  await update("settings", settings.id as string, { day_frame: frame });
}

const nowCard = (page: Page) => page.getByRole("region", { name: "Şimdi" });

/** Taps the screen until the day's first touch is written (the keeper listens once it has data). */
async function touchUntilSeen(page: Page) {
  await expect(async () => {
    await page.getByRole("heading", { name: "Bugün", exact: true }).click();
    const days = await rows("days");
    expect(days.some((row) => row.started_at !== null)).toBe(true);
  }).toPass({ timeout: 10_000 });
}

type EventRow = { type: string; payload: Record<string, unknown> };
const events = async (type: string) =>
  ((await rows("events")) as EventRow[]).filter((row) => row.type === type);

test("Settings: the frame's ranges, sleep target and a day type's range are saved; off is off", async ({
  page,
}) => {
  await page.goto("/ayarlar");
  const form = page.getByRole("form", { name: "Günün çerçevesi" });
  // The test account starts with the frame off.
  await expect(form.getByLabel("Günün çerçevesi açık")).not.toBeChecked();
  await form.getByLabel("Günün çerçevesi açık").check();
  await form.getByLabel("Uyanış başlangıç", { exact: true }).fill("06:30");
  await form.getByLabel("Uyku hedefi (saat)").fill("7,5");
  await form.getByText("Gün tipine göre").click();
  await form.getByLabel("Ofis günü uyanış başlangıç").fill("06:00");
  await form.getByLabel("Ofis günü uyanış bitiş").fill("07:30");
  await form.getByRole("button", { name: "Kaydet" }).click();
  await waitFor(
    () => rows("settings"),
    (list) => list[0].day_frame !== null,
  );
  expect((await rows("settings"))[0].day_frame).toEqual({
    wake: ["06:30", "09:00"],
    bed: ["22:00", "01:00"],
    sleep_minutes: 450,
    by_day_type: { office: { wake: ["06:00", "07:30"] } },
  });

  // A range that ends before it starts is not saved, and says why.
  await page.reload();
  await form.getByLabel("Uyanış bitiş", { exact: true }).fill("05:00");
  await expect(form.getByRole("alert")).toContainText("Uyanış aralığı");
  await expect(form.getByRole("button", { name: "Kaydet" })).toBeDisabled();

  await page.reload();
  await form.getByLabel("Günün çerçevesi açık").uncheck();
  await form.getByRole("button", { name: "Kaydet" }).click();
  await waitFor(
    () => rows("settings"),
    (list) => list[0].day_frame === null,
  );
});

test("the first touch of a morning stands for the waking (estimated) and the day's start is published", async ({
  page,
}) => {
  await frameOn();
  await page.clock.setFixedTime(dayAt("07:30"));
  await page.goto("/");
  await expect(nowCard(page)).toBeVisible();
  await touchUntilSeen(page);
  const [day] = await waitFor(
    () => rows("days"),
    (list) => list.some((row) => row.woke_at !== null),
  );
  expect(day.woke_estimated).toBe(true);
  expect(Math.abs(Date.parse(day.woke_at as string) - dayAt("07:30").getTime())).toBeLessThan(
    60_000,
  );
  const started = await waitFor(
    () => events("core.day_started"),
    (list) => list.length === 1,
  );
  expect(started[0].payload).toMatchObject({ date: istanbulDay(-1), estimated: true });
});

test("a first touch after the morning is no waking: the day runs on its expected one", async ({
  page,
}) => {
  await frameOn();
  await page.clock.setFixedTime(dayAt("11:00"));
  await page.goto("/");
  await expect(nowCard(page)).toBeVisible();
  await touchUntilSeen(page);
  // The touch itself is written; the waking is not, even a while later (the estimate would
  // follow the touch in the same chain).
  await waitFor(
    () => rows("days"),
    (list) => list.some((row) => row.started_at !== null),
  );
  for (let look = 0; look < 6; look++) {
    expect((await rows("days")).every((row) => row.woke_at === null)).toBe(true);
    await page.waitForTimeout(250);
  }
  expect(await events("core.day_started")).toEqual([]);
});

test("each way out of a session is told to the work's module: Ertele, Takıldım, Durdur, Bitti", async ({
  page,
}) => {
  const mod = await seedModule();
  const [task] = await insert("tasks", { module_id: mod.id, title: "Rapor", est_minutes: 30 });
  await page.goto("/");
  const card = nowCard(page);
  const startAndWait = async (count: number) => {
    await card.getByRole("button", { name: "Başla" }).click();
    await waitFor(
      () => events("core.session_started"),
      (list) => list.length === count,
    );
  };

  await startAndWait(1);
  await card.getByRole("button", { name: "Ertele" }).click();
  // Ertele moved the task to tomorrow; bring it back for the next way out.
  await waitFor(
    () => events("core.session_ended"),
    (list) => list.length === 1,
  );
  await update("tasks", task.id as string, { planned_date: null });
  await page.reload();

  await startAndWait(2);
  await card.getByRole("button", { name: "Takıldım" }).click();
  await card
    .getByRole("button", { name: "Vazgeç" })
    .or(card.getByRole("button", { name: "Bugün değil" }))
    .first()
    .waitFor();
  await waitFor(
    () => events("core.session_ended"),
    (list) => list.length === 2,
  );
  await page.reload();

  await startAndWait(3);
  await card.getByRole("button", { name: "Durdur" }).click();
  await waitFor(
    () => events("core.session_ended"),
    (list) => list.length === 3,
  );

  await startAndWait(4);
  await card.getByRole("button", { name: "Bitti" }).click();
  const ended = await waitFor(
    () => events("core.session_ended"),
    (list) => list.length === 4,
  );
  expect(ended.map((row) => row.payload.result)).toEqual(["deferred", "stuck", "stopped", "done"]);
  expect(
    ended.every((row) => row.payload.module === mod.slug && row.payload.task_id === task.id),
  ).toBe(true);
});

test("the keeper keeps the sleep plan's record: tonight's bedtime and tomorrow's waking", async ({
  page,
}) => {
  await frameOn();
  await page.clock.setFixedTime(dayAt("12:00"));
  await page.goto("/");
  await expect(nowCard(page)).toBeVisible();
  // No obligations and a light day: up at the end of the range (09:00), in bed at 01:00.
  const days = await waitFor(
    () => rows("days"),
    (list) =>
      list.some((row) => row.date === istanbulDay(-1) && row.planned_bed !== null) &&
      list.some((row) => row.date === istanbulDay(0) && row.planned_wake !== null),
  );
  expect(days.find((row) => row.date === istanbulDay(-1))?.planned_bed).toBe("01:00:00");
  expect(days.find((row) => row.date === istanbulDay(0))?.planned_wake).toBe("09:00:00");
  // Written once: the same value is not written again on the next round.
  const stamp = days.find((row) => row.date === istanbulDay(0))?.updated_at;
  await page.waitForTimeout(1500);
  expect((await rows("days")).find((row) => row.date === istanbulDay(0))?.updated_at).toBe(stamp);
});
