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

// The test account's day runs from 00:00 to 23:59 (tests/e2e/data.ts) and most specs write their
// data against the real clock, which the database shares. In the day's last 90 minutes the work
// they add no longer fits and the screen rightly offers nothing, so dozens of specs fail for a
// reason that is not a fault. Until every spec holds its own clock (Ç4, docs/ILERLEME.md "Bilinen
// sorunlar"), a run does not start then: it says so, instead of failing at random.
const istanbul = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Istanbul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}).format(new Date());
if (istanbul >= "22:30" && !process.env.SHERPA_E2E_LATE) {
  throw new Error(
    `End-to-end tests do not start between 22:30 and 24:00 Istanbul time (now ${istanbul}): ` +
      "the test account's day ends at 23:59 and most specs use the real clock. Run them after " +
      "midnight. (SHERPA_E2E_LATE=1 starts them anyway, to look at what fails.)",
  );
}

const PORT = 3100;
/** The scheduler's secret on the test servers (tests/e2e/jobs.spec.ts). */
export const E2E_CRON_SECRET = "e2e-cron-secret";
const baseURL = `http://127.0.0.1:${PORT}`;
// The same build once more, with the recorded fake AI provider (SHERPA_AI_FAKE=1). The server
// on PORT has no provider at all: both ways the app must work are tried in every run.
const AI_PORT = 3101;
const AI_BASE_URL = `http://127.0.0.1:${AI_PORT}`;
const storageState = "playwright/.auth/user.json";

// Set SHERPA_SHOTS to a phase folder (e.g. "c0") to also write the phase screenshots
// into docs/ekran-goruntuleri/<folder>/. Off by default so normal runs leave docs untouched.
const shots = Boolean(process.env.SHERPA_SHOTS);

const GATE_SPECS = /(^|[\\/])(guard|login|session)\.spec\.ts$/;
const LIVE_SPECS = /(^|[\\/])sync\.spec\.ts$/;
const BOTH_SPECS = /\.both\.spec\.ts$/;
const SHOT_SPECS = /screenshots\.spec\.ts$/;
const AI_SPECS = /\.ai\.spec\.ts$/;

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
  //   sync                      -> "esitleme" (live sync between devices; runs first, see below)
  //   guard, login, session     -> "giris" (signed-out behaviour; no stored session)
  //   *.both.spec.ts            -> "pano" and "telefon"
  //   *.ai.spec.ts              -> "yapay-zeka" (the server with the fake AI provider)
  //   everything else           -> "pano"
  //   screenshots.spec.ts       -> both, but only when SHERPA_SHOTS is set
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      // Live sync, before everything else. Supabase Realtime keeps the subscription of a page
      // that was closed for about 15 seconds, and every change is sent once per subscription
      // of the account. After dozens of tests have opened and closed pages, one change counts
      // dozens of times and the local limit (100 messages a second) drops them. Real use is two
      // devices, not a hundred; so these tests run while the service is still quiet.
      name: "esitleme",
      testMatch: LIVE_SPECS,
      dependencies: ["setup"],
      use: { storageState, viewport: { width: 1920, height: 1080 } },
    },
    {
      // The gate: signed-out behaviour, the login flow, sessions.
      name: "giris",
      testMatch: GATE_SPECS,
      dependencies: ["setup", "esitleme"],
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      // Second screen.
      name: "pano",
      testMatch: /\.spec\.ts$/,
      testIgnore: shots
        ? [GATE_SPECS, LIVE_SPECS, AI_SPECS]
        : [GATE_SPECS, LIVE_SPECS, AI_SPECS, SHOT_SPECS],
      dependencies: ["setup", "esitleme"],
      use: { storageState, viewport: { width: 1920, height: 1080 } },
    },
    {
      // The AI paths, against the server with the fake provider (second screen width).
      name: "yapay-zeka",
      testMatch: AI_SPECS,
      dependencies: ["setup", "esitleme"],
      use: { storageState, baseURL: AI_BASE_URL, viewport: { width: 1920, height: 1080 } },
    },
    {
      // Phone.
      name: "telefon",
      testMatch: shots ? [BOTH_SPECS, SHOT_SPECS] : BOTH_SPECS,
      dependencies: ["setup", "esitleme"],
      use: {
        storageState,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: `npx next start --port ${PORT}`,
      url: `${baseURL}/giris`,
      // Never reuse a server that is already running: it could be serving an older build.
      reuseExistingServer: false,
      timeout: 60_000,
      // The server without any AI provider, whatever key .env.local holds (Next reads the file
      // itself but never overrides a variable that is set, even to nothing).
      env: { ANTHROPIC_API_KEY: "", CRON_SECRET: E2E_CRON_SECRET },
    },
    {
      command: `npx next start --port ${AI_PORT}`,
      url: `${AI_BASE_URL}/giris`,
      // Only ever with the local Supabase above; the app refuses the fake anywhere else.
      env: { SHERPA_AI_FAKE: "1", CRON_SECRET: E2E_CRON_SECRET },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
