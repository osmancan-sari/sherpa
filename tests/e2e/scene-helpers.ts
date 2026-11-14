import { expect, type Page } from "@playwright/test";
import { rows, waitFor } from "./data";

// Shared by the scene specs (Ç3c): the "deneme" module on, a record of a kind, what was said
// (the speech is fake in every test: tests/e2e/fixtures.ts).

export async function activateDeneme(page: Page) {
  await page.goto("/ayarlar/moduller");
  await page.getByRole("button", { name: "Deneme: etkinleştir" }).click();
  await expect(page.getByRole("link", { name: "Deneme ayarları" })).toBeVisible();
  await waitFor(
    () => rows("modules"),
    (list) => list.length === 1,
  );
}

export async function addRecord(
  page: Page,
  title: string,
  extra: { minutes?: string; kind?: string; facet?: string } = {},
) {
  await page.goto("/");
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Yeni giriş" });
  await dialog.getByLabel("Giriş").fill(title);
  await page.keyboard.press("Tab");
  await dialog
    .getByRole("group", { name: "Kayıt türü" })
    .getByRole("button", { name: "Kayıt" })
    .click();
  if (extra.kind) await dialog.getByLabel("Tür", { exact: true }).selectOption(extra.kind);
  if (extra.minutes) await dialog.getByLabel(/Süre \(dk\)/).fill(extra.minutes);
  // Ç3e: one of the module's fixed facets ("sabah", "aksam").
  if (extra.facet) await dialog.getByLabel(/^Bölüm/).selectOption(extra.facet);
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog).toBeHidden();
}

/** Starts a record's work from the module page's "Yaklaşanlar" (any hour, any kind). */
export async function startFromModule(page: Page, title: string) {
  await page.goto("/m/deneme");
  await page
    .getByRole("region", { name: "Yaklaşanlar" })
    .getByRole("button", { name: `Başla: ${title}` })
    .click();
  await waitFor(
    () => rows("sessions"),
    (list) => list.some((row) => row.ended_at === null),
  );
  await page.goto("/");
}

/** What the page would have said: the shared fake speech keeps it (tests/e2e/fixtures.ts). */
export const spoken = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
