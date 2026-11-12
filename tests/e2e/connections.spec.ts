import { rows, waitFor } from "./data";
import { expect, test } from "./fixtures";

// Settings → Bağlantılar (Ç3d): a device token is made with its scopes, shown once, listed by
// its first characters and revoked.

test("a device token is made with its scopes, shown once, and revoked", async ({ page }) => {
  await page.goto("/ayarlar");
  const form = page.getByRole("form", { name: "Yeni anahtar" });
  await expect(form.getByRole("button", { name: "Anahtar üret" })).toBeDisabled();
  await form.getByLabel("Ad").fill("iPhone Kestirmeler");
  await form.getByRole("checkbox", { name: /Uyanış/ }).check();
  await form.getByRole("checkbox", { name: /Yatış/ }).check();
  await form.getByRole("button", { name: "Anahtar üret" }).click();

  const shown = page.getByTestId("new-token");
  await expect(shown).toHaveValue(/^shp_[A-Za-z0-9_-]{43}$/);
  const token = await shown.inputValue();
  await expect(page.getByText(/\/api\/ingest\/core\/wake$/)).toBeVisible();

  // Only the digest is stored.
  const [stored] = await waitFor(
    () => rows("device_tokens"),
    (list) => list.length === 1,
  );
  expect(stored).toMatchObject({ name: "iPhone Kestirmeler", scopes: ["core/wake", "core/bed"] });
  expect(JSON.stringify(stored)).not.toContain(token.slice(8));

  // Once "Tamam" is pressed, it is gone for good: the list shows its first characters only.
  await page.getByRole("button", { name: "Tamam" }).click();
  await expect(page.getByTestId("new-token")).toHaveCount(0);
  const row = page.getByTestId("device-token");
  await expect(row).toContainText(`iPhone Kestirmeler ${token.slice(0, 8)}…`);
  await expect(row).toContainText("Uyanış, Yatış");
  await expect(row).toContainText("Henüz kullanılmadı");
  await page.reload();
  await expect(page.getByText(token)).toHaveCount(0);

  // Revoking takes two taps.
  await row.getByRole("button", { name: "İptal et" }).click();
  await row.getByRole("button", { name: "Evet, iptal et" }).click();
  await expect(row).toContainText("İptal edildi");
  await expect(row.getByRole("button", { name: "İptal et" })).toHaveCount(0);
  await waitFor(
    () => rows("device_tokens"),
    (list) => list[0]?.revoked_at !== null,
  );
});
