"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";
import { useSyncExternalStore } from "react";
import { deviceVoice } from "./device";
import {
  readVoiceSettings,
  saveVoiceSettings,
  serverVoiceSettings,
  subscribeVoiceSettings,
} from "./settings";
import { createSpeaker, type Speaker } from "./speaker";
import type { Say, VoiceProvider as Provider, VoiceSettings } from "./types";

// The voice for the whole app: one queue per screen, the device's settings, the last touch
// (what makes this device the one that speaks), and the unlock inside the first tap.

const VoiceContext = createContext<Speaker | null>(null);

/** When this device was last touched (one app per page). */
let lastTouchAt: number | null = null;

export function VoiceProvider({
  children,
  provider = deviceVoice,
}: {
  children: ReactNode;
  provider?: Provider;
}) {
  const speaker = useMemo(
    () =>
      createSpeaker({
        provider,
        settings: readVoiceSettings,
        lastTouch: () => lastTouchAt,
      }),
    [provider],
  );
  useEffect(() => {
    let unlocked = false;
    const onTouch = () => {
      lastTouchAt = Date.now();
      if (!unlocked) {
        unlocked = true;
        provider.unlock();
      }
    };
    window.addEventListener("pointerdown", onTouch, true);
    window.addEventListener("keydown", onTouch, true);
    return () => {
      window.removeEventListener("pointerdown", onTouch, true);
      window.removeEventListener("keydown", onTouch, true);
      speaker.stop();
    };
  }, [provider, speaker]);
  return <VoiceContext.Provider value={speaker}>{children}</VoiceContext.Provider>;
}

const silent: Say = () => {};

/** `say` for screens and modules: silent outside the provider, never throws. */
export function useSay(): Say {
  const speaker = useContext(VoiceContext);
  return speaker ? speaker.say : silent;
}

/** This device's voice settings, live. */
export function useVoiceSettings(): [VoiceSettings, (patch: Partial<VoiceSettings>) => void] {
  const settings = useSyncExternalStore(
    subscribeVoiceSettings,
    readVoiceSettings,
    serverVoiceSettings,
  );
  return [settings, saveVoiceSettings];
}
