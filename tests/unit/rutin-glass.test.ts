import { describe, expect, it } from "vitest";
import {
  contrast,
  glassAlpha,
  hexToRgb,
  over,
  PANEL_RANGE,
  type Rgb,
  skyColorAt,
  skyOf,
} from "@/core/ui/sky/sky";
import { token } from "@/core/ui/tokens";
import { GLASS, type Tone } from "@/modules/rutin/look";

// Rutin's scene: its text stays readable on the sky, at least 4.5:1 on the dawn, the day and the
// night (rutin.md, criterion 10). Measured on the colours the scene draws with (look.ts, the core's
// sky), where each text sits on the phone's 390 × 844 frame (docs/tasarim/ekranlar/rutin.md).

const rgb = (hex: string): Rgb => hexToRgb(hex);

/** The worst contrast of a text colour over the background between two heights (percent). */
function worst(text: string, background: (position: number) => Rgb, from: number, to: number) {
  let lowest = Infinity;
  for (let p = from; p <= to; p += 1) lowest = Math.min(lowest, contrast(rgb(text), background(p)));
  return lowest;
}

const measure = (label: string, ratio: number) => expect(ratio, label).toBeGreaterThanOrEqual(4.5);

const SKIES: [string, ReturnType<typeof skyOf>, Tone][] = [
  ["dawn", skyOf(-9.53), "sabah"],
  ["sunrise", skyOf(0.5), "sabah"],
  ["day", skyOf(25), "sabah"],
  ["night", skyOf(0, { night: true }), "aksam"],
];

describe("the scene's text on the sky (criterion 10)", () => {
  for (const [name, sky, tone] of SKIES) {
    const glass = GLASS[tone];
    const bare = (p: number) => rgb(skyColorAt(sky, p));
    // The opacity the scene draws the panels with over this sky (sky.ts, glassAlpha).
    const texts = [glass.text, glass.secondary, glass.line, glass.note];
    const bigAlpha = glassAlpha(sky, glass.panel, texts, ...PANEL_RANGE.big);
    const smallAlpha = glassAlpha(sky, glass.small, texts, ...PANEL_RANGE.small);
    const panel = (p: number) => over(bare(p), glass.panel.rgb, bigAlpha);
    const small = (p: number) => over(bare(p), glass.small.rgb, smallAlpha);
    // Below the horizon the near hill (its lighter top colour), with the shade behind the buttons.
    const hill = () => over(rgb(sky.near), hexToRgb(token("sky-shade")), sky.shade * 0.5);
    const skip = () => over(hill(), [255, 255, 255], 0.14);

    it(`is at least 4.5:1 on the ${name}`, () => {
      // The dawn and the night keep the drawing's glass as it is.
      if (name === "dawn" || name === "night") {
        expect([bigAlpha, smallAlpha]).toEqual([glass.panel.alpha, glass.small.alpha]);
      }
      // Title, the big timer, the hint: on the bare sky, from the strip down to the panel.
      measure("title", worst(glass.text, bare, 6, 32));
      measure("hint", worst(glass.note, bare, 6, 32));
      // "Bu adımda": its rows and their notes.
      for (const color of [glass.text, glass.secondary, glass.line, glass.note]) {
        measure(`panel ${color}`, worst(color, panel, 32, 56));
      }
      // "Sıradaki": its rows and the count.
      for (const color of [glass.text, glass.secondary]) {
        measure(`small panel ${color}`, worst(color, small, 56, 68));
      }
      // The buttons on the near hill: "Atla", "Hepsini yaptım", the main button.
      measure("Atla", contrast(rgb(glass.text), skip()));
      measure("Hepsini yaptım", contrast(rgb(glass.plain), hill()));
      // The main button: its text on its own near-opaque fill.
      const fill = (
        token(tone === "sabah" ? "color-warm-button" : "color-cool-button").match(/[\d.]+/g) ?? []
      ).map(Number);
      const button = over(hill(), [fill[0], fill[1], fill[2]], fill[3]);
      measure("main button", contrast(rgb(glass.button.text), button));
    });
  }
});
