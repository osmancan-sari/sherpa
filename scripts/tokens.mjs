// Mirrors src/core/ui/tokens.css for TypeScript: src/core/ui/tokens.gen.ts. The CSS file is the
// one place the design values live; code that needs a value as data (the sky's blend, contrast
// measurements, the colour picker) reads the mirror. `npm run tokens` writes it; a unit test
// (tests/unit/tokens.test.ts) keeps the two equal.
//
//   node scripts/tokens.mjs           write the mirror
//   node scripts/tokens.mjs --check   exit 1 when the mirror is stale

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const root = fileURLToPath(new URL("..", import.meta.url));
export const CSS_PATH = `${root}src/core/ui/tokens.css`;
export const GEN_PATH = `${root}src/core/ui/tokens.gen.ts`;

/** Every `--name: value;` of the file, in order; wildcard resets and keyframes are skipped. */
export function parseTokens(css) {
  const text = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  const tokens = {};
  for (const match of text.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const [, name, raw] = match;
    if (name.endsWith("-*")) continue;
    tokens[name] = raw.replace(/\s+/g, " ").trim();
  }
  return tokens;
}

/** The mirror's text, formatted as the repository formats TypeScript. */
export async function renderTokens(tokens) {
  const lines = Object.entries(tokens).map(
    ([name, value]) => `  ${JSON.stringify(name)}: ${JSON.stringify(value)},`,
  );
  const text = [
    "// Generated from tokens.css by `npm run tokens`; do not edit (tests/unit/tokens.test.ts).",
    "export const TOKENS = {",
    ...lines,
    "} as const;",
    "",
    "export type TokenName = keyof typeof TOKENS;",
    "",
  ].join("\n");
  const options = (await prettier.resolveConfig(GEN_PATH)) ?? {};
  return prettier.format(text, { ...options, filepath: GEN_PATH });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const want = await renderTokens(parseTokens(readFileSync(CSS_PATH, "utf8")));
  if (process.argv.includes("--check")) {
    const have = readFileSync(GEN_PATH, "utf8");
    if (have !== want) {
      console.error("tokens.gen.ts is stale: run `npm run tokens`.");
      process.exit(1);
    }
  } else {
    writeFileSync(GEN_PATH, want);
  }
}
