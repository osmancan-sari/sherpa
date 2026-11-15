"use client";

import type { ModuleBackdropProps } from "@/core/contract/types";

/**
 * Ç4b: the module's own backdrop (docs/06, "Modülün zemini"), behind its page and its scenes: its
 * colour glowing in a corner of the energy tone's dark. Still; the colour is the module's.
 */
export function DenemeBackdrop({ color, device }: ModuleBackdropProps) {
  const at = device === "pano" ? "78% 18%" : "70% 12%";
  return (
    <div
      data-testid="deneme-backdrop"
      className="bg-energy-base absolute inset-0"
      style={{
        background: `radial-gradient(circle at ${at}, color-mix(in oklab, ${color} 34%, var(--color-energy-base)) 0%, var(--color-energy-base) 62%)`,
      }}
    />
  );
}
