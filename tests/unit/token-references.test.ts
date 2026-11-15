import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { TOKENS } from "@/core/ui/tokens";

// Every `var(--…)` that code or a stylesheet reads names a token of tokens.css (which writes all
// of them to the page: `@theme static`). A misspelt or missing one would draw nothing, silently.

const ROOT = join(__dirname, "..", "..");

/** Variables set at run time or by other layers, not tokens. */
const RUNTIME = new Set(["font-sans", "font-geist-mono", "tw-backdrop-blur"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("token references", () => {
  it("every var(--…) in src names a token", () => {
    const unknown: string[] = [];
    for (const path of files(join(ROOT, "src"))) {
      const text = readFileSync(path, "utf8");
      for (const match of text.matchAll(/var\(--([a-z0-9-]+)/gi)) {
        const name = match[1];
        // A name built at run time ("--color-seq-${level}") is checked by its prefix.
        if (name.endsWith("-") && Object.keys(TOKENS).some((key) => key.startsWith(name))) continue;
        if (name in TOKENS || RUNTIME.has(name)) continue;
        unknown.push(`${relative(ROOT, path)}: --${name}`);
      }
    }
    expect(unknown).toEqual([]);
  });
});
