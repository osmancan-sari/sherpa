"use client";

import { SwitchRow } from "@/core/ui/kit/Switch";
import { useLook } from "@/core/ui/look/useLook";

/** Ayarlar → Görünüm (docs/tasarim/ekranlar/ayarlar.md): two switches of this device. */
export function LookSettings() {
  const [look, set] = useLook();
  return (
    <div className="flex flex-col">
      <SwitchRow
        label="Saydamlığı azalt"
        description="Paneller düz ve opak olur."
        checked={look.transparency.on}
        onChange={(on) => set("transparency", on)}
      />
      <SwitchRow
        label="Hareketi azalt"
        description="Geçişler anlık olur; gökyüzü kıpırdamaz."
        checked={look.motion.on}
        onChange={(on) => set("motion", on)}
      />
      <p className="text-ink-2 text-note pt-2">
        Cihazın kendi erişilebilirlik tercihi açıksa bunlar kendiliğinden açılır.
      </p>
    </div>
  );
}
