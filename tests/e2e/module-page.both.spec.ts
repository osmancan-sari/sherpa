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
    // A small button (38 px) reaches past its edges to a 44 px touch area (docs/tasarim/parcalar.md).
    const reach = await button.evaluate((el) => {
      const after = getComputedStyle(el, "::after");
      return -(parseFloat(after.top) || 0) - (parseFloat(after.bottom) || 0);
    });
    if (viewport!.width < 768) expect(box.height + reach).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width);
  }

  // A text link standing alone ("Modül ayarları") is a 44 px touch target too.
  const settings = page.getByRole("link", { name: "Modül ayarları" });
  expect((await settings.boundingBox())!.height).toBeGreaterThanOrEqual(44);

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

// Okul çekirdek A (docs/06-modul-sozlesmesi.md, "Modül sayfası"): a module may give its page a
// home entry, a page per facet, and leave out the state line and regions 2, 4 and 5. `deneme`
// does while its setting "Sayfa: ana sayfalı" is on; the default page is the test above.
test("a module page of its own shape: home, a page per facet, no state line, picker at 375 px", async ({
  page,
  viewport,
}) => {
  const phone = viewport!.width < 768;
  if (phone) await page.setViewportSize({ width: 375, height: 812 });
  await insert("modules", {
    slug: "deneme",
    name: "Deneme",
    color: "#2563eb",
    status: "active",
    settings: { page: "home" },
  });
  // Many facets with long names: the picker and the tabs must not overflow.
  const topics = await insert("deneme_items", [
    { title: "Derin öğrenme ve sinir ağlarının temelleri", kind: "konu" },
    { title: "Robotik: hız kinematiği", kind: "konu", due_on: "2031-01-10" },
    { title: "Büyük veri sistemleri", kind: "konu" },
    { title: "Makine öğrenmesi işlemleri", kind: "konu" },
    { title: "Veri görselleştirme", kind: "konu" },
    { title: "Algoritmalar ve veri yapıları", kind: "konu" },
  ]);
  await insert("deneme_items", [
    { title: "Rapor taslağı", due_on: "2031-01-15" },
    { title: "Sabah esnemesi", facet: "sabah", kind: "aliskanlik" },
  ]);

  await page.goto("/m/deneme");
  await expect(page.getByRole("heading", { level: 1, name: "Deneme" })).toBeVisible();
  // The head: the name and the module's short line; no state, no numbers, no core "İş ekle".
  const head = page.getByRole("region", { name: "Durum" });
  await expect(head).toContainText("Sınama dönemi");
  await expect(head).not.toContainText("açık kayıt");
  await expect(page.getByRole("list", { name: "Bu hafta" })).toHaveCount(0);
  await expect(page.getByLabel("Bu hafta")).toHaveCount(0);
  await expect(head.getByRole("button", { name: "İş ekle" })).toHaveCount(0);
  // Regions 2, 4 and 5 are left out; the home is the body.
  await expect(page.getByRole("region", { name: "Yaklaşanlar" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Geçmiş ve gidişat" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Geçmiş" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Giriş ve ayarlar" })).toHaveCount(0);
  const home = page.getByTestId("deneme-home").filter({ visible: true });
  await expect(home).toContainText("Rapor taslağı");
  await expect(home).toContainText("Sabah esnemesi");
  expect(await sidewaysOverflow(page)).toBe(0);

  const nav = page.getByRole("navigation", { name: "Sekmeler" });
  await expect(nav.getByRole("link", { name: "Ana sayfa" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const robotics = topics[1].id as string;
  const roboticsKey = `konu-${robotics.slice(0, 8)}`;
  if (phone) {
    // The phone: the home as a pill, every other entry in the picker.
    const picker = nav.getByRole("button", { name: "Bölümler" });
    await expect(picker).toHaveText("Bölüm seç");
    const box = (await picker.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    await picker.click();
    const list = page.getByRole("list", { name: "Bölümler" });
    await expect(list.getByRole("link")).toHaveCount(2 + 2 + topics.length);
    await expect(list.getByRole("link", { name: /Robotik: hız kinematiği/ })).toContainText(
      "konu · 2031-01-10",
    );
    expect(await sidewaysOverflow(page)).toBe(0);
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);
    await picker.click();
    await list.getByRole("link", { name: /Robotik: hız kinematiği/ }).click();
    await expect(page).toHaveURL(new RegExp(`/m/deneme/bolum/${roboticsKey}$`));
    await expect(nav.getByRole("button", { name: "Bölümler" })).toHaveText(
      "Robotik: hız kinematiği",
    );
  } else {
    // The board: every entry a tab, the facets with their dots.
    await expect(nav.getByRole("link")).toHaveCount(1 + 2 + 2 + topics.length);
    await nav.getByRole("link", { name: "Robotik: hız kinematiği" }).click();
    await expect(page).toHaveURL(new RegExp(`/m/deneme/bolum/${roboticsKey}$`));
    await expect(nav.getByRole("link", { name: "Robotik: hız kinematiği" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
  const view = page.getByTestId("deneme-facet-view").filter({ visible: true });
  await expect(view).toHaveAttribute("data-facet", roboticsKey);
  await expect(view).toContainText("Robotik: hız kinematiği");
  expect(await sidewaysOverflow(page)).toBe(0);

  // A tab still opens at its key; a facet that is not in the list is no page.
  await page.goto("/m/deneme/bilesenler");
  await expect(page.getByRole("list", { name: "Tarihli kayıtlar" })).toBeVisible();
  await page.goto("/m/deneme/bolum/yok");
  await expect(page.getByText("Bu modülde böyle bir sayfa yok.")).toBeVisible();

  // The module's chip elsewhere is not touched: Modüller still says its state.
  await page.goto("/m");
  await expect(page.getByRole("link", { name: /Deneme/ })).toContainText("açık kayıt");
});
