"use client";

import { AiSettings } from "./AiSettings";
import { ConnectionsSettings } from "./ConnectionsSettings";
import { DayFrameSettings } from "./DayFrameSettings";
import { DayRecords } from "./DayRecords";
import { LookSettings } from "./LookSettings";
import { SettingsSection } from "./SettingsShell";
import { VoiceSettings } from "./VoiceSettings";

// The sections of Ayarlar (docs/tasarim/ekranlar/ayarlar.md), each on its page. Their content
// and texts are the code's as before (Ç4b changes the layout only); Görünüm is new.

export function LookSection() {
  return (
    <SettingsSection title="Görünüm">
      <LookSettings />
    </SettingsSection>
  );
}

export function FrameSection() {
  return (
    <SettingsSection title="Günün çerçevesi">
      <DayFrameSettings />
    </SettingsSection>
  );
}

export function RecordsSection() {
  return (
    <SettingsSection title="Uyanış ve yatış kayıtları">
      <DayRecords />
    </SettingsSection>
  );
}

export function VoiceSection() {
  return (
    <SettingsSection title="Sesli anlatım (bu cihaz)">
      <VoiceSettings />
    </SettingsSection>
  );
}

export function AiSection() {
  return (
    <SettingsSection title="Yapay zeka">
      <AiSettings />
    </SettingsSection>
  );
}

export function ConnectionsSection() {
  return (
    <SettingsSection title="Bağlantılar">
      <ConnectionsSettings />
    </SettingsSection>
  );
}
