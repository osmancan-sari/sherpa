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

// The voice for the whole app: one queue per screen, the device's settings and the last touch
// (what makes this device the one that speaks). Only `say()` ever reaches the speech engine:
// a touch is only noted, never answered with a sound (docs/06-modul-sozlesmesi.md).

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
    const onTouch = () => {
      lastTouchAt = Date.now();
    };
    // The page goes away (closed, reloaded, put in the background cache): nothing is left
    // queued in the engine to come out later.
    const onHide = () => speaker.stop();
    window.addEventListener("pointerdown", onTouch, true);
    window.addEventListener("keydown", onTouch, true);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pointerdown", onTouch, true);
      window.removeEventListener("keydown", onTouch, true);
      window.removeEventListener("pagehide", onHide);
      speaker.stop();
    };
  }, [speaker]);
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
