import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CSS_PATH, GEN_PATH, parseTokens, renderTokens } from "../../scripts/tokens.mjs";
import { token } from "@/core/ui/tokens";

describe("tokens.gen.ts mirrors tokens.css", () => {
  it("is regenerated after every change of tokens.css (npm run tokens)", async () => {
    const want = await renderTokens(parseTokens(readFileSync(CSS_PATH, "utf8")));
    expect(readFileSync(GEN_PATH, "utf8")).toBe(want);
  });

  it("resolves references to other tokens", () => {
    expect(token("color-foreground")).toBe(token("color-ink"));
    expect(token("color-ink")).toMatch(/^#[0-9a-f]{6}$/);
  });
});
