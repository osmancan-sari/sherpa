import path from "node:path";
import { expect, test } from "@playwright/test";
import { ALLOWED_EMAIL, requestCode } from "./helpers";

// Phase screenshots. Runs only when SHERPA_SHOTS names the phase folder, for example:
//   $env:SHERPA_SHOTS = "c0"; npm run test:e2e
// Files land in docs/ekran-goruntuleri/<folder>/<pano|telefon>-<screen>-<theme>.png

const folder = path.join("docs", "ekran-goruntuleri", process.env.SHERPA_SHOTS ?? "gecici");

const screens = [
  { name: "bugun", path: "/", heading: "Bugün" },
  { name: "hafta", path: "/hafta", heading: "Hafta" },
  { name: "moduller", path: "/m", heading: "Modüller" },
  { name: "gelen", path: "/gelen", heading: "Gelen kutusu" },
  { name: "ayarlar", path: "/ayarlar", heading: "Ayarlar" },
];

for (const theme of ["dark", "light"] as const) {
  test(`screens, ${theme}`, async ({ page }, testInfo) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);

    for (const screen of screens) {
      await page.goto(screen.path);
      await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeVisible();
      if (screen.name === "ayarlar") {
        // Two parts of this screen arrive after the shell: the active theme (known only
        // after hydration) and the account line (streamed in). Wait for both before the picture.
        await expect(
          page.getByRole("group", { name: "Tema" }).locator("[aria-pressed=true]"),
        ).toHaveCount(1);
        await expect(
          page.locator("section", { hasText: "Hesap" }).getByRole("paragraph"),
        ).toHaveText(ALLOWED_EMAIL);
      }
      await page.screenshot({
        path: path.join(folder, `${testInfo.project.name}-${screen.name}-${theme}.png`),
        // Finish colour transitions instead of catching them halfway.
        animations: "disabled",
      });
    }
  });
}

test("login screens", async ({ browser }, testInfo) => {
  const { viewport, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use;
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    baseURL: testInfo.project.use.baseURL,
  });
  const page = await context.newPage();
  const shot = (name: string) =>
    page.screenshot({
      path: path.join(folder, `${testInfo.project.name}-${name}-dark.png`),
      animations: "disabled",
    });

  // Step one: the e-mail address.
  await page.goto("/giris");
  await expect(page.getByLabel("E-posta")).toBeVisible();
  await shot("giris");

  // Another address is turned away.
  await page.getByLabel("E-posta").fill("baskasi@ornek.test");
  await page.getByRole("button", { name: "Kod gönder" }).click();
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  await shot("giris-reddedildi");

  // Step two: the code from the e-mail.
  await requestCode(page);
  await shot("giris-kod");

  await context.close();
});
