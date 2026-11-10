import { defineConfig } from "@playwright/test";

// End-to-end tests run against a production build talking to the local Supabase stack.
// Before running: `npm run db:start` (Docker) and a filled .env.local.
// Run them with `npm run test:e2e`, which builds first; the server below only starts that build.
process.loadEnvFile(".env.local");

// These tests create and delete accounts with the secret key and sign in as a stranger.
// They are for the local stack only; refuse to start against anything else.
const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://unset").hostname;
if (!["127.0.0.1", "localhost"].includes(supabaseHost)) {
  throw new Error(
    `End-to-end tests only run against local Supabase; .env.local points at "${supabaseHost}".`,
  );
}

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;
const storageState = "playwright/.auth/user.json";

// Set SHERPA_SHOTS to a phase folder (e.g. "c0") to also write the phase screenshots
// into docs/ekran-goruntuleri/<folder>/. Off by default so normal runs leave docs untouched.
const shots = Boolean(process.env.SHERPA_SHOTS);

const GATE_SPECS = /(^|[\\/])(guard|login|session)\.spec\.ts$/;
const BOTH_SPECS = /\.both\.spec\.ts$/;
const SHOT_SPECS = /screenshots\.spec\.ts$/;

export default defineConfig({
  testDir: "tests/e2e",
  // One worker: the tests share one mailbox and one user.
  workers: 1,
  fullyParallel: false,
  // The phase gate runs locally, so a stray .only must fail here too, not just in CI.
  forbidOnly: true,
  reporter: [["list"]],
  use: {
    baseURL,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
  },
  // Every *.spec.ts file runs somewhere without being listed here: "pano" takes whatever the
  // other projects do not claim, so a new spec file can never be silently left out.
  //   guard, login, session     -> "giris" (signed-out behaviour; no stored session)
  //   *.both.spec.ts            -> "pano" and "telefon"
  //   everything else           -> "pano"
  //   screenshots.spec.ts       -> both, but only when SHERPA_SHOTS is set
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      // The gate: signed-out behaviour, the login flow, sessions.
      name: "giris",
      testMatch: GATE_SPECS,
      dependencies: ["setup"],
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      // Second screen.
      name: "pano",
      testMatch: /\.spec\.ts$/,
      testIgnore: shots ? [GATE_SPECS] : [GATE_SPECS, SHOT_SPECS],
      dependencies: ["setup"],
      use: { storageState, viewport: { width: 1920, height: 1080 } },
    },
    {
      // Phone.
      name: "telefon",
      testMatch: shots ? [BOTH_SPECS, SHOT_SPECS] : BOTH_SPECS,
      dependencies: ["setup"],
      use: {
        storageState,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    url: `${baseURL}/giris`,
    // Never reuse a server that is already running: it could be serving an older build.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
