"use client";

import { type ReactNode, useId } from "react";
import { token } from "@/core/ui/tokens";
import { boardStops, type Sky } from "./sky";

// The full landscape (docs/tasarim/ilkeler.md, decision 2; frames Hava_*, Rutin's scene): the sky
// by the sun's height, three hills and the mist, the stars, the sun. Today, the scene and sign-in
// stand on it. One SVG over the sky's top and one for the hills, cut to cover the screen and
// standing on its bottom edge: a short screen squeezes the panels, never the landscape. Drawing
// data (positions, paths) lives here; every colour is a token. A module dresses it with its own
// figures (Rutin: the moon and the owl) through `children`, drawn in the sky's coordinates
// (390 × 844 on the phone, 1440 × 900 on the board).

export type Device = "pano" | "telefon";

type Star = [cx: number, cy: number, r: number, base: number];
const parse = (text: string): Star[] =>
  text
    .split("·")
    .map((group) => group.trim().split(/\s+/).map(Number) as Star)
    .filter((star) => star.length === 4);

const DAWN_STARS = parse(
  "26 86 0.8 0.40 · 64 128 0.6 0.30 · 98 74 1.0 0.45 · 142 112 0.6 0.28 · 186 82 0.8 0.35 · 232 148 0.6 0.25 · 262 92 0.7 0.30 · 366 96 0.7 0.30 · 44 170 0.6 0.22 · 378 232 0.6 0.20",
);
const NIGHT_STARS = parse(
  "22 84 0.9 0.7 · 48 132 0.7 0.5 · 70 72 1.3 0.9 · 96 168 0.8 0.55 · 118 104 0.7 0.45 · 140 66 1 0.75 · 182 96 0.7 0.5 · 204 186 0.9 0.6 · 226 74 0.8 0.5 · 64 208 0.6 0.4 · 128 200 0.7 0.5 · 12 150 0.6 0.45 · 104 78 0.5 0.4 · 190 150 0.5 0.35 · 54 100 0.5 0.35 · 168 204 0.5 0.3 · 374 72 0.7 0.4 · 10 262 0.7 0.5 · 382 300 0.7 0.45 · 8 340 0.6 0.4 · 36 498 0.8 0.55 · 176 540 0.8 0.5 · 214 506 1 0.7 · 256 560 0.7 0.45 · 372 566 0.7 0.4 · 230 592 0.6 0.3 · 162 586 0.6 0.3 · 30 548 0.6 0.35",
);
const WARM_STARS = parse("30 196 1.1 0.8 · 292 496 0.7 0.5 · 132 494 0.7 0.45");
const COLD_STARS = parse("216 118 0.7 0.6 · 88 522 1.2 0.85 · 246 204 0.6 0.4");
const BOARD_STARS = parse(
  "70 90 1 0.50 · 160 150 0.8 0.40 · 260 70 1.2 0.60 · 380 130 0.8 0.35 · 470 60 0.9 0.45 · 560 170 0.7 0.30 · 690 90 1 0.50 · 780 150 0.8 0.35 · 900 70 0.9 0.45 · 980 96 0.8 0.40 · 1080 160 0.7 0.30 · 1180 70 1.1 0.55 · 1260 200 0.7 0.30 · 1320 120 0.8 0.40 · 1400 56 0.9 0.45 · 220 260 0.7 0.25 · 1150 300 0.7 0.25 · 620 300 0.6 0.20 · 40 330 0.7 0.25 · 1380 340 0.7 0.25",
);

const HILLS = {
  telefon: {
    far: "M0 644 C40 628 78 620 120 630 C160 639 190 614 236 610 C282 606 318 630 352 624 C370 621 382 616 390 614 L390 844 L0 844 Z",
    mid: "M0 670 C36 656 70 648 112 658 C150 667 186 680 228 668 C270 656 300 640 340 646 C362 649 378 656 390 660 L390 844 L0 844 Z",
    near: "M0 692 C50 676 96 670 150 680 C200 689 250 698 300 684 C336 674 366 670 390 674 L390 844 L0 844 Z",
  },
  pano: {
    far: "M0 724 C160 694 300 684 460 704 C620 724 760 674 940 668 C1120 662 1260 704 1440 680 L1440 900 L0 900 Z",
    mid: "M0 772 C140 748 280 738 440 754 C600 772 740 792 900 768 C1060 744 1200 722 1440 742 L1440 900 L0 900 Z",
    near: "M0 822 C200 797 380 790 600 806 C800 820 1000 834 1200 810 C1320 798 1400 792 1440 796 L1440 900 L0 900 Z",
  },
};

export const SKY_SIZE = {
  telefon: { width: 390, height: 844, horizon: 624, below: 600 },
  pano: { width: 1440, height: 900, horizon: 720, below: 660 },
} as const;

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));

/**
 * Where the sun stands. Rising: on the horizon on the right at -0.33° (Rutin's 07:52), up in the
 * day sky by +16° (Hava_acik: 318, 150). Setting: from the day's place down to the horizon on the
 * left (Hava_batim: 92, 612).
 */
export function sunAt(elevation: number, rising: boolean, board: boolean) {
  const t = clamp(elevation / 15);
  const height = (horizonY: number, top: number, perDegree: number) =>
    Math.max(top, horizonY - perDegree * (elevation + 0.33));
  if (board) {
    const across = rising
      ? 1100 + 110 * clamp((elevation - 6) / 16)
      : 340 + 870 * clamp(elevation / 16);
    return { x: across, y: height(700, 250, 26), body: 30 - 8 * t, halo: 110 - 20 * t };
  }
  const across = rising ? 286 + 32 * clamp((elevation - 6) / 16) : 92 + 226 * clamp(elevation / 16);
  return { x: across, y: height(612, 150, 18.5), body: 24 - 7 * t, halo: 72 - 12 * t };
}

export function Landscape({
  sky,
  device,
  sun: showSun = true,
  shade = false,
  children,
  testId = "sky",
  screen = false,
}: {
  sky: Sky;
  device: Device;
  /** The core's sun (a module drawing its own celestial bodies turns it off). */
  sun?: boolean;
  /** The shade at the bottom, behind a scene's buttons (dawn and day). */
  shade?: boolean;
  /** A module's figures over the sky, in its coordinates. */
  children?: ReactNode;
  testId?: string;
  /**
   * Drawn over the whole screen, not its box: a board's scene beside the menu stands on one sky
   * reaching behind the menu, not on a second landscape inside the page's (the menu keeps over it).
   */
  screen?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const board = device === "pano";
  const { width, height, horizon, below } = SKY_SIZE[device];
  const stops = (board ? boardStops(sky) : sky.stops).map(
    ([position, color]) => [(position * height) / horizon, color] as const,
  );
  const last = stops[stops.length - 1][1];
  const sun = sunAt(sky.elevation, sky.sun.rising, board);
  const dayness = sky.sun.rise;
  const t = token;
  return (
    <div
      aria-hidden
      data-testid={testId}
      data-phase={sky.phase}
      className={`pointer-events-none ${screen ? "fixed" : "absolute"} inset-0 overflow-hidden`}
      style={{ background: last }}
    >
      <svg
        className="absolute inset-x-0 top-0 w-full"
        style={{ height: `${(horizon / height) * 100}%` }}
        viewBox={`0 0 ${width} ${horizon}`}
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            {stops.map(([position, color]) => (
              <stop key={position} offset={`${Math.min(100, position)}%`} stopColor={color} />
            ))}
          </linearGradient>
          <radialGradient id={`${id}-halo`}>
            <stop
              offset="0%"
              stopColor={t(dayness > 0.6 ? "sky-sun-halo" : "sky-sunrise-halo")}
              stopOpacity={dayness > 0.6 ? 0.7 : 0.9}
            />
            <stop
              offset="40%"
              stopColor={t("sky-sunrise-halo-2")}
              stopOpacity={0.4 * (1 - dayness)}
            />
            <stop offset="100%" stopColor={t("sky-sunrise-halo-2")} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-sun`} cx="0.5" cy="0.4" r="0.6">
            <stop offset="0%" stopColor={t("sky-sunrise-core")} />
            <stop offset="60%" stopColor={t(dayness > 0.6 ? "sky-sun" : "sky-sunrise-core-2")} />
            <stop offset="100%" stopColor={t(dayness > 0.6 ? "sky-sun" : "sky-sunrise-core-3")} />
          </radialGradient>
          <radialGradient id={`${id}-brighthalo`}>
            <stop offset="0%" stopColor={t("sky-star-bright-halo")} stopOpacity="0.45" />
            <stop offset="100%" stopColor={t("sky-star-bright-halo")} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-starhalo`}>
            <stop offset="0%" stopColor={t("sky-morning-star-halo")} stopOpacity="0.5" />
            <stop offset="100%" stopColor={t("sky-morning-star-halo")} stopOpacity="0" />
          </radialGradient>
          <filter id={`${id}-blur44`} x="-50%" y="-200%" width="200%" height="500%">
            <feGaussianBlur stdDeviation={board ? 60 : 44} />
          </filter>
          <filter id={`${id}-blur22`} x="-50%" y="-200%" width="200%" height="500%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
          <filter id={`${id}-blur30`} x="-50%" y="-200%" width="200%" height="500%">
            <feGaussianBlur stdDeviation="30" />
          </filter>
        </defs>

        <rect width={width} height={horizon} fill={`url(#${id}-sky)`} />

        {/* The twilight's glow on the horizon. */}
        {sky.glow > 0 ? (
          board ? (
            <ellipse
              cx={800}
              cy={690}
              rx={500}
              ry={80}
              fill={t("sky-board-dawn-glow")}
              fillOpacity={(sky.glow * 0.38) / 0.3}
              filter={`url(#${id}-blur44)`}
            />
          ) : (
            <g>
              <ellipse
                cx={250}
                cy={618}
                rx={220}
                ry={70}
                fill={t("sky-dawn-glow")}
                fillOpacity={sky.glow}
                filter={`url(#${id}-blur44)`}
              />
              <ellipse
                cx={285}
                cy={620}
                rx={95}
                ry={22}
                fill={t("sky-dawn-glow-2")}
                fillOpacity={sky.glow}
                filter={`url(#${id}-blur22)`}
              />
            </g>
          )
        ) : null}
        {/* The night's glow. */}
        {sky.nightGlow > 0 ? (
          board ? (
            <ellipse
              cx={800}
              cy={690}
              rx={500}
              ry={80}
              fill={t("sky-night-glow-2")}
              fillOpacity={0.22 * sky.nightGlow}
              filter={`url(#${id}-blur44)`}
            />
          ) : (
            <g opacity={sky.nightGlow}>
              <ellipse
                cx={200}
                cy={526}
                rx={270}
                ry={40}
                transform="rotate(-10 200 526)"
                fill={t("sky-night-glow")}
                fillOpacity={0.11}
                filter={`url(#${id}-blur30)`}
              />
              <ellipse
                cx={195}
                cy={615}
                rx={235}
                ry={25}
                fill={t("sky-night-glow-2")}
                fillOpacity={0.22}
                filter={`url(#${id}-blur22)`}
              />
            </g>
          )
        ) : null}

        {/* Stars: the dawn's fade with the light; the night's are all there. */}
        {board ? (
          <g fill={t("sky-star")}>
            {BOARD_STARS.map(([cx, cy, r, base], index) => (
              <circle
                key={index}
                cx={cx}
                cy={cy}
                r={r}
                opacity={Math.min(1, base * (sky.dawnStars + 1.5 * sky.nightStars))}
              />
            ))}
            {sky.dawnStars > 0 ? (
              <circle
                cx={1180}
                cy={150}
                r={2.2}
                fill={t("sky-morning-star")}
                opacity={sky.dawnStars}
              />
            ) : null}
          </g>
        ) : (
          <g>
            {sky.dawnStars > 0 ? (
              <g fill={t("sky-star")}>
                {DAWN_STARS.map(([cx, cy, r, base], index) => (
                  <circle key={index} cx={cx} cy={cy} r={r} opacity={base * sky.dawnStars} />
                ))}
                <circle
                  cx={318}
                  cy={142}
                  r={9}
                  fill={`url(#${id}-starhalo)`}
                  opacity={sky.dawnStars}
                />
                <circle
                  cx={318}
                  cy={142}
                  r={1.7}
                  fill={t("sky-morning-star")}
                  opacity={sky.dawnStars}
                />
              </g>
            ) : null}
            {sky.nightStars > 0 ? (
              <g opacity={sky.nightStars}>
                <g fill={t("sky-star")}>
                  {NIGHT_STARS.map(([cx, cy, r, base], index) => (
                    <circle
                      key={index}
                      cx={cx}
                      cy={cy}
                      r={r}
                      opacity={base}
                      className={index % 7 === 0 ? "sky-twinkle" : undefined}
                    />
                  ))}
                </g>
                <g fill={t("sky-star-warm")}>
                  {WARM_STARS.map(([cx, cy, r, base], index) => (
                    <circle key={index} cx={cx} cy={cy} r={r} opacity={base} />
                  ))}
                </g>
                <g fill={t("sky-star-cold")}>
                  {COLD_STARS.map(([cx, cy, r, base], index) => (
                    <circle key={index} cx={cx} cy={cy} r={r} opacity={base} />
                  ))}
                </g>
                <circle cx={158} cy={142} r={7} fill={`url(#${id}-brighthalo)`} />
                <circle cx={158} cy={142} r={1.5} fill={t("sky-star-bright")} />
              </g>
            ) : null}
          </g>
        )}

        {/* The sun, from the horizon up (the hills hide it until it clears them). */}
        {showSun && sky.sun.visible ? (
          <g data-testid={`${testId}-sun`}>
            <circle cx={sun.x} cy={sun.y} r={sun.halo} fill={`url(#${id}-halo)`} />
            <circle cx={sun.x} cy={sun.y} r={sun.body} fill={`url(#${id}-sun)`} />
          </g>
        ) : null}

        {children}
      </svg>
      <Hills sky={sky} device={device} id={id} shade={shade} below={below} />
    </div>
  );
}

function Hills({
  sky,
  device,
  id,
  shade,
  below,
}: {
  sky: Sky;
  device: Device;
  id: string;
  shade: boolean;
  below: number;
}) {
  const board = device === "pano";
  const { width, height } = SKY_SIZE[device];
  const hills = HILLS[device];
  const shadeColor = token("sky-shade");
  return (
    <svg
      className="absolute inset-x-0 bottom-0 w-full"
      // The height is given: an svg's own ratio would win over `bottom`, and a box taller for its
      // width than the drawing (a scene beside the board's menu) showed the sky under the hills.
      style={{ top: `${(below / height) * 100}%`, height: `${((height - below) / height) * 100}%` }}
      viewBox={`0 ${below} ${width} ${height - below}`}
      preserveAspectRatio="xMidYMin slice"
    >
      <defs>
        <linearGradient id={`${id}-near`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky.near} />
          <stop offset="100%" stopColor={sky.nearBottom} />
        </linearGradient>
        <linearGradient id={`${id}-fog`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky.fogColor} stopOpacity="0" />
          <stop offset="50%" stopColor={sky.fogColor} stopOpacity={sky.fog} />
          <stop offset="100%" stopColor={sky.fogColor} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shadeColor} stopOpacity="0" />
          <stop offset="100%" stopColor={shadeColor} stopOpacity={sky.shade} />
        </linearGradient>
      </defs>
      <path d={hills.far} fill={sky.far} />
      {!board && sky.fog > 0 ? (
        <rect x={0} y={610} width={390} height={72} fill={`url(#${id}-fog)`} />
      ) : null}
      <path d={hills.mid} fill={sky.mid} />
      {!board && sky.fog > 0 && sky.phase !== "night" ? (
        <rect x={0} y={648} width={390} height={50} fill={`url(#${id}-fog)`} opacity={0.55} />
      ) : null}
      <path d={hills.near} fill={`url(#${id}-near)`} />
      {!board && shade && sky.shade > 0 ? (
        <rect x={0} y={674} width={390} height={170} fill={`url(#${id}-shade)`} />
      ) : null}
    </svg>
  );
}
