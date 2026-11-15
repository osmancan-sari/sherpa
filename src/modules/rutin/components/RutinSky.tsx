"use client";

import { useId } from "react";
import { Landscape, type Sky, token } from "@/core/ui/kit";

// The scene's background (docs/tasarim/ekranlar/rutin.md): the core's full landscape, which
// Rutin dresses with its own figures: in the evening the moon on the right and the owl on its
// branch (the core's sun stays off then). Drawing data lives here; every colour is a token.

export function RutinSky({
  sky,
  device,
  evening,
  owlAsleep = false,
}: {
  sky: Sky;
  device: "pano" | "telefon";
  evening: boolean;
  /** "İyi geceler": the owl's eyes are closed. */
  owlAsleep?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const board = device === "pano";
  return (
    <Landscape sky={sky} device={device} sun={!evening} shade testId="rutin-sky">
      {evening ? (
        <>
          <defs>
            <radialGradient id={`${id}-moonhalo`}>
              <stop offset="0%" stopColor={token("sky-moon-halo")} stopOpacity="0.42" />
              <stop offset="45%" stopColor={token("sky-moon-halo-2")} stopOpacity="0.12" />
              <stop offset="100%" stopColor={token("sky-moon-halo-2")} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${id}-moon`} cx="0.38" cy="0.34" r="0.75">
              <stop offset="0%" stopColor={token("sky-moon")} />
              <stop offset="55%" stopColor={token("sky-moon-2")} />
              <stop offset="100%" stopColor={token("sky-moon-3")} />
            </radialGradient>
          </defs>
          {/* The moon: near the horizon on the right; its place and phase are not worked out. */}
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
          <g transform={board ? "translate(250 96)" : undefined} data-testid="rutin-owl">
            <Owl asleep={owlAsleep} />
          </g>
        </>
      ) : null}
    </Landscape>
  );
}

/** The owl on its branch; its eyes close on "İyi geceler". */
function Owl({ asleep }: { asleep: boolean }) {
  const body = token("sky-owl");
  const light = token("sky-owl-light");
  return (
    <g data-asleep={asleep ? "true" : "false"}>
      <path
        d="M0 604 C34 606 66 612 104 609 C122 608 136 603 148 596"
        stroke={token("sky-owl-branch")}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M118 608 C126 600 130 592 131 584"
        stroke={token("sky-owl-branch")}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M82 608 C70 608 65 594 67 582 C68 570 73 564 75 558 L80 565 C84 563 90 563 94 565 L99 558 C101 564 106 570 107 582 C109 594 104 608 92 608 Z"
        fill={body}
      />
      <path
        d="M99 558 C101 564 106 570 107 582 C108 592 106 601 100 606"
        stroke={light}
        strokeOpacity="0.4"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="80" cy="577" r="5" fill={token("sky-owl-eye")} />
      <circle cx="94" cy="577" r="5" fill={token("sky-owl-eye")} />
      <circle cx="80" cy="578.5" r="2" fill={body} />
      <circle cx="94" cy="578.5" r="2" fill={body} />
      <path
        d="M74.5 577.5 A5.5 5.5 0 0 1 85.5 577.5 Z M88.5 577.5 A5.5 5.5 0 0 1 99.5 577.5 Z"
        fill={body}
      />
      <path d="M85.5 582 L87 586 L88.5 582 Z" fill={token("sky-owl-beak")} />
      <path
        d="M80 594 q2 2 4 0 M90 594 q2 2 4 0 M85 599 q2 2 4 0"
        stroke={light}
        strokeOpacity="0.2"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      {asleep ? (
        <g>
          <circle cx="80" cy="577" r="5.6" fill={body} />
          <circle cx="94" cy="577" r="5.6" fill={body} />
          <path
            d="M76 578 q4 3 8 0 M90 578 q4 3 8 0"
            stroke={light}
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
