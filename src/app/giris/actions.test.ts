import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The login action on its own: which requests reach Supabase at all, and what the device
// is left remembering. Supabase and the request (cookies, redirect) are replaced by fakes.

const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
const createClient = vi.fn(async () => ({ auth: { signInWithOtp, verifyOtp } }));
const jar = new Map<string, string>();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: ({ name }: { name: string }) => void jar.delete(name),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
}));

const { login } = await import("./actions");
const { readPendingLogin } = await import("./pending");

const ALLOWED = "ben@sherpa.test";
const STRANGER = "baskasi@ornek.test";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("login action", () => {
  beforeEach(() => {
    vi.stubEnv("ALLOWED_EMAIL", ALLOWED);
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    jar.clear();
  });

  it("turns another address away on every intent, without asking Supabase", async () => {
    for (const intent of ["request", "resend", "verify"]) {
      const state = await login(
        { step: "email" },
        form({ intent, email: STRANGER, token: "12345678" }),
      );
      expect(state, intent).toEqual({
        step: "email",
        email: STRANGER,
        error: "Bu e-posta ile giriş yapılamıyor.",
      });
    }
    expect(createClient).not.toHaveBeenCalled();
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(await readPendingLogin()).toBeNull();
  });

  it("turns everyone away when no allowed address is configured", async () => {
    vi.stubEnv("ALLOWED_EMAIL", "");
    const state = await login({ step: "email" }, form({ intent: "request", email: ALLOWED }));
    expect(state.step).toBe("email");
    expect(state.error).toBe("Bu e-posta ile giriş yapılamıyor.");
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("sends a code to the allowed address, never creating an account, and remembers the step", async () => {
    const state = await login(
      { step: "email" },
      form({ intent: "request", email: "  Ben@Sherpa.Test " }),
    );
    expect(state).toEqual({ step: "code", email: ALLOWED, notice: undefined });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: ALLOWED,
      options: { shouldCreateUser: false },
    });
    expect(await readPendingLogin()).toBe(ALLOWED);
  });

  it("does not remember a code step when sending failed", async () => {
    signInWithOtp.mockResolvedValue({ error: { status: 429, message: "rate limited" } });
    const state = await login({ step: "email" }, form({ intent: "request", email: ALLOWED }));
    expect(state).toEqual({
      step: "email",
      email: ALLOWED,
      error: "Çok sık denendi. Biraz sonra yeniden dene.",
    });
    expect(await readPendingLogin()).toBeNull();
  });

  it("keeps the code step when a resend fails: the earlier code still works", async () => {
    await login({ step: "email" }, form({ intent: "request", email: ALLOWED }));
    signInWithOtp.mockResolvedValue({ error: { status: 500, message: "smtp down" } });
    const state = await login(
      { step: "code", email: ALLOWED },
      form({ intent: "resend", email: ALLOWED }),
    );
    expect(state).toEqual({
      step: "code",
      email: ALLOWED,
      error: "Kod gönderilemedi. Yeniden dene.",
    });
    expect(await readPendingLogin()).toBe(ALLOWED);
  });

  it("does not bother Supabase with a code that is too short", async () => {
    const state = await login(
      { step: "code", email: ALLOWED },
      form({ intent: "verify", email: ALLOWED, token: "12 3" }),
    );
    expect(state).toEqual({ step: "code", email: ALLOWED, error: "Kodu eksiksiz yaz." });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("stays on the code step when the code is wrong", async () => {
    await login({ step: "email" }, form({ intent: "request", email: ALLOWED }));
    verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    const state = await login(
      { step: "code", email: ALLOWED },
      form({ intent: "verify", email: ALLOWED, token: "00000000" }),
    );
    expect(state).toEqual({
      step: "code",
      email: ALLOWED,
      error: "Kod geçersiz ya da süresi dolmuş.",
    });
    expect(await readPendingLogin()).toBe(ALLOWED);
  });

  it("signs in with the right code, digits only, and forgets the step", async () => {
    await login({ step: "email" }, form({ intent: "request", email: ALLOWED }));
    await expect(
      login(
        { step: "code", email: ALLOWED },
        form({ intent: "verify", email: ALLOWED, token: "1234 5678" }),
      ),
    ).rejects.toThrow("REDIRECT /");
    expect(verifyOtp).toHaveBeenCalledWith({ email: ALLOWED, token: "12345678", type: "email" });
    expect(await readPendingLogin()).toBeNull();
  });

  it("goes back to the e-mail step on reset and forgets the step", async () => {
    await login({ step: "email" }, form({ intent: "request", email: ALLOWED }));
    const state = await login(
      { step: "code", email: ALLOWED },
      form({ intent: "reset", email: ALLOWED }),
    );
    expect(state).toEqual({ step: "email" });
    expect(await readPendingLogin()).toBeNull();
  });

  it("ignores a remembered step for an address that is not the allowed one", async () => {
    jar.set("sherpa-login", STRANGER);
    expect(await readPendingLogin()).toBeNull();
  });
});
