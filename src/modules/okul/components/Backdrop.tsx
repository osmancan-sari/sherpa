"use client";

import type { ModuleBackdropProps } from "@/core/contract/types";

/**
 * Okul's backdrop (okul.md 8.2; frames AnaSayfa, K3T2): dark navy turning petrol downwards, a
 * glow of the work's colour at the top (on the pages the module's own, in a scene the course's).
 * Still; drawn once behind the page and its scenes.
 */
export function OkulBackdrop({ color, device }: ModuleBackdropProps) {
  const glow =
    device === "pano"
      ? "radial-gradient(130% 62% at 50% 0%"
      : "radial-gradient(120% 62% at 50% 22%";
  return (
    <div
      data-testid="okul-backdrop"
      data-color={color}
      className="absolute inset-0"
      style={{
        background: `${glow}, color-mix(in oklab, ${color} 17%, transparent) 0%, transparent 64%), linear-gradient(180deg, var(--color-okul-top) 0%, var(--color-okul-mid) 46%, var(--color-okul-low) 100%)`,
      }}
    />
  );
}
