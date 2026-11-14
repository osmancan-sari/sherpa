import { describe, expect, it } from "vitest";
import { istanbulInstant } from "@/lib/date";
import { GLASS, type Tone } from "./look";
import {
  contrast,
  glassAlpha,
  hexToRgb,
  over,
  PANEL_RANGE,
  type Rgb,
  skyColorAt,
  skyOf,
  sunElevation,
} from "./sky";

// The sky follows the sun (docs/moduller/rutin.md, 8.5; ORTAK.md, section 2), and the scene's text
// stays readable on it: at least 4.5:1 on the dawn, the day and the night (criterion 10). The
// contrast is measured on the colours the scene draws with (look.ts, sky.ts), where each text
// sits on the phone's 390 × 844 frame (degerler.md, section 2).

const at = (day: string, time: string) => istanbulInstant(day, time);

describe("the sun's height", () => {
  it("is near the horizon at an Istanbul November sunrise (about 07:50), high at noon", () => {
    // Istanbul keeps UTC+3 all year: on 13 November the sun rises near 07:50, as in the drawings.
    expect(sunElevation(at("2026-11-13", "07:00"))).toBeCloseTo(-9.5, 0);
    expect(sunElevation(at("2026-11-13", "07:52"))).toBeGreaterThan(-1);
    expect(sunElevation(at("2026-11-13", "07:52"))).toBeLessThan(0.5);
    expect(sunElevation(at("2026-11-13", "12:50"))).toBeGreaterThan(29);
    expect(sunElevation(at("2026-11-13", "12:50"))).toBeLessThan(33);
    expect(sunElevation(at("2026-11-14", "00:00"))).toBeLessThan(-50);
    // Summer: the same 07:00 has the sun well up.
    expect(sunElevation(at("2026-06-21", "07:00"))).toBeGreaterThan(10);
    expect(sunElevation(at("2026-06-21", "13:10"))).toBeGreaterThan(70);
  });

  it("moves the sky: a winter 07:00 is dawn, a summer 07:00 is day, the evening is night", () => {
    expect(skyOf(sunElevation(at("2026-11-13", "07:00"))).phase).toBe("dawn");
    expect(skyOf(sunElevation(at("2026-06-21", "07:00"))).phase).toBe("day");
    expect(skyOf(sunElevation(at("2026-11-13", "05:30"))).phase).toBe("night");
    expect(skyOf(30, true).phase).toBe("night");
    // The dawn's frames: stars fade as the sun comes up, the sun shows from the horizon.
    expect(skyOf(-9.53).dawnStars).toBe(1);
    expect(skyOf(-3.69).dawnStars).toBeCloseTo(0.37);
    expect(skyOf(-3.69).sun.visible).toBe(false);
    expect(skyOf(0.2).sun.visible).toBe(true);
    // The frame's own colours at its measuring point.
    expect(skyOf(-9.53).stops[0][1]).toBe("#060a1c");
    expect(skyOf(30).stops.at(-1)![1]).toBe("#c2b3a6");
  });
});

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
  ["night", skyOf(0, true), "aksam"],
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
    const hill = () => over(rgb(sky.near), [8, 6, 20], sky.shade * 0.5);
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
      measure("main button", contrast(rgb(glass.button.text), rgb("#fff4de")));
    });
  }
});
