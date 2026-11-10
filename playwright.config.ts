import { defineConfig } from "@playwright/test";

// End-to-end tests run against a production build talking to the local Supabase stack.
// Before running: `npm run db:start` (Docker) and a filled .env.local.
// Run them with `npm run test:e2e`, which builds first; the server below only starts that build.
process.loadEnvFile(".env.local");

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;
const storageState = "playwright/.auth/user.json";

// Set SHERPA_SHOTS to a phase folder (e.g. "c0") to also write the phase screenshots
// into docs/ekran-goruntuleri/<folder>/. Off by default so normal runs leave docs untouched.
const shots = Boolean(process.env.SHERPA_SHOTS);

export default defineConfig({
  testDir: "tests/e2e",
  // One worker: the tests share one mailbox and one user.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"]],
  use: {
    baseURL,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      // The gate: signed-out behaviour, the login flow, sessions.
      name: "giris",
      testMatch: /(guard|login|session)\.spec\.ts/,
      dependencies: ["setup"],
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      // Second screen.
      name: "pano",
      testMatch: shots ? /(shell|screenshots)\.spec\.ts/ : /shell\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState, viewport: { width: 1920, height: 1080 } },
    },
    {
      // Phone.
      name: "telefon",
      testMatch: shots ? /(shell|screenshots)\.spec\.ts/ : /shell\.spec\.ts/,
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
