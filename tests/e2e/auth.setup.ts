import { execFileSync } from "node:child_process";
import { test as setup } from "@playwright/test";
import { signIn, STORAGE_STATE, SUPABASE_URL } from "./helpers";

setup("local stack is up and the user is signed in", async ({ page }) => {
  const health = await fetch(`${SUPABASE_URL}/auth/v1/health`).catch(() => null);
  if (!health?.ok) {
    throw new Error(`Supabase is not reachable at ${SUPABASE_URL}. Run "npm run db:start" first.`);
  }

  // Signups are closed, so the one account has to exist before anyone can sign in.
  execFileSync(process.execPath, ["--env-file=.env.local", "scripts/create-user.mjs"], {
    stdio: "inherit",
  });

  await signIn(page);
  await page.context().storageState({ path: STORAGE_STATE });
});
