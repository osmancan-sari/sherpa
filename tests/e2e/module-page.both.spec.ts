import type { Page } from "@playwright/test";
import { insert, rows, waitFor } from "./data";
import { expect, test } from "./fixtures";

// A module's interface works on both layouts: run once at second-screen width ("pano") and once
// at phone width ("telefon") (docs/06-modul-sozlesmesi.md, "Modül arayüzü", rules).

async function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test("the module page, its tabs, sub page, full-screen view and settings fit the screen", async ({
  page,
  viewport,
}) => {
  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Deneme: etkinleştir" }).click();
  await expect(page.getByRole("link", { name: "Deneme ayarları" })).toBeVisible();
  expect(await sidewaysOverflow(page)).toBe(0);
  await insert("deneme_items", [
    { title: "Uzun adlı bir kayıt: dönem sonu raporunun ilk taslağı", due_on: "2031-01-15" },
    { title: "Kısa kayıt", minutes: 30 },
  ]);

  // The page: five regions under each other, quick actions within reach.
  await page.goto("/m/deneme");
  await expect(page.getByRole("heading", { level: 1, name: "Deneme" })).toBeVisible();
  const table = page.getByRole("table", { name: "Deneme kayıtları" });
  await expect(table.getByRole("row")).toHaveCount(3);
  expect(await sidewaysOverflow(page)).toBe(0);
  const actions = page.getByRole("toolbar", { name: "Hızlı eylemler" });
  for (const button of await actions.getByRole("button").all()) {
    const box = (await button.boundingBox())!;
    if (viewport!.width < 768) expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width);
  }

  // The component kit tab.
  const tabs = page.getByRole("navigation", { name: "Sekmeler" });
  await tabs.getByRole("link", { name: "Bileşenler" }).click();
  await expect(page).toHaveURL(/\/m\/deneme\/bilesenler$/);
  await expect(page.getByRole("list", { name: "Tarihli kayıtlar" })).toBeVisible();
  expect(await sidewaysOverflow(page)).toBe(0);

  // A quick action that writes: the record appears without a reload.
  await tabs.getByRole("link", { name: "Kayıtlar" }).click();
  // The page that is being left stays in the document for a moment (hidden afterwards); wait
  // for the new one before touching anything on it.
  await expect(page).toHaveURL(/\/m\/deneme$/);
  await expect(tabs.getByRole("link", { name: "Kayıtlar" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await actions.getByRole("button", { name: "Örnek kayıt" }).click();
  await expect(table.getByRole("row")).toHaveCount(4);
  const items = await waitFor(
    () => rows("deneme_items"),
    (list) => list.length === 3,
  );

  // Sub page.
  await page.goto(`/m/deneme/kayit/${items[0].id}`);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(items[0].title as string);
  expect(await sidewaysOverflow(page)).toBe(0);

  // Full-screen view: no shell on either layout, and a way back.
  await page.goto("/m/deneme/tam/odak");
  await expect(page.getByRole("timer", { name: "Odak süresi" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Ana gezinme" })).toHaveCount(0);
  expect(await sidewaysOverflow(page)).toBe(0);
  await page.getByRole("link", { name: "Kapat" }).click();
  await expect(page).toHaveURL(/\/m\/deneme$/);

  // The module's settings and the fixed blocks screen.
  await page.goto("/ayarlar/moduller/deneme");
  await expect(page.getByRole("heading", { level: 1, name: "Deneme ayarları" })).toBeVisible();
  expect(await sidewaysOverflow(page)).toBe(0);
  await page.goto("/ayarlar/bloklar");
  await expect(page.getByRole("form", { name: "Yeni seri" })).toBeVisible();
  expect(await sidewaysOverflow(page)).toBe(0);
});

test("work is edited by hand on both layouts", async ({ page, viewport }) => {
  const [mod] = await insert("modules", { slug: "okul-ornek", name: "Okul", color: "#2563eb" });
  await insert("tasks", { module_id: mod.id, title: "Düzenlenecek iş" });
  await page.goto("/m/okul-ornek");
  await page.getByRole("button", { name: "Düzenle: Düzenlenecek iş" }).click();

  const dialog = page.getByRole("dialog", { name: "İşi düzenle" });
  await expect(dialog).toBeVisible();
  // The whole form is on the screen: a sheet from the bottom on the phone, centred otherwise.
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height);
  expect(await sidewaysOverflow(page)).toBe(0);
  for (const button of await dialog.getByRole("button").all()) {
    const size = (await button.boundingBox())!;
    if (viewport!.width < 768) expect(size.height).toBeGreaterThanOrEqual(44);
  }

  await dialog.getByLabel("Ad", { exact: true }).fill("Düzenlenmiş iş");
  await dialog.getByLabel("Süre (dk)").fill("20");
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("region", { name: "Yaklaşanlar" })).toContainText("Düzenlenmiş iş");
  const [task] = await waitFor(
    () => rows("tasks"),
    (list) => list[0].title === "Düzenlenmiş iş",
  );
  expect(task.est_minutes).toBe(20);

  // A rhythm by hand, from the same page.
  await page.getByRole("button", { name: "Ritim ekle" }).click();
  const rhythm = page.getByRole("dialog", { name: "Yeni ritim" });
  await rhythm.getByLabel("Ad", { exact: true }).fill("Yürüyüş");
  await rhythm.getByRole("button", { name: "Ekle" }).click();
  await expect(rhythm).toBeHidden();
  await expect(page.getByRole("region", { name: "Yaklaşanlar" })).toContainText("0/1");
});
