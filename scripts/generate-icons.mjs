// Renders the app icons from the SVG below. Run with `npm run icons` after changing the mark.
// Output is committed; the app does not need this script at build time.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BACKGROUND = "#0a0a0a";
const FOREGROUND = "#fafafa";

/**
 * The mark: a ridge line with the summit path ahead. `scale` shrinks the mark towards the
 * centre; maskable icons need it inside the middle 80% so launchers can crop freely.
 */
function iconSvg({ scale = 1, radius = 0 } = {}) {
  const offset = (512 * (1 - scale)) / 2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${BACKGROUND}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${FOREGROUND}"
     stroke-width="34" stroke-linecap="round" stroke-linejoin="round">
    <path d="M96 372 L212 180 L276 284 L324 212 L416 372"/>
    <path d="M96 372 H416" opacity="0.35"/>
  </g>
</svg>`;
}

const targets = [
  { file: "public/icons/icon-192.png", size: 192, svg: iconSvg({ radius: 96 }) },
  { file: "public/icons/icon-512.png", size: 512, svg: iconSvg({ radius: 96 }) },
  { file: "public/icons/icon-maskable-512.png", size: 512, svg: iconSvg({ scale: 0.72 }) },
  { file: "src/app/apple-icon.png", size: 180, svg: iconSvg({ scale: 0.86 }) },
  { file: "src/app/icon.png", size: 64, svg: iconSvg({ radius: 112 }) },
];

for (const { file, size, svg } of targets) {
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toFile(file);
  console.log(`${file} (${size}x${size})`);
}
