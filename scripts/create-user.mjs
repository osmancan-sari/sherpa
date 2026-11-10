// Creates the single Sherpa account (ALLOWED_EMAIL) in the Supabase project the env points at.
// Signups are closed, so this is the only way an account comes to exist. Safe to run again.
//
//   npm run db:user                                  (local, reads .env.local)
//   node --env-file=<env file> scripts/create-user.mjs   (another project)

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();

if (!url || !secretKey || !email) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and ALLOWED_EMAIL must be set.");
  process.exit(1);
}

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error } = await supabase.auth.admin.createUser({ email, email_confirm: true });

if (!error) {
  console.log(`Created user ${email} on ${url}`);
} else if (error.code === "email_exists" || /already.*registered/i.test(error.message)) {
  console.log(`User ${email} already exists on ${url}`);
} else {
  console.error(`Could not create user: ${error.message}`);
  process.exit(1);
}
