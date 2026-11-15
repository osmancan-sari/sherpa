import { token, type TokenName } from "@/core/ui/tokens";

// The scene's glass (docs/tasarim/ekranlar/rutin.md; the dark tone of the morning and the
// evening), as values the components draw with and the contrast test measures. The morning has the
// dawn's warm glass, the evening the night's cool one. Every value is a token (--color-warm-*,
// --color-cool-*, --color-scene-*, --shadow-*).

export type Tone = "sabah" | "aksam";

export type Rgba = { rgb: [number, number, number]; alpha: number };

/** A token holding "rgba(r, g, b, a)" (or "#rrggbb") as numbers. */
function rgbaOf(name: TokenName): Rgba {
  const value = token(name);
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    return {
      rgb: [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgba["rgb"],
      alpha: 1,
    };
  }
  const [r, g, b, a = 1] = (value.match(/[\d.]+/g) ?? []).map(Number);
  return { rgb: [r, g, b], alpha: a };
}

/** An Rgba back to CSS, for an opacity worked out at run time (the glass over a bright sky). */
export const css = ({ rgb: [r, g, b], alpha }: Rgba) => `rgba(${r},${g},${b},${alpha})`;

export type Glass = {
  text: string;
  secondary: string;
  stripSecondary: string;
  line: string;
  note: string;
  voice: string;
  accent: string;
  onAccent: string;
  /** "Bu adımda": the big panel. */
  panel: Rgba;
  panelBorder: string;
  panelShadow: string;
  /** "Sıradaki": the small one. */
  small: Rgba;
  smallBorder: string;
  smallShadow: string;
  active: Rgba;
  activeShadow: string;
  empty: string;
  button: { fill: string; text: string; border: string; shadow: string };
  early: { fill: string; text: string; shadow: string };
  skip: { fill: string; shadow: string };
  plain: string;
  /** The label above the board's day plan ("GÜNÜN PLANI OKUNUYOR", "YARIN"). */
  boardLabel: string;
  now: string;
};

const v = (name: TokenName) => `var(--${name})`;

export const GLASS: Record<Tone, Glass> = {
  sabah: {
    text: token("color-warm-ink"),
    secondary: token("color-warm-ink-2"),
    stripSecondary: token("color-warm-ink-2"),
    line: token("color-warm-line"),
    note: token("color-warm-note"),
    voice: token("color-warm-voice"),
    accent: token("color-warm-accent"),
    onAccent: token("color-warm-on-accent"),
    panel: rgbaOf("color-warm-panel"),
    panelBorder: v("color-scene-edge"),
    panelShadow: v("shadow-warm-panel"),
    small: rgbaOf("color-warm-small"),
    smallBorder: v("color-scene-small-edge"),
    smallShadow: v("shadow-warm-small"),
    active: rgbaOf("color-warm-active"),
    activeShadow: v("shadow-scene-active"),
    empty: v("color-scene-empty"),
    button: {
      fill: v("color-warm-button"),
      text: token("color-warm-on-button"),
      border: v("color-edge-light"),
      shadow: v("shadow-scene-button"),
    },
    early: {
      fill: v("color-warm-early"),
      text: v("color-warm-ink"),
      shadow: v("shadow-scene-early"),
    },
    skip: { fill: v("color-scene-skip"), shadow: v("shadow-button") },
    plain: token("color-warm-plain"),
    boardLabel: v("color-warm-label"),
    now: v("color-warm-label"),
  },
  aksam: {
    text: token("color-cool-ink"),
    secondary: token("color-cool-ink-2"),
    stripSecondary: token("color-cool-strip"),
    line: token("color-cool-line"),
    note: token("color-cool-line"),
    voice: token("color-cool-line"),
    accent: token("color-cool-accent"),
    onAccent: token("color-cool-on-accent"),
    panel: rgbaOf("color-cool-panel"),
    panelBorder: v("color-scene-edge-night"),
    panelShadow: v("shadow-cool-panel"),
    small: rgbaOf("color-cool-small"),
    smallBorder: v("color-scene-small-edge-night"),
    smallShadow: v("shadow-cool-small"),
    active: rgbaOf("color-cool-active"),
    activeShadow: v("shadow-scene-active"),
    empty: v("color-scene-empty-night"),
    button: {
      fill: v("color-cool-button"),
      text: token("color-cool-on-accent"),
      border: v("color-edge-light-night"),
      shadow: v("shadow-scene-button-night"),
    },
    early: {
      fill: v("color-cool-early"),
      text: v("color-cool-ink"),
      shadow: v("shadow-scene-early"),
    },
    skip: { fill: v("color-scene-skip-night"), shadow: v("shadow-soft") },
    plain: token("color-cool-plain"),
    boardLabel: v("color-cool-label"),
    now: v("color-cool-label"),
  },
};

/**
 * With "reduce transparency" the panels are drawn opaque (the glass's colour over the darkest of
 * the sky): no blur, no see-through.
 */
export const SOLID: Record<Tone, string> = {
  sabah: v("color-warm-solid"),
  aksam: v("color-cool-solid"),
};
