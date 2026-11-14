import { describe, expect, it } from "vitest";
import { turkishVoice } from "./device";
import { MAX_PIECE, splitSentences } from "./sentences";
import { createSpeaker, TOUCH_WINDOW_MS } from "./speaker";
import { DEFAULT_VOICE, type VoiceProvider, type VoiceSettings } from "./types";

// The voice service with a fake provider (docs/06-modul-sozlesmesi.md, "Sesli anlatım"):
// sentences, the queue, interrupt, silence when off, the device that speaks.

function fakeProvider(options: { available?: boolean; refuse?: boolean } = {}) {
  const said: string[] = [];
  const cut: string[] = [];
  let pending: { text: string; settle: () => void } | null = null;
  const provider: VoiceProvider = {
    available: () => options.available ?? true,
    voices: () => [{ id: "tr-1", name: "Yelda", lang: "tr-TR" }],
    speak(text) {
      if (options.refuse) return Promise.reject(new Error("refused"));
      return new Promise<void>((resolve) => {
        pending = { text, settle: resolve };
        setTimeout(() => {
          if (pending?.text === text) {
            pending = null;
            said.push(text);
            resolve();
          }
        }, 5);
      });
    },
    cancel() {
      // As the device does: what is being said ends ("interrupted") without being said out.
      if (pending) {
        cut.push(pending.text);
        const { settle } = pending;
        pending = null;
        settle();
      }
    },
  };
  return { provider, said, cut };
}

const touchedNow = () => Date.now();

function speaker(
  provider: VoiceProvider,
  settings: Partial<VoiceSettings> = {},
  lastTouch: () => number | null = touchedNow,
) {
  return createSpeaker({
    provider,
    settings: () => ({ ...DEFAULT_VOICE, ...settings }),
    lastTouch,
  });
}

describe("sentences", () => {
  it("cuts text into sentences, and a long one at a comma or a space", () => {
    expect(splitSentences("  İlk adım: esneme.  Sonra su iç!  Hazır mısın? ")).toEqual([
      "İlk adım: esneme.",
      "Sonra su iç!",
      "Hazır mısın?",
    ]);
    const long = `${"kelime ".repeat(40)}, ${"devam ".repeat(30)}son.`;
    const pieces = splitSentences(long);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.every((piece) => piece.length <= MAX_PIECE)).toBe(true);
    expect(pieces.join(" ").replace(/\s+/g, " ")).toBe(long.replace(/\s+/g, " ").trim());
    expect(splitSentences("   ")).toEqual([]);
  });
});

describe("the queue", () => {
  it("says everything in order, one piece at a time", async () => {
    const fake = fakeProvider();
    const voice = speaker(fake.provider);
    voice.say("Birinci adım. İkinci adım.");
    voice.say("Üçüncü adım.");
    await voice.idle();
    expect(fake.said).toEqual(["Birinci adım.", "İkinci adım.", "Üçüncü adım."]);
  });

  it("interrupt drops what waits and cuts off what is being said", async () => {
    const fake = fakeProvider();
    const voice = speaker(fake.provider);
    voice.say("Uzun bir anlatım. Bir cümle daha. Ve bir tane daha.");
    voice.say("Dur, sıradaki adım!", { interrupt: true });
    await voice.idle();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fake.cut).toEqual(["Uzun bir anlatım."]);
    expect(fake.said).toEqual(["Dur, sıradaki adım!"]);
  });

  it("is silent and never throws when off, when the device cannot speak, or when it refuses", async () => {
    for (const [fake, settings] of [
      [fakeProvider(), { enabled: false }],
      [fakeProvider({ available: false }), {}],
    ] as const) {
      const voice = speaker(fake.provider, settings);
      expect(() => voice.say("Merhaba.")).not.toThrow();
      await voice.idle();
      expect(fake.said).toEqual([]);
    }
    const refusing = speaker(fakeProvider({ refuse: true }).provider);
    expect(() => refusing.say("Merhaba. Bir daha.")).not.toThrow();
    await expect(refusing.idle()).resolves.toBeUndefined();
  });

  it("speaks on the device that was touched lately, or that may speak without a touch", async () => {
    const quiet = fakeProvider();
    const untouched = speaker(quiet.provider, {}, () => null);
    untouched.say("Kimse dokunmadı.");
    const stale = speaker(quiet.provider, {}, () => Date.now() - TOUCH_WINDOW_MS - 1000);
    stale.say("Çoktan.");
    await untouched.idle();
    await stale.idle();
    expect(quiet.said).toEqual([]);

    const pano = fakeProvider();
    const auto = speaker(pano.provider, { auto: true }, () => null);
    auto.say("Pano konuşur.");
    await auto.idle();
    expect(pano.said).toEqual(["Pano konuşur."]);
  });
});

describe("the device's voice (Ç3g)", () => {
  const voices = [
    { voiceURI: "en-1", lang: "en-US" },
    { voiceURI: "tr-1", lang: "tr-TR" },
    { voiceURI: "tr-2", lang: "tr" },
    { voiceURI: "tr-3", lang: "tr_TR" },
  ];
  it("takes the chosen Turkish voice, else the first Turkish one", () => {
    expect(turkishVoice(voices, "tr-2")?.voiceURI).toBe("tr-2");
    // Android writes the language with an underscore.
    expect(turkishVoice(voices, "tr-3")?.voiceURI).toBe("tr-3");
    expect(turkishVoice([{ voiceURI: "x", lang: "trk" }], null)).toBeNull();
    expect(turkishVoice(voices, null)?.voiceURI).toBe("tr-1");
    // A chosen voice that is not Turkish is not used.
    expect(turkishVoice(voices, "en-1")?.voiceURI).toBe("tr-1");
  });
  it("has none when the device has no Turkish voice: nothing is said in another language", () => {
    expect(turkishVoice([{ voiceURI: "en-1", lang: "en-US" }], null)).toBeNull();
    expect(turkishVoice([], "tr-1")).toBeNull();
  });
});
