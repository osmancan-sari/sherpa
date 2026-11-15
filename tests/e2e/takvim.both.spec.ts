import { insert, seedModule } from "./data";
import { expect, test } from "./fixtures";
import { runAt } from "./clock";
import { roomInTheDay } from "./helpers";

// Takvim (docs/tasarim/ekranlar/takvim.md; Ç4c), on the board ("pano") and the phone
// ("telefon"): the days to touch and their detail (today, a coming day, a day gone by), the week
// chooser, the coming weeks' bars, the week asking more than its time, a week gone by.

test("Takvim: a day's detail opens and closes; the chooser and the bars change the week", async ({
  page,
  viewport,
}) => {
  await roomInTheDay(page);
  const phone = viewport!.width < 768;
  const okul = await seedModule("okul-ornek", "Okul");
  await insert("tasks", [
    { module_id: okul.id, title: "Rapor", est_minutes: 60, due_at: runAt(3 * 60) },
    { module_id: okul.id, title: "Okuma", est_minutes: 30 },
  ]);
  // More than any week can hold, due in two weeks: that week asks more than its time.
  await insert("work_items", {
    module_id: okul.id,
    title: "Tez taslağı",
    effort_total_minutes: 120 * 60,
    due_at: runAt(14 * 24 * 60),
  });
  await page.goto("/takvim");
  await expect(page.getByRole("heading", { level: 1, name: "Takvim" })).toBeVisible();
  const label = page.getByTestId("week-label");
  const thisWeek = await label.textContent();
  const days = page.getByRole("region", { name: "Haftanın günleri" });
  const boxes = days.getByRole("button");
  await expect(boxes).toHaveCount(7);
  // It opens with no day chosen: the week's work by deadline.
  await expect(days.locator('[aria-pressed="true"]')).toHaveCount(0);
  const week = page.getByRole("region", { name: "Bu hafta" });
  await expect(week).toContainText("Rapor");
  await expect(week.getByTestId("week-load")).toContainText("vakit");

  // Today: what is next, then back to the week with the same box.
  const today = days.locator('[aria-current="date"]');
  await today.click();
  const detail = page.getByRole("region", { name: "Günün ayrıntısı" });
  await expect(detail.getByRole("heading")).toContainText("· bugün");
  await expect(detail.getByTestId("day-summary")).toContainText("iş bitti");
  await expect(detail.getByRole("region", { name: "Sıradakiler" })).toContainText("Okuma");
  await expect(detail.getByRole("link", { name: "Bugün'e git" })).toBeVisible();
  // On the phone the detail takes the week's place; on the board the week stays at its left.
  await expect(week).toHaveCount(phone ? 0 : 1);
  await today.click();
  await expect(detail).toHaveCount(0);
  await expect(week).toBeVisible();

  // Another day: a coming one tells it is a forecast; one gone by lists what was done.
  const index = await boxes.evaluateAll((list) =>
    list.findIndex((box) => box.getAttribute("aria-current") === "date"),
  );
  if (index < 6) {
    await boxes.nth(index + 1).click();
    await expect(detail).toContainText("Plan tahminidir; o sabah yeniden kurulur.");
    await expect(detail.getByTestId("day-summary")).toContainText("vakit");
    await detail.getByRole("button", { name: "Kapat" }).click();
    await expect(detail).toHaveCount(0);
  }
  if (index > 0) {
    await boxes.nth(index - 1).click();
    await expect(detail.getByTestId("day-summary")).toHaveText(/^\d+ iş · /);
    await expect(detail).not.toContainText("Plan tahminidir");
    await detail.getByRole("button", { name: "Kapat" }).click();
  }

  // The coming weeks: the one that asks too much is marked and said under the bars.
  const coming = page.getByRole("region", { name: "Önümüzdeki haftalar" });
  await expect(coming.getByRole("button")).toHaveCount(8);
  await expect(coming.getByRole("note")).toContainText("haftası:");
  // On the phone each bar is at least the touch target wide.
  if (phone) {
    const box = (await coming.getByRole("button").first().boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  // A bar goes to its week; the chooser comes back.
  await coming.getByRole("button").nth(1).click();
  await expect(label).not.toHaveText(thisWeek!);
  await expect(page.getByRole("button", { name: "Haftayı yeniden kur" })).toHaveCount(0);
  await page.getByRole("button", { name: "Önceki hafta" }).click();
  await page.getByRole("button", { name: "Önceki hafta" }).click();
  await expect(label).toHaveText(thisWeek!);
  await expect(page.getByRole("button", { name: "Haftayı yeniden kur" })).toBeVisible();

  // A week gone by holds what was done in it, not its open work.
  await page.getByRole("button", { name: "Önceki hafta" }).click();
  await expect(week.getByTestId("week-load")).toContainText("yapıldı");
  await expect(week).not.toContainText("Rapor");
});

test("Takvim: a week asking more than its time says so, and what may not make it", async ({
  page,
}) => {
  await roomInTheDay(page);
  const okul = await seedModule("okul-ornek", "Okul");
  await insert("work_items", {
    module_id: okul.id,
    title: "Büyük teslim",
    effort_total_minutes: 90 * 60,
    // Due within the week whatever its day (the run's moment is 10:00 at the latest).
    due_at: runAt(60),
  });
  await page.goto("/takvim");
  const week = page.getByRole("region", { name: "Bu hafta" });
  await expect(week).toContainText("İstenen süre bu haftanın vaktini aşıyor.");
  await expect(week).toContainText("Yetişmeyebilir: Büyük teslim");
});
