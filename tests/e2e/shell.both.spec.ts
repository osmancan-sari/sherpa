import { expect, test } from "./fixtures";
import { ALLOWED_EMAIL } from "./helpers";

// The signed-in shell, run once at second-screen width ("pano") and once at phone width ("telefon").

const screens = [
  { label: "Bugün", path: "/", empty: "Bugün için planlanan bir şey yok." },
  { label: "Hafta", path: "/hafta", empty: "Bu hafta için taahhüt edilen kalem yok." },
  { label: "Modüller", path: "/m", empty: "Henüz modül yok." },
  { label: "Gelen kutusu", path: "/gelen", empty: "Gelen kutusu boş." },
  { label: "Ayarlar", path: "/ayarlar", empty: null },
];

test("navigation reaches every screen", async ({ page }) => {
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
    // Phone: a bar along the bottom edge with comfortable touch targets.
    expect(box.y + box.height).toBeCloseTo(viewport!.height, 0);
    expect(box.width).toBeCloseTo(viewport!.width, 0);
    for (const link of await nav.getByRole("link").all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  } else {
    // Second screen: a rail down the left edge.
    expect(box.x).toBe(0);
    expect(box.height).toBeCloseTo(viewport!.height, 0);
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("dark is the default theme; light can be chosen and is remembered", async ({ page }) => {
  await page.goto("/ayarlar");
  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);

  await page.getByRole("button", { name: "Açık" }).click();
  await expect(html).not.toHaveClass(/dark/);
  await expect(page.getByRole("button", { name: "Açık" })).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(html).not.toHaveClass(/dark/);
  // The account line streams in after the shell, in either theme.
  await expect(page.locator("section", { hasText: "Hesap" }).getByRole("paragraph")).toHaveText(
    ALLOWED_EMAIL,
  );

  await page.getByRole("button", { name: "Koyu" }).click();
  await expect(html).toHaveClass(/dark/);
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
