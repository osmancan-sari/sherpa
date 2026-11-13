import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Ç3e: the core's colours come from one place (docs/06-modul-sozlesmesi.md, "Bölümler" rule 4).
// No screen reads a module row's or a definition's colour itself: work gets `workColor` (through
// `useColors`), module-level places get `moduleColor` (src/core/contract/colors.ts).

const ROOT = join(__dirname, "..", "..");

/** Files that may read the colour itself: the resolver, and the paths that store it. */
const ALLOWED = new Set([
  "src/core/contract/colors.ts",
  "src/core/contract/registry.ts", // checks a definition's colour is #rrggbb
  "src/core/data/module-rows.ts", // copies the definition's colour into a new row
  "src/core/ui/settings/ModuleColors.tsx", // the colour picker writes and resets them
]);

/** `row.color`, `row?.color`, `mod.row.color`, `definition.color`, `def.color`… */
const READS_COLOR = /\b(?:row|definition|def)\??\.color\b/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("colours come from one place", () => {
  it("no core screen or route reads a module's colour except through the resolver", () => {
    const offenders = [join(ROOT, "src", "core"), join(ROOT, "src", "app")]
      .flatMap(sources)
      .map((path) => relative(ROOT, path).replaceAll("\\", "/"))
      .filter((path) => !ALLOWED.has(path) && !path.startsWith("src/core/testing/"))
      .flatMap((path) =>
        readFileSync(join(ROOT, path), "utf8")
          .split("\n")
          .flatMap((line, index) => (READS_COLOR.test(line) ? [`${path}:${index + 1}`] : [])),
      );
    expect(offenders).toEqual([]);
  });

  it("the pattern catches the ways a colour is read", () => {
    for (const line of [
      "style={{ backgroundColor: mod.row.color }}",
      "row?.color ?? definition?.color",
      "modules.get(id)?.row.color",
      "color: def.color",
    ]) {
      expect(READS_COLOR.test(line), line).toBe(true);
    }
    expect(READS_COLOR.test("colors.of(moduleId, work)")).toBe(false);
    expect(READS_COLOR.test("moduleColor(mod)")).toBe(false);
  });
});
