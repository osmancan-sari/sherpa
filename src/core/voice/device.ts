import type { SpeakOptions, VoiceOption, VoiceProvider } from "./types";

// The device's own speech (the Web Speech API): free and offline. Browsers refuse it until the
// page has had a tap (Chrome, since M71) and iOS wants the first utterance inside a tap; a
// refusal is silent here (docs/06-modul-sozlesmesi.md, "Sesli anlatım").
//
// Nothing here speaks on its own: no warm-up, no empty or silent utterance. The engine is only
// ever given what a `say()` asked for. (Until 13 Nov 2026 the first tap spoke an empty utterance
// at volume 0 to unlock iOS; Chrome's network voices ignore the volume, and a short sound came
// out now and then, even with the voice switched off.)

const TURKISH = /^tr\b|^tr-/i;

/**
 * The voice an utterance is given: the chosen one if it speaks Turkish, else the device's first
 * Turkish voice; null when the device has none. Without one nothing is said: another language's
 * voice reading Turkish ("Günaydın … colon zero zero", 14 Nov 2026) is worse than silence.
 */
export function turkishVoice<V extends { voiceURI: string; lang: string }>(
  all: readonly V[],
  chosen: string | null,
): V | null {
  const turkish = all.filter((voice) => TURKISH.test(voice.lang));
  return turkish.find((voice) => voice.voiceURI === chosen) ?? turkish[0] ?? null;
}

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;
}

export const deviceVoice: VoiceProvider = {
  available: () => synth() !== null,

  voices(): VoiceOption[] {
    const all = synth()?.getVoices() ?? [];
    return all
      .filter((voice) => TURKISH.test(voice.lang))
      .map((voice) => ({ id: voice.voiceURI, name: voice.name, lang: voice.lang }));
  },

  speak(text: string, options: SpeakOptions): Promise<void> {
    const speech = synth();
    if (!speech) return Promise.resolve();
    return new Promise((resolve) => {
      const voice = turkishVoice(speech.getVoices(), options.voice);
      // No Turkish voice on this device: silent (Settings says so).
      if (!voice) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice.lang;
      try {
        utterance.voice = voice;
      } catch {
        // Not the engine's own voice object (a stand-in): the language picks it.
      }
      utterance.rate = options.rate;
      // Ended, cut off or refused ("not-allowed" without a tap): the queue goes on either way.
      // Some engines never say they are done: the queue goes on after a generous while anyway.
      const guard = setTimeout(resolve, (5_000 + text.length * 150) / Math.max(0.5, options.rate));
      const done = () => {
        clearTimeout(guard);
        resolve();
      };
      utterance.onend = done;
      utterance.onerror = done;
      speech.speak(utterance);
    });
  },

  cancel() {
    const speech = synth();
    // Only when there is something to stop: cancelling an idle engine is a call for nothing.
    if (speech && (speech.speaking || speech.pending)) speech.cancel();
  },
};
