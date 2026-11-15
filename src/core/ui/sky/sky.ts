import { token, type TokenName } from "@/core/ui/tokens";

// The sky (docs/tasarim/ilkeler.md, "Gökyüzü"; decisions 1b and 2). It follows the clock: the
// sun's height is worked out on the device from the date, the time and a fixed place (Istanbul
// by default); no location, no weather, no service. Pure: the moment is a parameter. The approved
// frames are measuring points (their colours are tokens: --sky-*); between them the colours blend
// by the sun's height. The morning rises through the dawn's frames, the evening sets through the
// sunset's. The calm backdrop of every screen but Today, the scene and sign-in is the same sky's
// upper colours stretched over the screen.

/** Istanbul: the default place (docs/09-kararlar.md, 14 Kas 2026). */
export const ISTANBUL = { lat: 41.01, lon: 28.98 };

const RAD = Math.PI / 180;

/**
 * The sun's height above the horizon in degrees (negative below it), from the usual low-precision
 * formulas (about a tenth of a degree; enough for a sky).
 */
export function sunElevation(at: Date, place = ISTANBUL): number {
  const days = at.getTime() / 86_400_000 + 2440587.5 - 2451545.0;
  const anomaly = (357.529 + 0.98560028 * days) * RAD;
  const meanLongitude = 280.459 + 0.98564736 * days;
  const longitude =
    (meanLongitude + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RAD;
  const obliquity = (23.439 - 0.00000036 * days) * RAD;
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude));
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(longitude));
  const siderealHours = 18.697374558 + 24.06570982441908 * days;
  const hourAngle = (siderealHours * 15 + place.lon) * RAD - rightAscension;
  const lat = place.lat * RAD;
  return (
    Math.asin(
      Math.sin(lat) * Math.sin(declination) +
        Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle),
    ) / RAD
  );
}

/** Whether the sun is on its way up (morning) at this moment. */
export function sunRising(at: Date, place = ISTANBUL): boolean {
  return sunElevation(new Date(at.getTime() + 10 * 60_000), place) > sunElevation(at, place);
}

// --- Colours ---------------------------------------------------------------------------------

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as Rgb;
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** "rgba(14, 18, 44, 0.5)" → its colour and opacity; "#rrggbb" → opaque. */
export function parseColor(value: string): { rgb: Rgb; alpha: number } {
  if (value.startsWith("#")) return { rgb: hexToRgb(value), alpha: 1 };
  const [r, g, b, a = 1] = (value.match(/[\d.]+/g) ?? []).map(Number);
  return { rgb: [r, g, b], alpha: a };
}

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as Rgb);
}

/** A colour seen through a translucent layer of another (alpha of the layer). */
export function over(base: Rgb, layer: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map((i) => layer[i] * alpha + base[i] * (1 - alpha)) as Rgb;
}

/** WCAG relative luminance. */
export function luminance([r, g, b]: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio of two colours. */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// --- The frames ----------------------------------------------------------------------------

export type Stop = [position: number, color: string];

/** A token holding a gradient's stops ("#03050f 0%, #060a1f 22%, …"). */
export function stopsOf(name: TokenName): Stop[] {
  return token(name)
    .split(",")
    .map((part) => {
      const [color, position] = part.trim().split(/\s+/);
      return [parseFloat(position), color] as Stop;
    });
}

type Frame = {
  /** The sun's height this frame stands for. */
  elevation: number;
  sky: Stop[];
  glow: number;
  fog: number;
  far: string;
  mid: string;
  near: string;
  nearBottom: string;
  /** The dawn stars' opacity multiplier. */
  stars: number;
};

const frame = (
  elevation: number,
  name: string,
  numbers: { glow: number; fog: number; stars: number },
  nearBottom: TokenName,
): Frame => ({
  elevation,
  sky: stopsOf(`sky-${name}` as TokenName),
  far: token(`sky-${name}-far` as TokenName),
  mid: token(`sky-${name}-mid` as TokenName),
  near: token(`sky-${name}-near` as TokenName),
  nearBottom: token(nearBottom),
  ...numbers,
});

/**
 * The morning: Rutin's "Sabah · uçtan uca" frames (13 November in Istanbul, 07:00 to the sun on
 * the horizon at 07:52) at the sun's height of their own clock time; below them the night, above
 * them the day.
 */
const NIGHT = frame(-18, "night", { glow: 0, fog: 0.14, stars: 0 }, "sky-night-near-bottom");
const DAY = frame(15, "day", { glow: 0, fog: 0, stars: 0 }, "sky-day-near-bottom");
const DAWN = "sky-dawn-near-bottom";
const MORNING: Frame[] = [
  NIGHT,
  frame(-9.53, "dawn-0700", { glow: 0.3, fog: 0.2, stars: 1 }, DAWN),
  frame(-9.18, "dawn-0702", { glow: 0.31, fog: 0.2, stars: 0.96 }, DAWN),
  frame(-8.47, "dawn-0706", { glow: 0.33, fog: 0.21, stars: 0.88 }, DAWN),
  frame(-5.99, "dawn-0720", { glow: 0.42, fog: 0.25, stars: 0.62 }, DAWN),
  frame(-3.69, "dawn-0733", { glow: 0.49, fog: 0.28, stars: 0.37 }, DAWN),
  frame(-3.16, "dawn-0736", { glow: 0.51, fog: 0.28, stars: 0.31 }, DAWN),
  frame(-0.33, "sunrise", { glow: 0.6, fog: 0.32, stars: 0 }, DAWN),
  { ...frame(4, "sunrise", { glow: 0.6, fog: 0.32, stars: 0 }, DAWN) },
  DAY,
];

/**
 * The evening: the sunset frame ("Gün batımı", the sun on the horizon) between the day and the
 * night. "Görüşün gerek": one drawn frame stands for the whole dusk.
 */
const SUNSET = frame(
  -0.33,
  "sunset",
  { glow: 0.45, fog: 0.26, stars: 0 },
  "sky-sunset-near-bottom",
);
const EVENING: Frame[] = [
  NIGHT,
  { ...SUNSET, elevation: -9 },
  SUNSET,
  { ...SUNSET, elevation: 3 },
  DAY,
];

/** The colour of a gradient at a position (0–100), the last stop going on below the horizon. */
export function colorAt(sky: Stop[], position: number): string {
  if (position <= sky[0][0]) return sky[0][1];
  for (let i = 1; i < sky.length; i++) {
    const [p, c] = sky[i];
    if (position <= p) {
      const [q, d] = sky[i - 1];
      return mix(d, c, (position - q) / (p - q));
    }
  }
  return sky[sky.length - 1][1];
}

/** Positions the blended gradient is drawn with: dense near the horizon, where the colours move. */
const SAMPLES = [0, 10, 20, 30, 40, 48, 54, 60, 64, 68, 70, 72, 74];

export type Phase = "night" | "dawn" | "day" | "dusk";

export type Sky = {
  /** "night": stars and the night glow; "dawn"/"dusk": the horizon's glow; "day": neither. */
  phase: Phase;
  /** The gradient on the phone (horizon at 74%). */
  stops: Stop[];
  glow: number;
  nightGlow: number;
  fog: number;
  fogColor: string;
  far: string;
  mid: string;
  near: string;
  nearBottom: string;
  /** Opacity multipliers of the dawn stars and the night stars. */
  dawnStars: number;
  nightStars: number;
  /** The shade behind a scene's buttons (dawn and day). */
  shade: number;
  /** The sun, when it is up or near it (0 below the horizon, 1 up in the day sky). */
  sun: { visible: boolean; rise: number; rising: boolean };
  elevation: number;
};

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));

function blend(a: Frame, b: Frame, t: number) {
  return {
    stops: SAMPLES.map((p): Stop => [p, mix(colorAt(a.sky, p), colorAt(b.sky, p), t)]),
    glow: a.glow + (b.glow - a.glow) * t,
    fog: a.fog + (b.fog - a.fog) * t,
    far: mix(a.far, b.far, t),
    mid: mix(a.mid, b.mid, t),
    near: mix(a.near, b.near, t),
    nearBottom: mix(a.nearBottom, b.nearBottom, t),
    stars: a.stars + (b.stars - a.stars) * t,
  };
}

function along(frames: Frame[], e: number) {
  const last = frames.length - 1;
  if (e <= frames[0].elevation) return blend(frames[0], frames[0], 0);
  if (e >= frames[last].elevation) return blend(frames[last], frames[last], 0);
  const i = frames.findIndex((f) => f.elevation > e);
  const a = frames[i - 1];
  const b = frames[i];
  return blend(a, b, (e - a.elevation) / (b.elevation - a.elevation));
}

/**
 * The sky for a sun height; `rising` picks the morning's frames or the evening's. `night` forces
 * the night (Rutin's evening scene: stars from the start, whatever the clock says).
 */
export function skyOf(elevation: number, options: { rising?: boolean; night?: boolean } = {}): Sky {
  const rising = options.rising ?? true;
  const e = options.night ? -90 : elevation;
  const mixed = along(rising ? MORNING : EVENING, e);
  // The night's stars fade out as the twilight comes (between -16° and -9.5°).
  const nightness = clamp((-9.5 - e) / 6.5);
  const twilight = e < -12 ? "night" : e < 8 ? (rising ? "dawn" : "dusk") : "day";
  return {
    phase: twilight,
    stops: mixed.stops,
    glow: mixed.glow,
    nightGlow: nightness,
    fog: mixed.fog,
    fogColor: token(e < -12 ? "sky-night-fog" : "sky-dawn-fog"),
    far: mixed.far,
    mid: mixed.mid,
    near: mixed.near,
    nearBottom: mixed.nearBottom,
    dawnStars: rising ? mixed.stars : 0,
    nightStars: nightness,
    shade: e < -12 ? 0 : 0.5,
    // On the horizon at -0.33°; the hills hide it until it clears them.
    sun: { visible: e > -2, rise: clamp(e / 15), rising },
    elevation: e,
  };
}

/** The sky at a moment. */
export function skyAt(at: Date, place = ISTANBUL): Sky {
  return skyOf(sunElevation(at, place), { rising: sunRising(at, place) });
}

/** The board's gradient: the same colours, the horizon at 80% (degerler.md, section 5). */
export function boardStops(sky: Sky): Stop[] {
  return sky.stops.map(([p, c]): Stop => [Math.round((p / 74) * 80 * 10) / 10, c]);
}

/** The colour of the sky (or the near hill below it) at a height of the screen, in percent. */
export function skyColorAt(sky: Sky, position: number): string {
  return colorAt(sky.stops, position);
}

/**
 * The calm backdrop: the sky's upper colours (0, 22, 42 and 55% of the full sky) stretched over
 * the screen (0, 34, 68, 100%), as the frames HavaSakin_* draw it.
 */
export const CALM_SAMPLES: readonly [from: number, to: number][] = [
  [0, 0],
  [22, 34],
  [42, 68],
  [55, 100],
];

export function calmStops(sky: Sky): Stop[] {
  return CALM_SAMPLES.map(([from, to]): Stop => [to, skyColorAt(sky, from)]);
}

export const gradient = (stops: Stop[]) =>
  `linear-gradient(180deg, ${stops.map(([p, c]) => `${c} ${p}%`).join(", ")})`;

/**
 * The glass's opacity over this sky: the drawing's value, or more where the sky behind the panel
 * is too bright for its text to stay at 4.5:1 (near the horizon at sunrise and in the day).
 */
export function glassAlpha(
  sky: Sky,
  glass: { rgb: Rgb; alpha: number },
  texts: string[],
  from: number,
  to: number,
): number {
  const enough = (alpha: number) => {
    for (let p = from; p <= to; p += 1) {
      const behind = over(hexToRgb(skyColorAt(sky, p)), glass.rgb, alpha);
      if (texts.some((text) => contrast(hexToRgb(text), behind) < 4.5)) return false;
    }
    return true;
  };
  let alpha = glass.alpha;
  while (alpha < 0.95 && !enough(alpha)) alpha = Math.round((alpha + 0.02) * 100) / 100;
  return alpha;
}

/**
 * Where the panels over the full landscape sit on the phone's frame, in percent of its height
 * (Today's cards, the sign-in panel): the main glass deepens over this band when the sky behind
 * is too bright (Backdrop sets it).
 */
export const LANDSCAPE_PANELS = [6, 72] as const;

/** Where a scene's panels sit on the phone's frame, in percent of its height (degerler.md, 2). */
export const PANEL_RANGE = { big: [32, 56], small: [56, 68] } as const;
