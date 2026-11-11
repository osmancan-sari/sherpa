import { afterEach, describe, expect, it, vi } from "vitest";

// The export route checks the session itself, on top of the proxy: without a user it answers
// 401 and reads nothing. (The proxy's own 401 is tested end to end in guard.spec.ts.)

const getCurrentUser = vi.fn();
const exportAll = vi.fn();
const client = { marker: "the user's own client" };
const createClient = vi.fn(async () => client);

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/core/data/export", () => ({ exportAll }));

const { GET } = await import("./route");

describe("GET /api/export", () => {
  afterEach(() => {
    getCurrentUser.mockReset();
    exportAll.mockReset();
    createClient.mockClear();
  });

  it("answers 401 and reads nothing when nobody is signed in", async () => {
    getCurrentUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(createClient).not.toHaveBeenCalled();
    expect(exportAll).not.toHaveBeenCalled();
  });

  it("hands the signed-in user their data as a file that is not cached", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1", email: "ben@sherpa.test" });
    const document = { exported_at: "2026-11-11T09:00:00.000Z", tables: { tasks: [{ id: "t1" }] } };
    exportAll.mockResolvedValue(document);

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="sherpa-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual(document);

    // Read with the user's own client (row level security decides what "everything" is).
    expect(exportAll).toHaveBeenCalledTimes(1);
    const [db, moduleTables, now] = exportAll.mock.calls[0];
    expect(db).toBe(client);
    expect(Array.isArray(moduleTables)).toBe(true);
    expect(now).toBeInstanceOf(Date);
  });
});
