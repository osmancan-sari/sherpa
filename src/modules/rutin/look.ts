// The scene's glass (docs/moduller/rutin-cizimler/degerler.md, section 2: the dark tone), as
// values: the components draw with them and the contrast test measures them. The morning has the
// dawn's warm glass, the evening the night's cool one. Kept in the module until the core has the
// glass language (Rutin step 3, core note 14).

export type Tone = "sabah" | "aksam";

export type Rgba = { rgb: [number, number, number]; alpha: number };

const rgba = (r: number, g: number, b: number, alpha: number): Rgba => ({ rgb: [r, g, b], alpha });
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

export const GLASS: Record<Tone, Glass> = {
  sabah: {
    text: "#f7f5ff",
    secondary: "#d2cfe3",
    stripSecondary: "#d2cfe3",
    line: "#ece7d8",
    note: "#e6e2f2",
    voice: "#dcd9ec",
    accent: "#ffd58a",
    onAccent: "#2a1c05",
    panel: rgba(18, 16, 46, 0.4),
    panelBorder: "rgba(255,255,255,0.26)",
    panelShadow:
      "inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -1px 0 rgba(255,255,255,0.08), 0 14px 36px rgba(8,6,24,0.3)",
    small: rgba(18, 16, 46, 0.32),
    smallBorder: "rgba(255,255,255,0.2)",
    smallShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
    active: rgba(255, 213, 138, 0.2),
    activeShadow: "inset 0 1px 0 rgba(255,255,255,0.22)",
    empty: "rgba(255,255,255,0.24)",
    button: {
      fill: "rgba(255,244,222,0.9)",
      text: "#1a1426",
      border: "rgba(255,255,255,0.7)",
      shadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 28px rgba(0,0,0,0.3)",
    },
    early: {
      fill: "rgba(255,244,222,0.26)",
      text: "#f7f5ff",
      shadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
    },
    skip: { fill: "rgba(255,255,255,0.14)", shadow: "inset 0 1px 0 rgba(255,255,255,0.3)" },
    plain: "#e2ddef",
    boardLabel: "#ffe2ab",
    now: "#ffe2ab",
  },
  aksam: {
    text: "#f4f6ff",
    secondary: "#c6cde8",
    stripSecondary: "#b9c2de",
    line: "#dfe4f6",
    note: "#dfe4f6",
    voice: "#dfe4f6",
    accent: "#aab6ff",
    onAccent: "#0a1030",
    panel: rgba(14, 20, 54, 0.38),
    panelBorder: "rgba(255,255,255,0.22)",
    panelShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 14px 36px rgba(2,4,14,0.35)",
    small: rgba(14, 20, 54, 0.3),
    smallBorder: "rgba(255,255,255,0.18)",
    smallShadow: "inset 0 1px 0 rgba(255,255,255,0.26)",
    active: rgba(170, 182, 255, 0.2),
    activeShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
    empty: "rgba(255,255,255,0.22)",
    button: {
      fill: "rgba(223,229,251,0.9)",
      text: "#0a1030",
      border: "rgba(255,255,255,0.65)",
      shadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 28px rgba(0,0,0,0.35)",
    },
    early: {
      fill: "rgba(223,229,251,0.24)",
      text: "#f4f6ff",
      shadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
    },
    skip: { fill: "rgba(255,255,255,0.12)", shadow: "inset 0 1px 0 rgba(255,255,255,0.28)" },
    plain: "#d5dbf0",
    boardLabel: "#dfe4ff",
    now: "#dfe4ff",
  },
};

/**
 * With "reduce transparency" the panels are drawn opaque (the glass's colour over the darkest of
 * the sky): no blur, no see-through.
 */
export const SOLID: Record<Tone, string> = { sabah: "#1b1934", aksam: "#111834" };
