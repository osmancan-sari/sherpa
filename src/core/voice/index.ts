export type { Say, VoiceOption, VoiceProvider as VoiceProviderApi, VoiceSettings } from "./types";
export { DEFAULT_VOICE } from "./types";
export { splitSentences } from "./sentences";
export { createSpeaker, TOUCH_WINDOW_MS } from "./speaker";
export { deviceVoice } from "./device";
export { useSay, useVoiceSettings, VoiceProvider } from "./VoiceProvider";
