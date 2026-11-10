import { describe, expect, it } from "vitest";
import { isAllowedEmail, normalizeEmail } from "./allowed-email";

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Ben@Sherpa.Test ")).toBe("ben@sherpa.test");
  });
});

describe("isAllowedEmail", () => {
  const allowed = "ben@sherpa.test";

  it("accepts the allowed address regardless of case and whitespace", () => {
    expect(isAllowedEmail("ben@sherpa.test", allowed)).toBe(true);
    expect(isAllowedEmail(" BEN@sherpa.test ", allowed)).toBe(true);
    expect(isAllowedEmail("ben@sherpa.test", "  Ben@Sherpa.Test ")).toBe(true);
  });

  it("rejects any other address", () => {
    expect(isAllowedEmail("baskasi@sherpa.test", allowed)).toBe(false);
    expect(isAllowedEmail("ben@sherpa.test.evil.com", allowed)).toBe(false);
    expect(isAllowedEmail("ben+x@sherpa.test", allowed)).toBe(false);
  });

  it("fails closed when either side is missing", () => {
    expect(isAllowedEmail("ben@sherpa.test", undefined)).toBe(false);
    expect(isAllowedEmail("ben@sherpa.test", "")).toBe(false);
    expect(isAllowedEmail("ben@sherpa.test", "   ")).toBe(false);
    expect(isAllowedEmail(undefined, allowed)).toBe(false);
    expect(isAllowedEmail("", "")).toBe(false);
  });
});
