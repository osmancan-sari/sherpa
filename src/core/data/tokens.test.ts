import { describe, expect, it } from "vitest";
import { z } from "zod";
import { scopeChoices } from "@/core/contract/ingest";
import { hashToken, newToken, TOKEN_SHAPE, tokenHint } from "./tokens";

describe("device tokens", () => {
  it("are 'shp_' and 32 random bytes, different every time", () => {
    const tokens = Array.from({ length: 20 }, newToken);
    for (const token of tokens) expect(token).toMatch(TOKEN_SHAPE);
    expect(new Set(tokens).size).toBe(20);
  });

  it("are kept as their SHA-256 digest in hex", async () => {
    // The standard test vector for "abc".
    expect(await hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    const token = newToken();
    expect(await hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashToken(token)).toBe(await hashToken(token));
  });

  it("are told apart by their first eight characters", () => {
    expect(tokenHint("shp_AbCdEfGh")).toBe("shp_AbCd");
  });
});

describe("scope choices", () => {
  it("lists the core's kinds, then each module's, written like the address", () => {
    const handle = async () => {};
    const choices = scopeChoices([
      {
        slug: "okul",
        name: "Okul",
        ingest: [
          { kind: "ninova", label: "Ninova", schema: z.object({}), handle },
          { kind: "not", schema: z.object({}), handle },
        ],
      },
      { slug: "ev", name: "Ev" },
    ]);
    expect(choices.map((choice) => choice.scope)).toEqual([
      "core/wake",
      "core/bed",
      "core/context",
      "okul/ninova",
      "okul/not",
    ]);
    expect(choices[3].label).toBe("Okul: Ninova");
    expect(choices[4].label).toBe("Okul: not");
  });
});
