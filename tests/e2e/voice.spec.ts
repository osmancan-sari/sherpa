import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// The voice speaks only when something calls `say()` (docs/06-modul-sozlesmesi.md, "Sesli
// anlatım"). Nothing else may reach the speech engine: no warm-up on the first tap, no empty or
// silent utterance, nothing while the page sits open. Until 13 Nov 2026 the first tap spoke an
// empty utterance at volume 0, even with the voice off; Chrome's network voices ignore the
// volume, and a short sound came out now and then. The recorder here keeps every call, empty
// ones included (the scene specs' recorder only keeps what has text).

type Call = { kind: "speak"; text: string; volume: number } | { kind: "cancel" };

async function recordEveryCall(page: Page, lang = "tr-TR") {
  await page.addInitScript((voiceLang) => {
    const calls: unknown[] = [];
    (window as unknown as { __speech: unknown[] }).__speech = calls;
    const fake = {
      speaking: false,
      pending: false,
      speak(utterance: SpeechSynthesisUtterance) {
        calls.push({ kind: "speak", text: utterance.text, volume: utterance.volume });
        setTimeout(() => utterance.onend?.(new Event("end") as SpeechSynthesisEvent), 10);
      },
      cancel() {
        calls.push({ kind: "cancel" });
      },
      getVoices: () => [{ voiceURI: "fake", name: "Deneme sesi", lang: voiceLang }],
      addEventListener() {},
      removeEventListener() {},
    };
    Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true });
  }, lang);
}

const calls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __speech: Call[] }).__speech);

test("taps, keys, pages and minutes open make no sound: only say() reaches the engine", async ({
  page,
}) => {
  await recordEveryCall(page);
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Bugün" })).toBeVisible();

  // The first tap and the first key of the page: where the warm-up used to speak.
  await page.mouse.click(5, 5);
  await page.keyboard.press("Shift");
  await page.getByRole("link", { name: "Hafta" }).first().click();
  await page.mouse.click(5, 5);
  await page.getByRole("link", { name: "Ayarlar" }).first().click();
  await expect(page.getByRole("group", { name: "Sesli anlatım" })).toBeVisible();
  await page.getByRole("link", { name: "Bugün" }).first().click();
  await page.mouse.click(5, 5);
  // The page sits open for a while.
  await page.clock.runFor(10 * 60_000);
  await page.mouse.click(5, 5);

  expect(await calls(page)).toEqual([]);
});

test("Ayarlar → Sesli anlatım: off keeps even Dene silent, and stays off after a reload; on speaks once", async ({
  page,
}) => {
  await recordEveryCall(page);
  await page.goto("/ayarlar");
  await expect(page.getByRole("heading", { name: "Sesli anlatım (bu cihaz)" })).toBeVisible();
  const voice = page.getByRole("group", { name: "Sesli anlatım" });
  const enabled = voice.getByRole("checkbox", { name: "Sesli anlatım açık" });
  await expect(enabled).toBeChecked();

  await enabled.uncheck();
  await voice.getByRole("button", { name: "Dene" }).click();
  await page.reload();
  await expect(enabled).not.toBeChecked();
  await voice.getByRole("button", { name: "Dene" }).click();
  expect(await calls(page)).toEqual([]);

  await enabled.check();
  await voice.getByRole("button", { name: "Dene" }).click();
  await expect
    .poll(async () => (await calls(page)).filter((call) => call.kind === "speak"))
    .toEqual([
      { kind: "speak", text: "Sesli anlatım açık.", volume: 1 },
      { kind: "speak", text: "Böyle konuşacağım.", volume: 1 },
    ]);
});

test("a device without a Turkish voice says nothing (no other language reads Turkish) and Settings says so", async ({
  page,
}) => {
  await recordEveryCall(page, "en-US");
  await page.goto("/ayarlar");
  const voice = page.getByRole("group", { name: "Sesli anlatım" });
  await expect(voice.getByText("Bu cihazda Türkçe ses yok; anlatım sessiz kalır.")).toBeVisible();
  await voice.getByRole("button", { name: "Dene" }).click();
  await page.waitForTimeout(300);
  expect((await calls(page)).filter((call) => call.kind === "speak")).toEqual([]);
});
