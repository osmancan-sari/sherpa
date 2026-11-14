// The scene's sky (docs/moduller/rutin.md, 8.5; values: docs/moduller/rutin-cizimler/degerler.md,
// section 1). It follows the clock, not the steps: the sun's height is worked out on the device
// from the date, the time and a fixed place (Istanbul by default); no location, no service. Pure:
// the moment is a parameter. The drawings' frames are measuring points; between them the colours
// are blended by the sun's height.

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

// --- Colours ---------------------------------------------------------------------------------

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as Rgb;
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
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

// --- The drawings' frames ----------------------------------------------------------------------

type Stop = [position: number, color: string];

const stops = (text: string): Stop[] =>
  text.split(",").map((part) => {
    const [color, position] = part.trim().split(/\s+/);
    return [parseFloat(position), color];
  });

/** Phone frames (horizon at about 74%); the board's own stops follow below. */
const NIGHT = stops("#03050f 0%, #060a1f 22%, #0a1030 44%, #0f1840 60%, #16224f 70%, #1c2a5a 74%");
const DAY = stops("#0c1636 0%, #16285a 24%, #27427a 46%, #46669a 60%, #7f95b4 69%, #c2b3a6 73.5%");

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

/**
 * The frames of "Sabah · uçtan uca" at the sun's height of their own clock time: 13 Kasım in
 * Istanbul, 07:00 (Günaydın, -9.5°) to 07:52 (the sun on the horizon); Istanbul keeps UTC+3 all
 * year, so a November sunrise is near 07:50. Below them the night, above them the day of the
 * module page's frames.
 */
const FRAMES: Frame[] = [
  {
    elevation: -18,
    sky: NIGHT,
    glow: 0,
    fog: 0.14,
    far: "#111a40",
    mid: "#0a102a",
    near: "#070a1b",
    nearBottom: "#020309",
    stars: 0,
  },
  {
    elevation: -9.53,
    sky: stops(
      "#060a1c 0%, #0c1230 22%, #171a45 42%, #292359 55%, #45305f 63%, #6f405f 68.5%, #a05a5b 72%, #c97d58 74.5%",
    ),
    glow: 0.3,
    fog: 0.2,
    far: "#5c3a5e",
    mid: "#2e2148",
    near: "#17112c",
    nearBottom: "#0a0814",
    stars: 1,
  },
  {
    elevation: -9.18,
    sky: stops(
      "#060a1d 0%, #0c1231 21.8%, #181a46 41.5%, #2a245a 54.5%, #473160 62.6%, #714160 68.2%, #a35d5c 71.9%, #cb805a 74.5%",
    ),
    glow: 0.31,
    fog: 0.2,
    far: "#5e3b5f",
    mid: "#2f2249",
    near: "#17112c",
    nearBottom: "#0a0814",
    stars: 0.96,
  },
  {
    elevation: -8.47,
    sky: stops(
      "#070b1f 0%, #0d1332 21.3%, #191b48 40.6%, #2c245c 53.5%, #4a3262 61.7%, #754262 67.5%, #a9625d 71.8%, #cf865f 74.4%",
    ),
    glow: 0.33,
    fog: 0.21,
    far: "#623d61",
    mid: "#31234b",
    near: "#18122d",
    nearBottom: "#0a0814",
    stars: 0.88,
  },
  {
    elevation: -5.99,
    sky: stops(
      "#090e25 0%, #101538 19.7%, #1d1e4f 37.4%, #342861 50%, #553669 58.8%, #834869 65.2%, #c07562 71.2%, #dc9d6f 74.1%",
    ),
    glow: 0.42,
    fog: 0.25,
    far: "#724569",
    mid: "#392651",
    near: "#1c1431",
    nearBottom: "#0a0814",
    stars: 0.62,
  },
  {
    elevation: -3.69,
    sky: stops(
      "#0a102b 0%, #12183d 18.2%, #212056 34.4%, #3b2b67 46.8%, #603a6f 56%, #904d70 63.1%, #d48766 70.7%, #e9b17f 73.9%",
    ),
    glow: 0.49,
    fog: 0.28,
    far: "#804c70",
    mid: "#402a57",
    near: "#1f1634",
    nearBottom: "#0a0814",
    stars: 0.37,
  },
  {
    elevation: -3.16,
    sky: stops(
      "#0b112c 0%, #13183f 17.8%, #222158 33.7%, #3c2c68 46%, #623b70 55.4%, #934f71 62.6%, #d98b67 70.6%, #ecb682 73.8%",
    ),
    glow: 0.51,
    fog: 0.28,
    far: "#834d71",
    mid: "#422b59",
    near: "#1f1734",
    nearBottom: "#0a0814",
    stars: 0.31,
  },
  {
    elevation: -0.33,
    sky: stops(
      "#0d1433 0%, #161b45 16%, #272460 30%, #45306f 42%, #6f4078 52%, #a35579 60%, #f2a16c 70%, #fbcf95 73.5%",
    ),
    glow: 0.6,
    fog: 0.32,
    far: "#94567a",
    mid: "#4b2f60",
    near: "#231938",
    nearBottom: "#0a0814",
    stars: 0,
  },
  {
    elevation: 4,
    sky: stops(
      "#0d1433 0%, #161b45 16%, #272460 30%, #45306f 42%, #6f4078 52%, #a35579 60%, #f2a16c 70%, #fbcf95 73.5%",
    ),
    glow: 0.6,
    fog: 0.32,
    far: "#94567a",
    mid: "#4b2f60",
    near: "#231938",
    nearBottom: "#0a0814",
    stars: 0,
  },
  {
    elevation: 15,
    sky: DAY,
    glow: 0,
    fog: 0,
    far: "#62789c",
    mid: "#2d3f66",
    near: "#121a33",
    nearBottom: "#060914",
    stars: 0,
  },
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

export type Sky = {
  /** "night": stars and the night glow; "dawn": the dawn's; "day": neither. */
  phase: "night" | "dawn" | "day";
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
  /** The shade behind the buttons (dawn and day). */
  shade: number;
  /** The sun, when it is up or rising (0 below the horizon, 1 up in the day sky). */
  sun: { visible: boolean; rise: number };
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

/**
 * The sky for a sun height. The evening's scene always has the night sky (8.5: stars from the
 * start, the moon, the owl); the morning's follows the sun.
 */
export function skyOf(elevation: number, evening = false): Sky {
  const e = evening ? -90 : elevation;
  const last = FRAMES.length - 1;
  let mixed;
  if (e <= FRAMES[0].elevation) mixed = blend(FRAMES[0], FRAMES[0], 0);
  else if (e >= FRAMES[last].elevation) mixed = blend(FRAMES[last], FRAMES[last], 0);
  else {
    const i = FRAMES.findIndex((frame) => frame.elevation > e);
    const a = FRAMES[i - 1];
    const b = FRAMES[i];
    mixed = blend(a, b, (e - a.elevation) / (b.elevation - a.elevation));
  }
  // The night's stars fade out as the dawn's come up (between -16° and the Günaydın frame).
  const nightness = clamp((-9.5 - e) / 6.5);
  return {
    phase: e < -12 ? "night" : e < 8 ? "dawn" : "day",
    stops: mixed.stops,
    glow: mixed.glow,
    nightGlow: nightness,
    fog: mixed.fog,
    fogColor: e < -12 ? "#7f97e6" : "#ffc79a",
    far: mixed.far,
    mid: mixed.mid,
    near: mixed.near,
    nearBottom: mixed.nearBottom,
    dawnStars: mixed.stars,
    nightStars: nightness,
    shade: e < -12 ? 0 : 0.5,
    // On the horizon at 07:52 (-0.33°); the hills hide it until it clears them.
    sun: { visible: e > -2, rise: clamp(e / 15) },
    elevation: e,
  };
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
 * The glass's opacity over this sky: the drawing's value, or more where the sky behind the panel
 * is too bright for its text to stay at 4.5:1 (near the horizon at sunrise and in the day). The
 * dawn and the night keep the drawing's values.
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

/** Where the panels sit on the phone's frame, in percent of its height (degerler.md, section 2). */
export const PANEL_RANGE = { big: [32, 56], small: [56, 68] } as const;
