import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Ç3g: a test run makes no sound. The device's speech is replaced once, in the shared setup
// (tests/e2e/fixtures.ts), for every page of every context; no spec brings its own `test` from
// Playwright (it would run without the fake) and no spec is left to fake the speech by itself.
// (On 14 Nov 2026 a development run spoke aloud with an English voice.)

const dir = path.join("tests", "e2e");
const files = (readdirSync(dir, { recursive: true }) as string[]).filter((name) =>
  name.endsWith(".ts"),
);
const source = (name: string) => readFileSync(path.join(dir, name), "utf8");

describe("end-to-end tests are quiet", () => {
  it("take `test` from the shared fixtures, never straight from Playwright", () => {
    for (const name of files) {
      if (name === "fixtures.ts") continue;
      const imports =
        source(name).match(/import\s*(?:type\s*)?\{[^}]*\}\s*from\s*"@playwright\/test"/g) ?? [];
      for (const line of imports) {
        const names = line.slice(line.indexOf("{"), line.indexOf("}"));
        expect(names, `${name}: ${line}`).not.toMatch(/\btest\b/);
      }
    }
  });

  it("leave the speech to the shared fake (only the voice spec puts its own recorder over it)", () => {
    for (const name of files) {
      if (name === "fixtures.ts" || name === "voice.spec.ts") continue;
      expect(source(name), name).not.toMatch(/speechSynthesis/);
    }
    expect(source("fixtures.ts")).toMatch(/addInitScript\(fakeSpeech\)/);
    expect(readFileSync("playwright.config.ts", "utf8")).toMatch(/--mute-audio/);
  });
});
