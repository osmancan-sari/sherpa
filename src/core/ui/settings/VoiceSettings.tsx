"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { deviceVoice, useSay, useVoiceSettings, type VoiceOption } from "@/core/voice";
import { ClientOnly } from "../ClientOnly";

// Settings → Sesli anlatım (docs/05-arayuz.md): on this device only. On or off, the voice (the
// device's Turkish voices), the rate, and whether it may speak without being touched (the
// second screen). "Dene" says one sentence.

export function VoiceSettings() {
  return (
    <ClientOnly>
      <VoiceSettingsBody />
    </ClientOnly>
  );
}

function useDeviceVoices(): VoiceOption[] {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  useEffect(() => {
    const read = () => setVoices(deviceVoice.voices());
    const timer = setTimeout(read, 0);
    // The device's list may fill in a moment after the page opens.
    const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
    synth?.addEventListener?.("voiceschanged", read);
    return () => {
      clearTimeout(timer);
      synth?.removeEventListener?.("voiceschanged", read);
    };
  }, []);
  return voices;
}

function VoiceSettingsBody() {
  const [settings, save] = useVoiceSettings();
  const say = useSay();
  const voices = useDeviceVoices();
  const available = deviceVoice.available();

  return (
    <div className="flex flex-col gap-3 text-sm" role="group" aria-label="Sesli anlatım">
      <p className="text-muted-foreground">
        Bu ayarlar yalnızca bu cihazda geçerlidir. Modüller iş sırasında anlatım yapabilir; söylenen
        her şey ekranda da yazar.
      </p>
      {!available ? <p>Bu cihazda konuşma sentezi yok; anlatım sessiz kalır.</p> : null}
      <label className="flex min-h-11 items-center gap-2 md:min-h-9">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => save({ enabled: event.target.checked })}
        />
        Sesli anlatım açık
      </label>
      <label className="flex flex-wrap items-center gap-2">
        <span>Ses</span>
        <select
          aria-label="Ses"
          value={settings.voice ?? ""}
          onChange={(event) => save({ voice: event.target.value || null })}
          className="border-border bg-background h-11 rounded-md border px-2 md:h-9"
        >
          <option value="">Cihazın Türkçe sesi</option>
          {voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-wrap items-center gap-2">
        <span>Hız</span>
        <input
          type="range"
          aria-label="Hız"
          min={0.5}
          max={2}
          step={0.1}
          value={settings.rate}
          onChange={(event) => save({ rate: Number(event.target.value) })}
        />
        <span className="tabular-nums">{settings.rate.toFixed(1)}</span>
      </label>
      <label className="flex min-h-11 items-center gap-2 md:min-h-9">
        <input
          type="checkbox"
          checked={settings.auto}
          onChange={(event) => save({ auto: event.target.checked })}
        />
        Bu cihaz dokunuş olmadan da konuşsun (ikinci ekran için)
      </label>
      <div>
        <Button
          variant="outline"
          className="h-11 md:h-9"
          onClick={() => say("Sesli anlatım açık. Böyle konuşacağım.", { interrupt: true })}
        >
          Dene
        </Button>
      </div>
    </div>
  );
}
