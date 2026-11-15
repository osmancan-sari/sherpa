import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Design values live in one place: src/core/ui/tokens.css (CLAUDE.md "Tasarım"). Components,
// pages and modules take colours and sizes from it through the Tailwind utilities and the CSS
// variables it makes. This test keeps it that way: no colour code, no colour function, no
// arbitrary pixel value anywhere else in src/.

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");

/** Files that may hold raw values, each with its reason. */
const ALLOWED: Record<string, string> = {
  "src/core/ui/tokens.css": "the one place the values live",
  "src/core/ui/tokens.gen.ts": "generated mirror of tokens.css",
  "src/lib/supabase/database.types.ts": "generated database types",
  "src/core/ui/sky/Landscape.tsx": "SVG drawing data: the landscape's viewBox sizes and paths",
};

/**
 * Ç4b's work list: files still drawn with raw values, each to be moved onto the tokens in the
 * named step of the phase (docs/ILERLEME.md, "Ç4b planı"). The phase is not done until this list
 * is empty.
 */
const PENDING: Record<string, string> = {
  "src/modules/rutin/components/StepsTab.tsx": "step 6: Rutin's module page",
  "src/app/giris/page.tsx": "step 5: the sign-in screens",
  "src/app/giris/login-form.tsx": "step 5: the sign-in screens",
  "src/core/ui/today/DayParts.tsx": "step 5: Today on the new base",
  "src/core/ui/week/WeekScreen.tsx": "step 5: Takvim on the new base",
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

type Finding = { file: string; line: number; text: string; rule: string };

const RULES: { rule: string; pattern: RegExp; css?: boolean; code?: boolean }[] = [
  {
    rule: "colour code",
    pattern: /(?<![\w&/#-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![\w-])/i,
  },
  // A colour function with numbers in it (one built from computed values is not a written value).
  { rule: "colour function", pattern: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(\s*[\d.]/i },
  // Tailwind arbitrary values with a length: text-[15px], rounded-[28px], pb-[calc(9rem+…)].
  { rule: "arbitrary length", pattern: /-\[[^\]]*\d(?:px|rem|em)\b[^\]]*\]/, code: true },
  // A length written in a string: style={{ padding: "8px 20px" }}, `${x} 12px`.
  // (A hairline, 1px, is not a size.)
  {
    rule: "pixel in a string",
    pattern: /["'`][^"'`\n]*\b(?!1px\b)\d+(?:\.\d+)?(?:px|rem)\b/,
    code: true,
  },
  // A number given to a length in a style object: style={{ fontSize: 17, top: 300 }}.
  {
    rule: "number in a style",
    pattern:
      /\b(?:fontSize|width|height|minWidth|minHeight|maxWidth|maxHeight|padding\w*|margin\w*|gap|rowGap|columnGap|top|left|right|bottom|inset|borderRadius|letterSpacing)\s*:\s*-?\d/,
    code: true,
  },
  // In stylesheets: a length other than a hairline, outside media queries.
  {
    rule: "pixel in a stylesheet",
    pattern: /(?<![\w.-])(?!1px\b)\d+(?:\.\d+)?(?:px|rem)\b/,
    css: true,
  },
];

function scan(path: string): Finding[] {
  const file = relative(ROOT, path).replaceAll("\\", "/");
  if (file in ALLOWED || file in PENDING) return [];
  const css = file.endsWith(".css");
  const lines = readFileSync(path, "utf8").split("\n");
  const findings: Finding[] = [];
  let comment = false;
  lines.forEach((raw, index) => {
    // Comments may name values ("dolgu %42, köşe 28"); only code counts.
    let text = raw;
    if (comment) {
      const end = text.indexOf("*/");
      if (end === -1) return;
      text = text.slice(end + 2);
      comment = false;
    }
    text = text.replace(/\/\*.*?\*\//g, "");
    const open = text.indexOf("/*");
    if (open !== -1) {
      comment = true;
      text = text.slice(0, open);
    }
    if (!css) text = text.replace(/(^|[^:"'`])\/\/.*$/, "$1");
    if (css && /^\s*@media/.test(text)) return;
    for (const { rule, pattern, css: onlyCss, code: onlyCode } of RULES) {
      if (onlyCss && !css) continue;
      if (onlyCode && css) continue;
      if (pattern.test(text)) findings.push({ file, line: index + 1, text: raw.trim(), rule });
    }
  });
  return findings;
}

describe("design values come from tokens.css only", () => {
  it("no colour code, colour function or arbitrary pixel value outside tokens.css", () => {
    const findings = files(SRC).flatMap(scan);
    expect(
      findings.map((f) => `${f.file}:${f.line} [${f.rule}] ${f.text}`),
      "Take the value from src/core/ui/tokens.css (docs/tasarim/README.md).",
    ).toEqual([]);
  });

  it("every allowed file still exists", () => {
    for (const file of [...Object.keys(ALLOWED), ...Object.keys(PENDING)])
      expect(() => statSync(join(ROOT, file))).not.toThrow();
  });
});
