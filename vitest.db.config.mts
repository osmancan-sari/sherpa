import { defineConfig } from "vitest/config";

// Database tests: they talk to the local Supabase stack (`npm run db:start`) as real signed-in
// users, so RLS, constraints and SQL functions are tested as the app meets them.
// Run with `npm run test:db`; part of `npm run check:full`.
process.loadEnvFile(".env.local");

// These tests create and delete accounts with the secret key. Local stack only.
const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://unset").hostname;
if (!["127.0.0.1", "localhost"].includes(supabaseHost)) {
  throw new Error(
    `Database tests only run against local Supabase; .env.local points at "${supabaseHost}".`,
  );
}

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    allowOnly: false,
    include: ["tests/db/**/*.test.ts"],
    globalSetup: ["tests/db/global-setup.ts"],
    // One database, shared accounts: run the files one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
