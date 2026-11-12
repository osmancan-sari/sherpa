import { expect, type Page } from "@playwright/test";
import { rows, waitFor } from "./data";

// Shared by the scene specs (Ç3c): the "deneme" module on, a record of a kind, and the device's
// speech replaced by a recorder (the real one is tried by hand on real devices).

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
  extra: { minutes?: string; kind?: string } = {},
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

/** Replaces the device's speech with a recorder: `window.__spoken` holds what was said. */
export async function recordSpeech(page: Page) {
  await page.addInitScript(() => {
    const said: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = said;
    const fake = {
      speak(utterance: SpeechSynthesisUtterance) {
        if (utterance.text) said.push(utterance.text);
        setTimeout(() => utterance.onend?.(new Event("end") as SpeechSynthesisEvent), 10);
      },
      cancel() {},
      getVoices: () => [{ voiceURI: "tr-fake", name: "Deneme sesi", lang: "tr-TR" }],
      addEventListener() {},
      removeEventListener() {},
    };
    Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true });
  });
}

export const spoken = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
