import { rows, waitFor } from "./data";
import { expect, test } from "./fixtures";

// The module template (src/modules/_sablon), the way its README leaves it after "copy and
// rename": registered as "sablon-kopya" where the demo switch is on (src/modules/registry.ts).
// Nothing else is changed in the copy, so this is what a new module does on its first day.

test("a renamed copy of the template is a working module", async ({ page }) => {
  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Şablon kopyası: etkinleştir" }).click();
  await expect(page.getByRole("link", { name: "Şablon kopyası ayarları" })).toBeVisible();
  const [row] = await waitFor(
    () => rows("modules"),
    (list) => list.length === 1,
  );
  expect(row).toMatchObject({ slug: "sablon-kopya", name: "Şablon kopyası", status: "active" });

  // Its chip on Today, and its page with the five regions.
  await page.goto("/");
  const chip = page
    .getByRole("navigation", { name: "Modüller" })
    .getByRole("link", { name: /Şablon kopyası/ });
  await expect(chip).toContainText("sırada iş yok");
  await chip.click();
  await expect(page).toHaveURL(/\/m\/sablon-kopya$/);
  await expect(page.getByRole("heading", { level: 1, name: "Şablon kopyası" })).toBeVisible();
  for (const name of ["Durum", "Yaklaşanlar", "Gövde", "Geçmiş ve gidişat", "Giriş ve ayarlar"]) {
    await expect(page.getByRole("region", { name })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Gövde" })).toContainText(
    "Bu modülde henüz bir şey yok.",
  );
  await expect(page.getByLabel("Bu hafta")).toContainText("Açık iş");

  // It can be picked in quick add; the task shows on its page and in its own view.
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Yeni giriş" });
  await dialog.getByLabel("Giriş", { exact: true }).fill("Ampul al 15dk");
  await dialog.getByRole("button", { name: "Şablon kopyası", exact: true }).click();
  await dialog.getByRole("button", { name: "Ekle", exact: true }).click();
  await expect(dialog).toBeHidden();
  const [task] = await waitFor(
    () => rows("tasks"),
    (list) => list.length === 1,
  );
  expect(task).toMatchObject({ title: "Ampul al", est_minutes: 15, module_id: row.id });
  await expect(page.getByRole("region", { name: "Yaklaşanlar" })).toContainText("Ampul al");
  await expect(page.getByRole("region", { name: "Gövde" })).toContainText("1 açık iş var.");

  // Its settings page exists without a form of its own.
  await page.goto("/ayarlar/moduller/sablon-kopya");
  await expect(page.getByRole("region", { name: "Modülün ayarları" })).toContainText(
    "Bu modülün kendi ayarı yok.",
  );
});
