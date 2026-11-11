// Gate: the generated database types in the repository match the local schema.
// A migration without `npm run db:types` afterwards fails here (part of `npm run check:full`).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import prettier from "prettier";

const FILE = "src/lib/supabase/database.types.ts";

const generated = execFileSync("npx", ["supabase", "gen", "types", "typescript", "--local"], {
  encoding: "utf8",
  shell: true,
  // The CLI's own errors (local Supabase not running, …) stay visible.
  stdio: ["ignore", "pipe", "inherit"],
  maxBuffer: 64 * 1024 * 1024,
});

const options = await prettier.resolveConfig(FILE);
const formatted = await prettier.format(generated, { ...options, filepath: FILE });
const stored = readFileSync(FILE, "utf8").replaceAll("\r\n", "\n");

if (formatted.replaceAll("\r\n", "\n") !== stored) {
  console.error(
    `${FILE} does not match the local database schema.\n` +
      "Apply the migrations (npm run db:migrate) and regenerate the types (npm run db:types).",
  );
  process.exit(1);
}
console.log("Database types match the local schema.");
