import { describe, expect, it } from "vitest";
import { istanbulInstant } from "@/lib/date";
import { token, type TokenName } from "@/core/ui/tokens";
import {
  calmStops,
  colorAt,
  contrast,
  glassAlpha,
  hexToRgb,
  LANDSCAPE_PANELS,
  over,
  parseColor,
  type Rgb,
  skyColorAt,
  skyOf,
  stopsOf,
  sunElevation,
  sunRising,
} from "./sky";

// The sky follows the sun (docs/tasarim/ilkeler.md, "Gökyüzü"); the glass's text stays readable on
// it at every hour: at least 4.5:1 in the four states (dawn, day, sunset, night), measured on the
// colours the screens draw with (tokens.css). Rutin's scene has its own test
// (tests/unit/rutin-glass.test.ts).

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
    expect(skyOf(30, { night: true }).phase).toBe("night");
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

describe("the evening and the calm backdrop", () => {
  it("sets through the sunset frame and keeps the morning's for the dawn", () => {
    const sunset = skyOf(-0.33, { rising: false });
    expect(sunset.phase).toBe("dusk");
    expect(sunset.stops[0][1]).toBe(stopsOf("sky-sunset")[0][1]);
    expect(sunset.dawnStars).toBe(0);
    expect(skyOf(-0.33).stops[0][1]).toBe(stopsOf("sky-sunrise")[0][1]);
    // Afternoon and evening on a November day in Istanbul.
    expect(sunRising(at("2026-11-13", "09:00"))).toBe(true);
    expect(sunRising(at("2026-11-13", "15:00"))).toBe(false);
  });

  it("is the sky's upper colours stretched over the screen, as HavaSakin_* draws them", () => {
    // HavaSakin_gece: #03050f 0%, #060a1f 36%, #0a1030 72%, #0e1638 100%.
    const night = calmStops(skyOf(-30));
    expect(night.map(([p]) => p)).toEqual([0, 34, 68, 100]);
    expect(night[0][1]).toBe("#03050f");
    expect(night[1][1]).toBe("#060a1f");
    // HavaSakin_acik: #0c1636 0%, #16285a 34%, #27427a 70%, #3a5890 100%.
    const day = calmStops(skyOf(30));
    expect(day[0][1]).toBe("#0c1636");
    for (const [i, hex] of [
      [2, "#27427a"],
      [3, "#3a5890"],
    ] as const) {
      const [a, b] = [hexToRgb(day[i][1]), hexToRgb(hex)];
      expect(Math.max(...a.map((c, k) => Math.abs(c - b[k]))), `${i}`).toBeLessThan(14);
    }
  });
});

// --- Contrast of the glass's text in the four states -------------------------------------------

const rgbOf = (name: TokenName) => parseColor(token(name));
const through = (behind: Rgb, layer: TokenName) => {
  const { rgb, alpha } = rgbOf(layer);
  return over(behind, rgb, alpha);
};

const STATES: [string, ReturnType<typeof skyOf>][] = [
  ["dawn", skyOf(-9.53)],
  ["day", skyOf(25, { rising: false })],
  ["sunset", skyOf(-0.33, { rising: false })],
  ["night", skyOf(-30)],
];

const TEXTS: TokenName[] = ["color-ink", "color-ink-2"];

describe("text on the glass stays at least 4.5:1 in the four states", () => {
  for (const [name, sky] of STATES) {
    const calm = calmStops(sky);
    const calmAt = (p: number) => hexToRgb(colorAt(calm, p));

    it(`on the calm backdrop at ${name}`, () => {
      for (let p = 0; p <= 100; p += 2) {
        for (const layer of [
          "color-glass-dense",
          "color-glass-soft",
          "color-glass-main",
        ] as const) {
          const behind = through(calmAt(p), layer);
          for (const text of TEXTS) {
            expect(
              contrast(rgbOf(text).rgb, behind),
              `${text} on ${layer} at ${p}%`,
            ).toBeGreaterThanOrEqual(4.5);
          }
          // A field's text inside a panel.
          const field = through(behind, "color-fill-field");
          expect(contrast(rgbOf("color-ink").rgb, field)).toBeGreaterThanOrEqual(4.5);
          // The states, each with its icon too.
          for (const state of ["color-ok", "color-attention", "color-behind"] as const) {
            expect(contrast(rgbOf(state).rgb, behind), `${state} at ${p}%`).toBeGreaterThanOrEqual(
              4.5,
            );
          }
        }
        // Text straight on the backdrop: page titles, the line under a panel.
        for (const text of TEXTS) {
          expect(
            contrast(rgbOf(text).rgb, calmAt(p)),
            `${text} bare at ${p}%`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        // The menus over it: the phone's bar and the board's rail.
        for (const menu of ["color-glass-nav", "color-glass-rail"] as const) {
          const behind = through(calmAt(p), menu);
          expect(
            contrast(rgbOf("color-ink-nav").rgb, behind),
            `nav on ${menu}`,
          ).toBeGreaterThanOrEqual(4.5);
          expect(contrast(rgbOf("color-ink").rgb, behind)).toBeGreaterThanOrEqual(4.5);
        }
        for (const layer of [
          "color-glass-dense",
          "color-glass-soft",
          "color-glass-main",
        ] as const) {
          const panel = through(calmAt(p), layer);
          // A state pill: its colour on dark glass inside the panel.
          const pill = through(panel, "color-glass-dense");
          for (const state of ["color-ok", "color-attention", "color-behind"] as const) {
            expect(
              contrast(rgbOf(state).rgb, pill),
              `${state} pill in ${layer} at ${p}%`,
            ).toBeGreaterThanOrEqual(4.5);
          }
          // An unselected segment and a chip's text, on their faint fill.
          const chip = through(panel, "color-fill-chip");
          expect(
            contrast(rgbOf("color-ink-soft").rgb, chip),
            `segment in ${layer}`,
          ).toBeGreaterThanOrEqual(4.5);
          // A placeholder in a field.
          const field = through(panel, "color-fill-field");
          expect(
            contrast(rgbOf("color-ink-3").rgb, field),
            `placeholder in ${layer} at ${p}%`,
          ).toBeGreaterThanOrEqual(4.5);
          // The danger button's text on its coral fill.
          const danger = through(panel, "color-behind-fill");
          expect(contrast(rgbOf("color-ink-danger").rgb, danger)).toBeGreaterThanOrEqual(4.5);
          // The disabled button may be faint, yet readable (3:1, WCAG's floor for inactive parts).
          const quiet = through(panel, "color-fill-quiet");
          expect(contrast(rgbOf("color-ink-off").rgb, quiet)).toBeGreaterThanOrEqual(3);
        }
      }
    });

    it(`on the full landscape at ${name}: the main panel deepens where the sky is bright`, () => {
      const { rgb, alpha } = rgbOf("color-glass-main");
      const deep = glassAlpha(
        sky,
        { rgb, alpha },
        TEXTS.map((t) => token(t)),
        ...LANDSCAPE_PANELS,
      );
      expect(deep).toBeGreaterThanOrEqual(alpha);
      for (let p = LANDSCAPE_PANELS[0]; p <= LANDSCAPE_PANELS[1]; p += 1) {
        const behind = over(hexToRgb(skyColorAt(sky, p)), rgb, deep);
        for (const text of TEXTS) {
          expect(contrast(rgbOf(text).rgb, behind), `${text} at ${p}%`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }

  it("the opaque light carries dark text, the solid panel light text", () => {
    const light = through(hexToRgb(token("color-solid")), "color-light");
    expect(contrast(rgbOf("color-ink-dark").rgb, light)).toBeGreaterThanOrEqual(4.5);
    for (const text of TEXTS) {
      expect(contrast(rgbOf(text).rgb, hexToRgb(token("color-solid")))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
