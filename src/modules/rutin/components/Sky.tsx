"use client";

import { useId } from "react";
import { boardStops, type Sky as SkyState } from "../sky";

// The scene's background (degerler.md, section 1 and 5): the sky by the sun's height, the three
// hills and the mist, the dawn's stars and the morning star, the sun; in the evening the night's
// stars, the moon on the right and the owl on its branch. One SVG, cut to cover the scene and
// standing on its bottom edge. Almost still: a few stars shimmer, never with reduced motion.

type Props = {
  sky: SkyState;
  device: "pano" | "telefon";
  evening: boolean;
  /** "İyi geceler": the owl's eyes are closed. */
  owlAsleep?: boolean;
};

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

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));

/** Where the sun stands: on the horizon at -0.33° (07:52), up in the day sky by +16°. */
function sunAt(elevation: number, board: boolean) {
  const across = clamp((elevation - 6) / 16);
  const t = clamp(elevation / 15);
  if (board) {
    return {
      x: 1100 + 110 * across,
      y: Math.max(250, 700 - 26 * (elevation + 0.33)),
      body: 30 - 8 * t,
      halo: 110 - 20 * t,
    };
  }
  return {
    x: 286 + 32 * across,
    y: Math.max(150, 612 - 18.5 * (elevation + 0.33)),
    body: 24 - 7 * t,
    halo: 72 - 12 * t,
  };
}

export function Sky({ sky, device, evening, owlAsleep = false }: Props) {
  const id = useId().replaceAll(":", "");
  const board = device === "pano";
  const width = board ? 1440 : 390;
  const height = board ? 900 : 844;
  // The horizon: the sky above it is cut to the screen's width and always ends at the same
  // height (74% on the phone, 80% on the board); the hills fill the band below it. A short screen
  // squeezes the panels, never the landscape.
  const horizon = board ? 720 : 624;
  const below = board ? 660 : 600;
  const hills = HILLS[device];
  const stops = (board ? boardStops(sky) : sky.stops).map(
    ([position, color]) => [(position * height) / horizon, color] as const,
  );
  const last = stops[stops.length - 1][1];
  const sun = sunAt(sky.elevation, board);
  const dayness = sky.sun.rise;
  return (
    <div
      aria-hidden
      data-testid="rutin-sky"
      data-phase={sky.phase}
      className="pointer-events-none absolute inset-0"
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
            <stop offset="0%" stopColor="#080614" stopOpacity="0" />
            <stop offset="100%" stopColor="#080614" stopOpacity={sky.shade} />
          </linearGradient>
          <radialGradient id={`${id}-halo`}>
            <stop offset="0%" stopColor={dayness > 0.6 ? "#fff6d8" : "#fff3cf"} stopOpacity="0.9" />
            <stop offset="40%" stopColor="#ffdc9c" stopOpacity={0.4 * (1 - dayness)} />
            <stop offset="100%" stopColor="#ffdc9c" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-sun`} cx="0.5" cy="0.4" r="0.6">
            <stop offset="0%" stopColor="#fffbe8" />
            <stop offset="60%" stopColor={dayness > 0.6 ? "#fff8e0" : "#ffe7ad"} />
            <stop offset="100%" stopColor={dayness > 0.6 ? "#fff8e0" : "#ffc878"} />
          </radialGradient>
          <radialGradient id={`${id}-moonhalo`}>
            <stop offset="0%" stopColor="#b9c8ff" stopOpacity="0.42" />
            <stop offset="45%" stopColor="#9fb2ff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#9fb2ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-moon`} cx="0.38" cy="0.34" r="0.75">
            <stop offset="0%" stopColor="#fdfdff" />
            <stop offset="55%" stopColor="#e4e9f8" />
            <stop offset="100%" stopColor="#b4bfe2" />
          </radialGradient>
          <radialGradient id={`${id}-brighthalo`}>
            <stop offset="0%" stopColor="#dfe6ff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#dfe6ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-starhalo`}>
            <stop offset="0%" stopColor="#fff4e0" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#fff4e0" stopOpacity="0" />
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

        {/* The dawn's glow on the horizon. */}
        {sky.glow > 0 ? (
          board ? (
            <ellipse
              cx={800}
              cy={690}
              rx={500}
              ry={80}
              fill={`rgba(255,160,104,${(sky.glow * 0.38) / 0.3})`}
              filter={`url(#${id}-blur44)`}
            />
          ) : (
            <g>
              <ellipse
                cx={250}
                cy={618}
                rx={220}
                ry={70}
                fill={`rgba(255,170,110,${sky.glow})`}
                filter={`url(#${id}-blur44)`}
              />
              <ellipse
                cx={285}
                cy={620}
                rx={95}
                ry={22}
                fill={`rgba(255,210,155,${sky.glow})`}
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
              fill={`rgba(96,124,210,${0.22 * sky.nightGlow})`}
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
                fill="rgba(112,132,224,0.11)"
                filter={`url(#${id}-blur30)`}
              />
              <ellipse
                cx={195}
                cy={615}
                rx={235}
                ry={25}
                fill="rgba(96,124,210,0.22)"
                filter={`url(#${id}-blur22)`}
              />
            </g>
          )
        ) : null}

        {/* Stars: the dawn's fade with the light; the night's are all there. */}
        {board ? (
          <g fill="#e8ecff" className="rutin-stars">
            {BOARD_STARS.map(([cx, cy, r, base], index) => (
              <circle
                key={index}
                cx={cx}
                cy={cy}
                r={r}
                opacity={Math.min(1, base * (sky.dawnStars + 1.5 * sky.nightStars))}
                className={index % 6 === 0 ? "rutin-twinkle" : undefined}
              />
            ))}
            {sky.dawnStars > 0 ? (
              <circle cx={1180} cy={150} r={2.2} fill="#fff6e6" opacity={sky.dawnStars} />
            ) : null}
          </g>
        ) : (
          <g className="rutin-stars">
            {sky.dawnStars > 0 ? (
              <g fill="#e8ecff">
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
                <circle cx={318} cy={142} r={1.7} fill="#fff6e6" opacity={sky.dawnStars} />
              </g>
            ) : null}
            {sky.nightStars > 0 ? (
              <g opacity={sky.nightStars}>
                <g fill="#e8ecff">
                  {NIGHT_STARS.map(([cx, cy, r, base], index) => (
                    <circle
                      key={index}
                      cx={cx}
                      cy={cy}
                      r={r}
                      opacity={base}
                      className={index % 7 === 0 ? "rutin-twinkle" : undefined}
                    />
                  ))}
                </g>
                <g fill="#ffe9c9">
                  {WARM_STARS.map(([cx, cy, r, base], index) => (
                    <circle key={index} cx={cx} cy={cy} r={r} opacity={base} />
                  ))}
                </g>
                <g fill="#bcd0ff">
                  {COLD_STARS.map(([cx, cy, r, base], index) => (
                    <circle key={index} cx={cx} cy={cy} r={r} opacity={base} />
                  ))}
                </g>
                <circle cx={158} cy={142} r={7} fill={`url(#${id}-brighthalo)`} />
                <circle cx={158} cy={142} r={1.5} fill="#f4f6ff" />
              </g>
            ) : null}
          </g>
        )}

        {/* The sun, from the horizon up (the hills hide it until it clears them). */}
        {!evening && sky.sun.visible ? (
          <g data-testid="rutin-sun">
            <circle cx={sun.x} cy={sun.y} r={sun.halo} fill={`url(#${id}-halo)`} />
            <circle cx={sun.x} cy={sun.y} r={sun.body} fill={`url(#${id}-sun)`} />
          </g>
        ) : null}

        {/* The moon: near the horizon on the right; its place and phase are not worked out. */}
        {evening ? (
          <g data-testid="rutin-moon">
            <circle
              cx={board ? 1250 : 322}
              cy={board ? 610 : 556}
              r={board ? 96 : 78}
              fill={`url(#${id}-moonhalo)`}
            />
            <circle
              cx={board ? 1250 : 322}
              cy={board ? 610 : 556}
              r={board ? 28 : 22}
              fill={`url(#${id}-moon)`}
            />
          </g>
        ) : null}

        {evening ? (
          <g transform={board ? "translate(250 96)" : undefined} data-testid="rutin-owl">
            <Owl asleep={owlAsleep} />
          </g>
        ) : null}
      </svg>
      <svg
        className="absolute inset-x-0 bottom-0 w-full"
        style={{ top: `${(below / height) * 100}%` }}
        viewBox={`0 ${below} ${width} ${height - below}`}
        preserveAspectRatio="xMidYMin slice"
      >
        <path d={hills.far} fill={sky.far} />
        {!board && sky.fog > 0 ? (
          <rect x={0} y={610} width={390} height={72} fill={`url(#${id}-fog)`} />
        ) : null}
        <path d={hills.mid} fill={sky.mid} />
        {!board && sky.fog > 0 && sky.phase !== "night" ? (
          <rect x={0} y={648} width={390} height={50} fill={`url(#${id}-fog)`} opacity={0.55} />
        ) : null}
        <path d={hills.near} fill={`url(#${id}-near)`} />
        {!board && sky.shade > 0 ? (
          <rect x={0} y={674} width={390} height={170} fill={`url(#${id}-shade)`} />
        ) : null}
      </svg>
    </div>
  );
}

/** The owl on its branch (degerler.md, section 1); its eyes close on "İyi geceler". */
function Owl({ asleep }: { asleep: boolean }) {
  return (
    <g data-asleep={asleep ? "true" : "false"}>
      <path
        d="M0 604 C34 606 66 612 104 609 C122 608 136 603 148 596"
        stroke="#050817"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M118 608 C126 600 130 592 131 584"
        stroke="#050817"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M82 608 C70 608 65 594 67 582 C68 570 73 564 75 558 L80 565 C84 563 90 563 94 565 L99 558 C101 564 106 570 107 582 C109 594 104 608 92 608 Z"
        fill="#070b1f"
      />
      <path
        d="M99 558 C101 564 106 570 107 582 C108 592 106 601 100 606"
        stroke="#c8d4ff"
        strokeOpacity="0.4"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="80" cy="577" r="5" fill="#d3daf5" />
      <circle cx="94" cy="577" r="5" fill="#d3daf5" />
      <circle cx="80" cy="578.5" r="2" fill="#070b1f" />
      <circle cx="94" cy="578.5" r="2" fill="#070b1f" />
      <path
        d="M74.5 577.5 A5.5 5.5 0 0 1 85.5 577.5 Z M88.5 577.5 A5.5 5.5 0 0 1 99.5 577.5 Z"
        fill="#070b1f"
      />
      <path d="M85.5 582 L87 586 L88.5 582 Z" fill="#8f9bd0" />
      <path
        d="M80 594 q2 2 4 0 M90 594 q2 2 4 0 M85 599 q2 2 4 0"
        stroke="#c8d4ff"
        strokeOpacity="0.2"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      {asleep ? (
        <g>
          <circle cx="80" cy="577" r="5.6" fill="#070b1f" />
          <circle cx="94" cy="577" r="5.6" fill="#070b1f" />
          <path
            d="M76 578 q4 3 8 0 M90 578 q4 3 8 0"
            stroke="#c8d4ff"
            strokeOpacity="0.55"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      ) : null}
    </g>
  );
}
