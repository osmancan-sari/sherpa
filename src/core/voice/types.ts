// The voice service (docs/06-modul-sozlesmesi.md, "Sesli anlatım"; Ç3c). One way in for every
// module (`say`), behind a provider: today the device's own speech, later perhaps a paid one.

export type Say = (text: string, options?: { interrupt?: boolean }) => void;

export type VoiceOption = { id: string; name: string; lang: string };

export type SpeakOptions = { voice: string | null; rate: number };

export interface VoiceProvider {
  /** Whether this device can speak at all. */
  available(): boolean;
  /** The voices that speak Turkish (the device's own list; may fill in a moment later). */
  voices(): VoiceOption[];
  /** Speaks one piece; resolves when it is said, cut off or refused (never rejects). */
  speak(text: string, options: SpeakOptions): Promise<void>;
  /** Stops what is being said. */
  cancel(): void;
  /** Called inside a tap: lets a strict browser (iOS) speak later. */
  unlock(): void;
}

/** Per device (docs/05-arayuz.md, "Ayarlar → Sesli anlatım"). */
export type VoiceSettings = {
  enabled: boolean;
  voice: string | null;
  rate: number;
  /** "Bu cihaz dokunuş olmadan da konuşsun": the second screen, for example. */
  auto: boolean;
};

export const DEFAULT_VOICE: VoiceSettings = { enabled: true, voice: null, rate: 1, auto: false };
