import type { SpeakOptions, VoiceOption, VoiceProvider } from "./types";

// The device's own speech (the Web Speech API): free and offline. Browsers refuse it until the
// page has had a tap (Chrome, since M71) and iOS wants the first utterance inside a tap; a
// refusal is silent here (docs/06-modul-sozlesmesi.md, "Sesli anlatım").

const TURKISH = /^tr\b|^tr-/i;

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
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "tr-TR";
      utterance.rate = options.rate;
      const voice = speech
        .getVoices()
        .find((row) => row.voiceURI === options.voice && TURKISH.test(row.lang));
      if (voice) utterance.voice = voice;
      // Ended, cut off or refused ("not-allowed" without a tap): the queue goes on either way.
      // Some engines never say they are done: the queue goes on after a generous while anyway.
      const guard = setTimeout(resolve, 5_000 + text.length * 150);
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
    synth()?.cancel();
  },

  unlock() {
    const speech = synth();
    if (!speech) return;
    // An empty utterance inside the tap: a strict browser lets later ones through.
    const utterance = new SpeechSynthesisUtterance("");
    utterance.volume = 0;
    speech.speak(utterance);
  },
};
