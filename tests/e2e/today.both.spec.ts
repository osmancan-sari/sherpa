import type { Page } from "@playwright/test";
import { insert, seedModule } from "./data";
import { expect, test } from "./fixtures";

// The Today screen with real-looking data, at second-screen width ("pano") and at phone width
// ("telefon"): long titles are cut, the page never grows wider than the screen.

const LONG = "YZV406E HW2: lokalizasyon soruları ve ek okuma listesinin tamamı";

// A fixed hour: yesterday at 10:00 in Istanbul (in the past, so the session never looks
// expired). With the real clock the test failed after 21:00, when the block two hours on left
// too little of the test account's day (it ends at 23:59) for three pieces of work.
const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
  new Date(Date.now() - 86_400_000),
);
const NOW = new Date(`${yesterday}T10:00:00+03:00`).getTime();

async function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function expectInsideScreen(page: Page, name: string, width: number) {
  const box = (await page.getByRole("region", { name }).boundingBox())!;
  expect(box.x, name).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, name).toBeLessThanOrEqual(width);
}

test("long titles do not push the Today screen wider than the screen", async ({
  page,
  viewport,
}) => {
  await page.clock.setFixedTime(NOW);
  const okul = await seedModule("okul-ornek", "Okul");
  const ev = await seedModule("ev-ornek", "Ev ve hayat idaresinin uzun adı", "#16a34a");
  await insert("tasks", [
    { module_id: okul.id, title: LONG, due_at: new Date(NOW + 3_600_000).toISOString() },
    { module_id: okul.id, title: `${LONG} (ikinci bölüm)` },
    { module_id: ev.id, title: "Kısa iş" },
  ]);
  await insert("work_items", {
    module_id: okul.id,
    title: "BBF301E dönem sonu raporunun bütün bölümlerinin gözden geçirilmesi",
    effort_total_minutes: 240,
  });
  await insert("blocks", {
    title: "Sinyal işleme laboratuvarı telafi dersi",
    location: "Elektrik-Elektronik Fakültesi, B-104",
    starts_at: new Date(NOW + 2 * 3_600_000).toISOString(),
    ends_at: new Date(NOW + 3 * 3_600_000).toISOString(),
  });

  await page.goto("/");
  const now = page.getByRole("region", { name: "Şimdi" });
  await expect(now.getByRole("heading")).toHaveText(LONG);
  await expect(page.getByRole("region", { name: "Sıradakiler" }).getByRole("listitem")).toHaveCount(
    3,
  );
  expect(await sidewaysOverflow(page)).toBe(0);
  await expectInsideScreen(page, "Şimdi", viewport!.width);
  await expectInsideScreen(page, "Sıradakiler", viewport!.width);

  // The bar at the bottom of the phone stays on the bottom edge, as wide as the screen.
  const nav = (await page.getByRole("navigation", { name: "Ana gezinme" }).boundingBox())!;
  if (viewport!.width < 768) {
    expect(nav.width).toBeCloseTo(viewport!.width, 0);
    expect(nav.y + nav.height).toBeCloseTo(viewport!.height, 0);
  }

  // The same while a session runs, and with quick add open.
  await now.getByRole("button", { name: "Başla" }).click();
  await expect(now.getByRole("button", { name: "Bitti" })).toBeVisible();
  expect(await sidewaysOverflow(page)).toBe(0);
  await expectInsideScreen(page, "Şimdi", viewport!.width);

  await page.getByRole("button", { name: "Yeni giriş" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Yeni giriş" });
  await dialog.getByLabel("Giriş", { exact: true }).fill(`${LONG} cuma 45dk`);
  await dialog.getByRole("button", { name: "Okul", exact: true }).click();
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height);
  const save = (await dialog.getByRole("button", { name: "Ekle", exact: true }).boundingBox())!;
  expect(save.y + save.height).toBeLessThanOrEqual(viewport!.height);
  expect(await sidewaysOverflow(page)).toBe(0);
});
