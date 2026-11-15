import { expect, test } from "./fixtures";
import { openQuickAdd, roomInTheDay } from "./helpers";

// The signed-in shell, run once at second-screen width ("pano") and once at phone width ("telefon").

const screens = [
  { label: "Bugün", path: "/", empty: "Bugün için planlanan bir şey yok." },
  { label: "Takvim", path: "/hafta", empty: "Bu hafta için taahhüt edilen kalem yok." },
  { label: "Modüller", path: "/m", empty: "Henüz modül yok." },
  { label: "Gelen kutusu", path: "/gelen", empty: "Gelen kutusu boş." },
  { label: "Ayarlar", path: "/ayarlar", empty: null },
];

test("navigation reaches every screen", async ({ page }) => {
  // Needs room in the day and the database's day (tests/e2e/clock.ts).
  await roomInTheDay(page);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Ana gezinme" });

  for (const { label, path, empty } of screens) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    if (empty) await expect(page.getByText(empty)).toBeVisible();
  }
});

test("navigation fits the screen and nothing scrolls sideways", async ({ page, viewport }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Ana gezinme" });
  const box = (await nav.boundingBox())!;

  if (viewport!.width < 768) {
    // Phone: a glass bar near the bottom edge, the "+" circle beside it, comfortable targets
    // (docs/tasarim/ekranlar/menu.md).
    const plus = (await page.getByRole("button", { name: "Yeni giriş" }).boundingBox())!;
    expect(viewport!.height - (box.y + box.height)).toBeGreaterThanOrEqual(16);
    expect(viewport!.height - (box.y + box.height)).toBeLessThanOrEqual(30);
    expect(box.x).toBeGreaterThanOrEqual(12);
    expect(plus.x + plus.width).toBeLessThanOrEqual(viewport!.width - 12);
    expect(plus.x).toBeGreaterThan(box.x + box.width);
    for (const link of await nav.getByRole("link").all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    // The selected page is the wider pill.
    const links = await nav.getByRole("link").all();
    const widths = await Promise.all(links.map(async (link) => (await link.boundingBox())!.width));
    expect(widths[0]).toBeGreaterThan(Math.max(...widths.slice(1)));
  } else {
    // Second screen: a glass rail down the left, standing off the edges; its items are 44 px
    // (the board may be a touch screen).
    for (const link of await nav.getByRole("link").all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(box.x).toBeGreaterThanOrEqual(12);
    expect(box.x).toBeLessThanOrEqual(20);
    expect(box.height).toBeCloseTo(viewport!.height - 32, 0);
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("one colour system; the look switches of this device are kept", async ({ page }) => {
  await page.goto("/ayarlar/gorunum");
  const html = page.locator("html");
  // No theme choice: dark at every hour.
  await expect(html).not.toHaveClass(/dark|light/);
  await expect(page.getByRole("button", { name: "Koyu" })).toHaveCount(0);
  await expect(html).not.toHaveAttribute("data-transparency", "reduced");

  const transparency = page.getByRole("switch", { name: "Saydamlığı azalt" });
  await expect(transparency).not.toBeChecked();
  await transparency.click();
  await expect(html).toHaveAttribute("data-transparency", "reduced");
  await page.reload();
  // Remembered on this device, and set before the first paint.
  await expect(html).toHaveAttribute("data-transparency", "reduced");
  await expect(page.getByRole("switch", { name: "Saydamlığı azalt" })).toBeChecked();
  await page.getByRole("switch", { name: "Saydamlığı azalt" }).click();
  await expect(html).not.toHaveAttribute("data-transparency", "reduced");

  // The device's own preference turns "Hareketi azalt" on by itself.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(html).toHaveAttribute("data-motion", "reduced");
  await expect(page.getByRole("switch", { name: "Hareketi azalt" })).toBeChecked();
});

test("Settings links the design gallery", async ({ page }) => {
  await page.goto("/ayarlar");
  const link = page.getByRole("link", { name: "Tasarım galerisi" });
  // A text link standing alone is a 44 px touch target too.
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await link.click();
  await expect(page).toHaveURL(/\/tasarim$/);
  await expect(page.getByRole("heading", { name: "Tasarım" })).toBeVisible();
});

test("phone: at the end of a page its last item stands above the menu, not behind it", async ({
  page,
  viewport,
}) => {
  // The board's menu stands beside the page: nothing can pass behind it.
  if (viewport!.width >= 768) return;
  await roomInTheDay(page);
  const pages = [
    { path: "/", ready: page.getByRole("region", { name: "Şimdi" }) },
    { path: "/hafta", ready: page.getByRole("heading", { level: 1, name: "Takvim" }) },
    { path: "/m", ready: page.getByRole("link", { name: "Modülleri aç, duraklat ya da arşivle" }) },
    { path: "/gelen", ready: page.getByRole("heading", { level: 1, name: "Gelen kutusu" }) },
    { path: "/ayarlar", ready: page.getByRole("link", { name: "Tasarım galerisi" }) },
    { path: "/ayarlar/cerceve", ready: page.getByRole("form", { name: "Günün çerçevesi" }) },
    { path: "/ayarlar/bloklar", ready: page.getByRole("heading", { name: "Sabit bloklar" }) },
    { path: "/tasarim", ready: page.getByRole("region", { name: "Sahne tonları" }) },
  ];
  const menu = page.getByRole("navigation", { name: "Ana gezinme" });
  for (const { path, ready } of pages) {
    await page.goto(path);
    await expect(ready).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const top = (await menu.boundingBox())!.y;
    // The lowest thing the page draws (fixed pieces such as the menu and "+" left out).
    const bottom = await page.evaluate(() => {
      let lowest = 0;
      for (const element of document.querySelectorAll("main *")) {
        const style = getComputedStyle(element);
        if (style.position === "fixed" || style.visibility === "hidden") continue;
        if (element.closest("[role=dialog]")) continue;
        const box = element.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        lowest = Math.max(lowest, box.bottom);
      }
      return lowest;
    });
    expect(bottom, path).toBeLessThanOrEqual(top - 8);
  }
});

test("the page links the manifest and the home-screen icon", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    /manifest\.webmanifest/,
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-icon/);
  for (const name of ["mobile-web-app-capable", "apple-mobile-web-app-capable"]) {
    await expect(page.locator(`meta[name="${name}"]`)).toHaveAttribute("content", "yes");
  }
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  await expect(page).toHaveTitle("Sherpa");
});

test("forms open in the sheet: from the bottom on the phone, a 440 px panel on the board's right", async ({
  page,
  viewport,
}) => {
  await page.goto("/gelen");
  if (viewport!.width < 768) await page.getByRole("button", { name: "Yeni giriş" }).click();
  else await openQuickAdd(page);
  const sheet = page.getByRole("dialog", { name: "Yeni giriş" });
  await expect(sheet).toBeVisible();
  // Let the slide finish before measuring.
  await page.waitForTimeout(400);
  const box = (await sheet.boundingBox())!;
  if (viewport!.width < 768) {
    expect(box.x).toBeCloseTo(0, 0);
    expect(box.width).toBeCloseTo(viewport!.width, 0);
    expect(box.y + box.height).toBeCloseTo(viewport!.height, 0);
  } else {
    expect(box.width).toBeCloseTo(440, 0);
    expect(box.x + box.width).toBeCloseTo(viewport!.width, 0);
    expect(box.y).toBeCloseTo(0, 0);
    expect(box.height).toBeCloseTo(viewport!.height, 0);
  }
});

test("offline: a small pill says so at the right of the title; the screen stays", async ({
  page,
  context,
}) => {
  await page.goto("/gelen");
  await expect(page.getByRole("heading", { level: 1, name: "Gelen kutusu" })).toBeVisible();
  await expect(page.getByText("bağlantı yok")).toHaveCount(0);
  await context.setOffline(true);
  await expect(page.getByRole("status").filter({ hasText: "bağlantı yok" })).toBeVisible();
  await expect(page.getByText("Gelen kutusu boş.")).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("bağlantı yok")).toHaveCount(0);
});
