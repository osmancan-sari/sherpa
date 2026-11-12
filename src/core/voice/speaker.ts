import { splitSentences } from "./sentences";
import type { SpeakOptions, VoiceProvider, VoiceSettings } from "./types";

// The queue: what is said comes in order, one piece at a time; `interrupt` drops what waits and
// cuts off what is being said. Silent, and never failing, when the voice is off or the device
// cannot speak (docs/06-modul-sozlesmesi.md, "Sesli anlatım").

/** A touch within this long makes a device the one that speaks (without the "auto" setting). */
export const TOUCH_WINDOW_MS = 10 * 60_000;

export type Speaker = {
  say: (text: string, options?: { interrupt?: boolean }) => void;
  stop: () => void;
  /** Resolves when everything queued so far is said (for tests). */
  idle: () => Promise<void>;
};

export function createSpeaker(input: {
  provider: VoiceProvider;
  settings: () => VoiceSettings;
  /** When this device was last touched (ms); null: never since it opened. */
  lastTouch: () => number | null;
  now?: () => number;
}): Speaker {
  const now = input.now ?? (() => Date.now());
  let queue: string[] = [];
  let running: Promise<void> | null = null;
  let generation = 0;

  const mayTalk = () => {
    const settings = input.settings();
    if (!settings.enabled || !input.provider.available()) return false;
    if (settings.auto) return true;
    const touched = input.lastTouch();
    return touched !== null && now() - touched <= TOUCH_WINDOW_MS;
  };

  const run = async (own: number) => {
    while (queue.length > 0 && own === generation) {
      const piece = queue.shift()!;
      const settings = input.settings();
      const options: SpeakOptions = { voice: settings.voice, rate: settings.rate };
      try {
        await input.provider.speak(piece, options);
      } catch {
        // A provider that fails says nothing more of this piece; the rest goes on.
      }
    }
  };

  const start = () => {
    if (running) return;
    const own = generation;
    running = run(own).finally(() => {
      running = null;
      if (queue.length > 0 && own !== generation) start();
    });
  };

  return {
    say(text, options) {
      if (!mayTalk()) return;
      const pieces = splitSentences(text);
      if (options?.interrupt) {
        generation++;
        queue = [];
        input.provider.cancel();
      }
      if (pieces.length === 0) return;
      queue.push(...pieces);
      start();
    },
    stop() {
      generation++;
      queue = [];
      input.provider.cancel();
    },
    async idle() {
      while (running) await running;
    },
  };
}
