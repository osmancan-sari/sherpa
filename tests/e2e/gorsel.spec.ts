import type { Page } from "@playwright/test";
import { insert, rows, seedModule, update, waitFor } from "./data";
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

// Both run in the board's browser project at scale 1, so the images stay small and the same on
// every run; the phone's own viewport behaviour (isMobile, the keyboard, safe areas) is the
// "telefon" project's, and the real device's (docs/ILERLEME.md, "Senden bekleyenler").
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
    // And a pixel counts as changed at a small colour distance: the glass and the calm backdrop
    // are close dark colours, and at the default (0.2) a panel that grew by hundreds of pixels
    // over the backdrop still read as unchanged (Ç4b, Modüller on the board).
    threshold: 0.02,
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

    test(`the Sağlık area's page (${device.name})`, async ({ page }) => {
      await page.goto("/ayarlar/moduller");
      await page.getByRole("button", { name: "Rutin: etkinleştir" }).click();
      await expect(page.getByRole("link", { name: "Rutin ayarları" })).toBeVisible();
      await page.goto("/a/saglik");
      await expect(page.getByRole("region", { name: "Son 14 gün · temel adımlar" })).toBeVisible();
      await expect(page.getByRole("list", { name: "Üyeler" })).toContainText("Sabah yapılan gün");
      await shot(page, `alan-${device.name}`);
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
      // Ç4c: the layout as drawn (XT7, XP3); the date line follows the fixed moment.
      await shot(page, `bugun-bos-${device.name}`);
    });

    test(`today with work, Sıradakiler open, Takvim (${device.name})`, async ({ page }) => {
      const okul = await seedModule("okul-ornek", "Okul", "#5b8cff");
      const [ev] = await insert("modules", { slug: "ev-ornek", name: "Ev", color: "#5fd6c6" });
      await insert("tasks", [
        {
          module_id: okul.id,
          title: "Proje önerisi taslağı",
          est_minutes: 90,
          importance: 4,
          due_at: "2026-11-14T20:59:00Z",
        },
        { module_id: okul.id, title: "İstatistik ödevi", est_minutes: 60, importance: 3 },
        { module_id: ev.id as string, title: "Süpürme", est_minutes: 15 },
        { module_id: ev.id as string, title: "Ampul al", est_minutes: 15 },
      ]);
      await insert("blocks", {
        title: "Diş hekimi",
        starts_at: "2026-11-13T15:30:00Z",
        ends_at: "2026-11-13T16:15:00Z",
      });
      await page.goto("/");
      const now = page.getByRole("region", { name: "Şimdi" });
      await expect(now.getByRole("heading", { name: "Proje önerisi taslağı" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Günün akışı" })).toBeVisible();
      await shot(page, `bugun-${device.name}`);
      await page.getByRole("button", { name: "Hepsini göster" }).click();
      await expect(page.getByRole("button", { name: "Küçült" })).toBeVisible();
      await shot(page, `bugun-sirada-acik-${device.name}`);

      await page.goto("/takvim");
      await expect(page.getByRole("region", { name: "Bu hafta" })).toContainText(
        "Proje önerisi taslağı",
      );
      await shot(page, `takvim-${device.name}`);
    });

    // Sabah açılışı (16 Nov 2026): Rutin's welcome in the morning's place of Today, at dawn.
    test(`the morning's welcome (${device.name})`, async ({ page }) => {
      await page.goto("/ayarlar/moduller");
      await page.getByRole("button", { name: "Rutin: etkinleştir" }).click();
      await waitFor(
        () => rows("rhythms"),
        (list) => list.length === 3,
      );
      const [settings] = await rows("settings");
      await update("settings", settings.id as string, {
        day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
      });
      await page.clock.setFixedTime(new Date("2026-11-13T07:00:00+03:00"));
      await page.goto("/");
      await expect(
        page.getByTestId("rutin-welcome").getByRole("heading", { name: "Günaydın" }),
      ).toBeVisible();
      await shot(page, `karsilama-${device.name}`);
    });

    // Sabah açılışı, before release: Rutin's scene stands on one sky; on the board it reaches the
    // whole screen behind the menu, with the menu and the core's strip over it.
    test(`Rutin's scene, its first step (${device.name})`, async ({ page }) => {
      await page.goto("/ayarlar/moduller");
      await page.getByRole("button", { name: "Rutin: etkinleştir" }).click();
      const rhythms = await waitFor(
        () => rows("rhythms"),
        (list) => list.length === 3,
      );
      const [settings] = await rows("settings");
      await update("settings", settings.id as string, {
        day_frame: { wake: ["06:00", "09:00"], bed: ["22:00", "01:00"], sleep_minutes: 480 },
      });
      const [mod] = await rows("modules");
      // The screens may have written the day's row already (the first touch).
      const woke = {
        woke_at: "2026-11-13T04:00:00Z",
        woke_estimated: false,
        woke_source: "screen",
      };
      const known = (await rows("days")).find((row) => row.date === "2026-11-13");
      if (known) await update("days", known.id as string, woke);
      else await insert("days", { date: "2026-11-13", ...woke });
      await insert("sessions", {
        rhythm_id: rhythms.find((row) => row.key === "rutin:sabah")!.id,
        module_id: mod.id,
        started_at: "2026-11-13T04:00:00Z",
      });
      await page.clock.setFixedTime(new Date("2026-11-13T07:05:00+03:00"));
      await page.goto("/");
      const scene = page.getByTestId("rutin-scene");
      await expect(scene).toHaveAttribute("data-screen", "adim");
      await expect(page.getByTestId("strip-title")).toHaveText("Sabah");
      await shot(page, `rutin-sahne-${device.name}`);
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
