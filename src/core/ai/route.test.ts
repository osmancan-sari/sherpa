import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// The AI routes check the session themselves, on top of the proxy: without a user they answer
// 401 and run nothing. A body that does not fit is refused; a crash of the flow is a 500 that
// the screen ignores (the work is already saved).

const getCurrentUser = vi.fn();
const client = { marker: "the user's own client" };
const createClient = vi.fn(async () => client);
const config = {
  provider: null,
  models: { fast: null, plan: null },
  timeouts: { fast: 1, plan: 1 },
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("./config", () => ({ aiConfigFromEnv: () => config }));

const { aiRoute } = await import("./route");

const run = vi.fn();
const POST = aiRoute(z.object({ id: z.guid() }), run);
const ID = "8f2c1d7e-3b4a-4c5d-9e6f-0a1b2c3d4e5f";

const request = (body: string) =>
  new Request("http://127.0.0.1/api/ai/size", { method: "POST", body });

describe("aiRoute", () => {
  afterEach(() => {
    getCurrentUser.mockReset();
    createClient.mockClear();
    run.mockReset();
  });

  it("answers 401 and runs nothing when nobody is signed in", async () => {
    getCurrentUser.mockResolvedValue(null);
    const response = await POST(request(JSON.stringify({ id: ID })));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(createClient).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON or does not fit", async () => {
    getCurrentUser.mockResolvedValue({ id: "u", email: "ben@sherpa.test" });
    for (const body of ["{", JSON.stringify({ id: "not-a-uuid" }), JSON.stringify({})]) {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_body" });
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("runs the flow with the user's own client and answers its outcome, not cached", async () => {
    getCurrentUser.mockResolvedValue({ id: "u", email: "ben@sherpa.test" });
    run.mockResolvedValue({ status: "not_needed" });
    const response = await POST(request(JSON.stringify({ id: ID })));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "not_needed" });
    expect(run).toHaveBeenCalledWith({ db: client, config }, { id: ID });
  });

  it("turns a crash of the flow into a 500 without details", async () => {
    getCurrentUser.mockResolvedValue({ id: "u", email: "ben@sherpa.test" });
    run.mockRejectedValue(new Error("database is down: secret detail"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(request(JSON.stringify({ id: ID })));
    quiet.mockRestore();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: "failed", reason: "server_error" });
  });
});
