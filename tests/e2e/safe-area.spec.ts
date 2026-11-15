import type { Locator, Page } from "@playwright/test";
import { insert, rows, waitFor } from "./data";
import { runNow } from "./clock";
import { expect, test } from "./fixtures";
import { openQuickAdd, roomInTheDay } from "./helpers";
import { activateDeneme, addRecord, startFromModule } from "./scene-helpers";

// The phone's clock and island (docs/tasarim/ilkeler.md, "Gerçek cihazda bakılacaklar"). On the
// home screen the app draws under them (black-translucent, viewport-fit=cover): every screen
// starts below the safe area's top, the sky reaches up behind it, and what scrolls up goes
// behind the band the shell draws there. The browser is given an iPhone's insets (59 px at the
// top, 34 at the bottom) through the DevTools protocol, as Safari reports them on the device.

const TOP = 59;
const BOTTOM = 34;

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

async function giveIsland(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: TOP, bottom: BOTTOM } });
}

/**
 * Where the first thing drawn inside `root` starts, the page at its top: the least top of every
 * element with a box in it (not `root` itself: its room at the top is what is measured). What is fixed (the menu, the band) and what is only decoration
 * (aria-hidden: the backdrop) is not the page's content; nor is a 1 px text for screen readers.
 */
function firstTop(root: Locator): Promise<number> {
  return root.evaluate((element) => {
    window.scrollTo(0, 0);
    let top = Number.POSITIVE_INFINITY;
    for (const el of element.querySelectorAll("*")) {
      if (el.closest('[aria-hidden="true"]')) continue;
      let fixed = false;
      for (let at: Element | null = el; at && at !== element; at = at.parentElement) {
        if (getComputedStyle(at).position === "fixed") fixed = true;
      }
      if (fixed || getComputedStyle(el).visibility === "hidden") continue;
      const box = el.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) continue;
      top = Math.min(top, box.top);
    }
    return top;
  });
}

/** The screen's first heading: once it is there, so is the top of the page. */
async function expectStartsUnderTheIsland(page: Page, path: string) {
  await page.goto(path);
  const main = page.locator("main");
  const heading = main.getByRole("heading").first();
  await expect(heading).toBeVisible();
  const top = await firstTop(main);
  expect(top, `${path}: the first thing starts under the island`).toBeGreaterThanOrEqual(TOP);
  // Right under it, as in the phone frames (the page's own room, 18–24 px), no further down.
  expect(top, `${path}: the first thing starts right under it`).toBeLessThan(TOP + 32);
  expect((await heading.boundingBox())!.y, `${path}: the heading`).toBeGreaterThanOrEqual(TOP);
}

test.beforeEach(async ({ page }) => {
  await giveIsland(page);
});

test("every screen of the shell starts under the clock and the island; the sky reaches up behind it", async ({
  page,
}) => {
  await roomInTheDay(page);
  await activateDeneme(page);
  const [item] = await insert("deneme_items", { title: "Kısa kayıt", minutes: 30 });

  for (const path of [
    "/",
    "/hafta",
    "/m",
    "/gelen",
    "/ayarlar",
    "/ayarlar/gorunum",
    "/ayarlar/bloklar",
    "/ayarlar/moduller",
    "/ayarlar/moduller/deneme",
    "/ayarlar/cerceve",
    "/ayarlar/ses",
    "/ayarlar/yapay-zeka",
    "/ayarlar/baglantilar",
    "/ayarlar/kayitlar",
    "/m/deneme",
    "/m/deneme/bilesenler",
    `/m/deneme/kayit/${item.id}`,
    "/kapanis",
    "/tasarim",
  ]) {
    await expectStartsUnderTheIsland(page, path);
  }

  // The backdrop still covers the whole screen, the band under the clock included.
  const backdrop = (await page.getByTestId("backdrop").boundingBox())!;
  expect(backdrop.y).toBe(0);
  expect(backdrop.height).toBe(844);
  const band = (await page.getByTestId("safe-top").boundingBox())!;
  expect(band.y).toBe(0);
  expect(band.height).toBe(TOP);

  // The module's full-screen view has no shell; it keeps the same room itself.
  await page.goto("/m/deneme/tam/odak");
  await expect(page.getByRole("timer", { name: "Odak süresi" })).toBeVisible();
  for (const first of [
    page.getByRole("heading", { level: 1 }),
    page.getByRole("link", { name: "Kapat" }),
  ]) {
    expect((await first.boundingBox())!.y).toBeGreaterThanOrEqual(TOP);
  }
});

/**
 * The largest difference of one colour channel between two screenshots of the same size (0–255),
 * measured in the page's own canvas. A gradient drawn twice may round a channel by a step or two.
 */
function difference(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ([one, two]) => {
      const pixels = async (base64: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height).data;
      };
      const [x, y] = [await pixels(one), await pixels(two)];
      let most = 0;
      for (let i = 0; i < x.length; i++) most = Math.max(most, Math.abs(x[i] - y[i]));
      return most;
    },
    [a.toString("base64"), b.toString("base64")],
  );
}

/** As good as the same: no channel more than this apart. */
const SAME = 3;

test("what scrolls up goes behind the band: the clock stands on the same sky", async ({ page }) => {
  // The sky changes once a minute: the page's clock stands still for the comparison.
  await page.clock.setFixedTime(runNow());
  // A long page on the calm backdrop.
  await page.goto("/tasarim");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const band = page.getByTestId("safe-top");
  await expect(band.locator("> div")).toHaveCount(1);
  const shot = (clip: { x: number; y: number; width: number; height: number }) =>
    page.screenshot({ clip, animations: "disabled" });
  const hide = (hidden: boolean) =>
    band.evaluate(
      (el, value) => ((el as HTMLElement).style.visibility = value),
      hidden ? "hidden" : "",
    );
  // The whole band, page at its top: with the band and without it, the same sky (it draws the
  // backdrop itself, not a strip of its own; no seam, and the fading edge shows only sky).
  const whole = { x: 0, y: 0, width: 390, height: TOP };
  const sky = await shot(whole);
  await hide(true);
  expect(await difference(page, await shot(whole), sky)).toBeLessThanOrEqual(SAME);
  await hide(false);
  // Scrolled: the band's upper part, where the clock is (its lower part fades into the page),
  // is still that sky; without the band the page would be there.
  const clock = { x: 0, y: 0, width: 390, height: 32 };
  const before = await shot(clock);
  await page.evaluate(() => window.scrollTo(0, 600));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  await expect(async () =>
    expect(await difference(page, await shot(clock), before)).toBeLessThanOrEqual(SAME),
  ).toPass({ timeout: 5_000 });
  await hide(true);
  expect(await difference(page, await shot(clock), before)).toBeGreaterThan(30);
});

test("sheets and quick add stay under the island; so does the scene", async ({ page }) => {
  await roomInTheDay(page);
  // Quick add, and a sheet at its tallest: a short screen leaves it less room than it wants.
  await page.goto("/");
  await openQuickAdd(page);
  const quick = page.getByRole("dialog", { name: "Yeni giriş" });
  expect((await quick.boundingBox())!.y).toBeGreaterThanOrEqual(TOP);
  await page.keyboard.press("Escape");
  await expect(quick).toBeHidden();
  // 300 px: the sheet would take 94% of it (282 px, up to 18 px from the top); the island and
  // 8 px under it leave it 233.
  await page.setViewportSize({ width: 390, height: 300 });
  await openQuickAdd(page);
  const tall = (await quick.boundingBox())!;
  expect(tall.y).toBeGreaterThanOrEqual(TOP);
  expect(tall.height).toBeCloseTo(300 - TOP - 8, 0);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });

  // The scene takes the whole screen: its strip starts under the island, and it has its own band.
  await activateDeneme(page);
  await addRecord(page, "Rapor taslağı", { minutes: "30", kind: "odak" });
  await startFromModule(page, "Rapor taslağı");
  const scene = page.getByTestId("scene");
  await expect(scene).toBeVisible();
  await expect(page.getByLabel("Sahne şeridi")).toBeVisible();
  expect(await firstTop(scene)).toBeGreaterThanOrEqual(TOP);
  const band = (await scene.getByTestId("safe-top").boundingBox())!;
  expect(band.y).toBe(0);
  expect(band.height).toBe(TOP);
  await waitFor(
    () => rows("sessions"),
    (list) => list.length === 1,
  );
});
