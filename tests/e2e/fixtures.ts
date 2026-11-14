import { type BrowserContext, test as base } from "@playwright/test";
import { resetData } from "./data";

/**
 * The device's speech replaced in every page of every context (Ç3g): tests, screenshot runs and
 * the browsers they open never make a sound (the real voice is tried by hand on real devices).
 * What would have been said is kept in `window.__spoken` (texts with words only). A spec that
 * needs another fake (tests/e2e/voice.spec.ts) puts its own over this one.
 */
export function fakeSpeech() {
  const page = window as unknown as { __spoken?: string[] };
  if (page.__spoken) return;
  const said: string[] = [];
  page.__spoken = said;
  const fake = {
    speaking: false,
    pending: false,
    speak(utterance: SpeechSynthesisUtterance) {
      if (utterance.text) said.push(utterance.text);
      setTimeout(() => utterance.onend?.(new Event("end") as SpeechSynthesisEvent), 10);
    },
    cancel() {},
    pause() {},
    resume() {},
    getVoices: () => [{ voiceURI: "tr-fake", name: "Deneme sesi", lang: "tr-TR" }],
    addEventListener() {},
    removeEventListener() {},
  };
  Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true });
}

const quieted = new WeakSet<BrowserContext>();
async function quiet(context: BrowserContext) {
  if (quieted.has(context)) return;
  quieted.add(context);
  await context.addInitScript(fakeSpeech);
}

/**
 * Every spec's `test` comes from here: the speech is fake in the test's own context and in any
 * context a spec opens itself (`browser.newContext`, a second device).
 */
export const quietTest = base.extend<object, { quietBrowser: void }>({
  quietBrowser: [
    async ({ browser }, use) => {
      const newContext = browser.newContext.bind(browser);
      browser.newContext = async (...args: Parameters<typeof newContext>) => {
        const context = await newContext(...args);
        await quiet(context);
        return context;
      };
      await use();
    },
    { scope: "worker", auto: true },
  ],
  context: async ({ context }, provide) => {
    await quiet(context);
    await provide(context);
  },
});

/**
 * `test` for the signed-in specs: every test starts from an account without any data, so the
 * order of the tests and what an earlier run left behind never matter.
 */
export const test = quietTest.extend<{ cleanAccount: void }>({
  cleanAccount: [
    async ({}, use) => {
      await resetData();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
