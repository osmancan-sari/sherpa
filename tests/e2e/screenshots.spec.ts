import path from "node:path";
import { expect, test } from "@playwright/test";

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
      await page.screenshot({
        path: path.join(folder, `${testInfo.project.name}-${screen.name}-${theme}.png`),
      });
    }
  });
}

test("login screen", async ({ browser }, testInfo) => {
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
  await page.goto("/giris");
  await expect(page.getByLabel("E-posta")).toBeVisible();
  await page.screenshot({ path: path.join(folder, `${testInfo.project.name}-giris-dark.png`) });
  await context.close();
});
