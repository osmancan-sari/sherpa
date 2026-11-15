import type { Page } from "@playwright/test";
import { insert, rows, seedModule, waitFor } from "./data";
import { expect, quietTest, test } from "./fixtures";
import { openQuickAdd } from "./helpers";

// The visual check (docs/tasarim/README.md, "Görsel denetim"): the gallery and the main screens,
// at one fixed moment, with fixed data, on the phone and on the board, against approved images
// kept in the repository (gorsel.spec.ts-snapshots/). When the look changes without intent the
// test breaks. An approved image is renewed only on purpose:
//   npx playwright test gorsel --update-snapshots
// and the reason goes into the commit message (CLAUDE.md "Tasarım").

/** 13 November 2026, 14:10 in Istanbul: the day sky of frames Hava_acik and HavaSakin_acik. */
const MOMENT = new Date("2026-11-13T14:10:00+03:00");

const DEVICES = [
  { name: "telefon", viewport: { width: 390, height: 844 }, hasTouch: true },
  { name: "pano", viewport: { width: 1440, height: 900 }, hasTouch: false },
] as const;

/** Waits until the page stands still: its sky drawn, its fonts loaded, nothing moving. */
async function settled(page: Page) {
  await expect(page.locator("[data-testid=backdrop][data-phase]")).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

async function shot(
  page: Page,
  name: string,
  options: { mask?: ReturnType<Page["locator"]>[]; fullPage?: boolean } = {},
) {
  await settled(page);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    // Tight: a change of a token (a colour, a size) moves more pixels than this.
    maxDiffPixelRatio: 0.002,
    fullPage: options.fullPage,
    animations: "disabled",
    caret: "hide",
    mask: options.mask,
  });
}

for (const device of DEVICES) {
  test.describe(device.name, () => {
    test.use({ viewport: device.viewport, hasTouch: device.hasTouch });

    test.beforeEach(async ({ page }) => {
      await page.clock.setFixedTime(MOMENT);
    });

    test(`gallery (${device.name})`, async ({ page }) => {
      await page.goto("/tasarim");
      await expect(page.getByRole("heading", { name: "Tasarım" })).toBeVisible();
      // The whole gallery, every piece and state.
      await shot(page, `galeri-${device.name}`, { fullPage: true });
    });

    test(`inbox (${device.name})`, async ({ page }) => {
      await insert("inbox_entries", [
        { raw_text: "kombi bakımı için usta çağır" },
        { raw_text: "salı 14:00 danışmanla görüşme" },
      ]);
      await page.goto("/gelen");
      await expect(page.getByText("kombi bakımı için usta çağır")).toBeVisible();
      await shot(page, `gelen-${device.name}`);
    });

    test(`modules and a module page (${device.name})`, async ({ page }) => {
      await seedModule("okul-ornek", "Okul", "#5b8cff");
      const [ev] = await insert("modules", { slug: "ev-ornek", name: "Ev", color: "#5fd6c6" });
      await insert("modules", {
        slug: "is-ornek",
        name: "İş",
        color: "#c3a9ff",
        status: "paused",
      });
      await page.goto("/m");
      await expect(page.getByRole("link", { name: /Ev/ })).toBeVisible();
      await shot(page, `moduller-${device.name}`);

      await page.goto(`/m/${(ev as { slug: string }).slug}`);
      await expect(page.getByText("Bu modülde sırada iş yok.")).toBeVisible();
      await shot(page, `modul-sayfasi-${device.name}`);
    });

    test(`Rutin's module page and a step's sheet (${device.name})`, async ({ page }) => {
      await page.goto("/ayarlar/moduller");
      await page.getByRole("button", { name: "Rutin: etkinleştir" }).click();
      await expect(page.getByRole("link", { name: "Rutin ayarları" })).toBeVisible();
      await waitFor(
        () => rows("rhythms"),
        (list) => list.length === 3,
      );
      await page.goto("/m/rutin");
      await expect(page.getByTestId("rutin-sabah")).toBeVisible();
      await shot(page, `rutin-modul-${device.name}`);
      await page
        .getByTestId("rutin-sabah")
        .getByRole("button", { name: /^Diş bakımı temel/ })
        .click();
      await expect(page.getByRole("dialog", { name: "Adımı düzenle" })).toBeVisible();
      await shot(page, `rutin-adim-duzenle-${device.name}`);
    });

    test(`settings (${device.name})`, async ({ page }) => {
      await page.goto("/ayarlar");
      await expect(page.getByRole("heading", { level: 1, name: "Ayarlar" })).toBeVisible();
      await expect(page.getByText("@")).toBeVisible();
      await shot(page, `ayarlar-${device.name}`);

      // On the board /ayarlar already shows Görünüm; on the phone it is a page of its own.
      if (device.name === "telefon") {
        await page.goto("/ayarlar/gorunum");
        await expect(page.getByRole("switch", { name: "Saydamlığı azalt" })).toBeVisible();
        await shot(page, `ayarlar-gorunum-${device.name}`);
      }
    });

    test(`quick add (${device.name})`, async ({ page }) => {
      await seedModule("okul-ornek", "Okul", "#5b8cff");
      await page.goto("/gelen");
      if (device.name === "telefon") {
        await page.getByRole("button", { name: "Yeni giriş" }).click();
      } else {
        await openQuickAdd(page);
      }
      const sheet = page.getByRole("dialog", { name: "Yeni giriş" });
      await sheet.getByLabel("Giriş").fill("Sunum slaytları cuma 45dk");
      await sheet.getByRole("button", { name: "Okul" }).click();
      await expect(sheet.getByLabel("Süre (dk)")).toHaveValue("45");
      // The date a weekday name points at moves with the real day: masked.
      await shot(page, `hizli-giris-${device.name}`, { mask: [sheet.getByLabel("Tarih")] });
    });

    test(`today, an empty day (${device.name})`, async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText("Bugün için planlanan bir şey yok.")).toBeVisible();
      // Its layout is Ç4c's; the date line and the strip's hours follow the clock: masked.
      await shot(page, `bugun-bos-${device.name}`, {
        mask: [page.locator("main header"), page.getByRole("region", { name: "Günün şeridi" })],
      });
    });
  });
}

for (const device of DEVICES) {
  quietTest.describe(`${device.name}, signed out`, () => {
    quietTest.use({
      viewport: device.viewport,
      hasTouch: device.hasTouch,
      storageState: { cookies: [], origins: [] },
    });

    quietTest(`sign-in (${device.name})`, async ({ page }) => {
      await page.clock.setFixedTime(MOMENT);
      await page.goto("/giris");
      await expect(page.getByLabel("E-posta")).toBeVisible();
      await shot(page, `giris-${device.name}`);
    });
  });
}
