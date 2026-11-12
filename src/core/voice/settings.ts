import { DEFAULT_VOICE, type VoiceSettings } from "./types";

// The voice settings live on the device (localStorage): each screen decides for itself whether
// it speaks. Storage that is not there (a private window) means the defaults.

const KEY = "sherpa.voice";
const listeners = new Set<() => void>();
let cached: VoiceSettings | null = null;

export function readVoiceSettings(): VoiceSettings {
  if (cached) return cached;
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<VoiceSettings>) : {};
    cached = {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_VOICE.enabled,
      voice: typeof parsed.voice === "string" ? parsed.voice : null,
      rate:
        typeof parsed.rate === "number" && parsed.rate >= 0.5 && parsed.rate <= 2
          ? parsed.rate
          : DEFAULT_VOICE.rate,
      auto: typeof parsed.auto === "boolean" ? parsed.auto : DEFAULT_VOICE.auto,
    };
  } catch {
    cached = DEFAULT_VOICE;
  }
  return cached;
}

export function saveVoiceSettings(patch: Partial<VoiceSettings>): void {
  cached = { ...readVoiceSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // Kept for this page only.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeVoiceSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const serverVoiceSettings = () => DEFAULT_VOICE;
