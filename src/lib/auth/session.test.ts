import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The session check that route handlers and server actions make themselves, on top of the proxy.
// The Supabase client is replaced by one that answers with whatever claims the test hands it.

const getClaims = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims } }),
}));

const { getCurrentUser } = await import("./session");

const ALLOWED = "ben@sherpa.test";
const claims = (overrides: Record<string, unknown> = {}) => ({
  data: { claims: { sub: "user-1", email: ALLOWED, ...overrides } },
  error: null,
});

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.stubEnv("ALLOWED_EMAIL", ALLOWED);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    getClaims.mockReset();
  });

  it("returns the allowed user", async () => {
    getClaims.mockResolvedValue(claims());
    expect(await getCurrentUser()).toEqual({ id: "user-1", email: ALLOWED });
  });

  it("matches the address whatever its case", async () => {
    getClaims.mockResolvedValue(claims({ email: "Ben@Sherpa.Test" }));
    expect(await getCurrentUser()).toEqual({ id: "user-1", email: "Ben@Sherpa.Test" });
  });

  it("returns null for a valid session of any other account", async () => {
    getClaims.mockResolvedValue(claims({ email: "baskasi@ornek.test" }));
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns null without a session", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns null when the token cannot be verified", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("invalid JWT") });
    expect(await getCurrentUser()).toBeNull();
    getClaims.mockResolvedValue({ ...claims(), error: new Error("invalid JWT") });
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns null when the claims carry no user id or no e-mail", async () => {
    getClaims.mockResolvedValue(claims({ sub: undefined }));
    expect(await getCurrentUser()).toBeNull();
    getClaims.mockResolvedValue(claims({ sub: "" }));
    expect(await getCurrentUser()).toBeNull();
    getClaims.mockResolvedValue(claims({ email: undefined }));
    expect(await getCurrentUser()).toBeNull();
    getClaims.mockResolvedValue(claims({ email: 42 }));
    expect(await getCurrentUser()).toBeNull();
  });

  it("fails closed when no allowed address is configured", async () => {
    vi.stubEnv("ALLOWED_EMAIL", "");
    getClaims.mockResolvedValue(claims());
    expect(await getCurrentUser()).toBeNull();
  });
});
