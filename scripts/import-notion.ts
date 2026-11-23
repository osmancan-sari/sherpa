// The one-time import of Okul's data from Notion (docs/08-notion-aktarim.md).
//
//   npm run import:notion                   a dry run: reads data/notion-export/, prints the counts, writes nothing
//   npm run import:notion -- --write        imports into the account of ALLOWED_EMAIL
//
// Writing needs the explicit --write: a flag that does not arrive (PowerShell swallows "--" and npm
// then takes the flags as its own) leaves a dry run, never a write. The flags are also read from
// npm's environment (npm_config_write, npm_config_remote, npm_config_env, npm_config_dir).
// Options: --dir <folder> (default data/notion-export), --env <file> (default .env.local).
// Local Supabase only unless --remote is given with an --env file that names another project:
// the production run is a step of its own, with the user's leave (dry run first, then the real one).
// The report prints counts only; the content of the export is never printed.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRegistry } from "@/core/contract/registry";
import { createModuleContext } from "@/core/data/context";
import { token } from "@/core/ui/tokens";
import { okul } from "@/modules/okul/module";
import { importExport } from "@/modules/okul/server/importer";
import { type NotionExport, readExport } from "@/modules/okul/server/notion";
import { env, localUserId, signInAs } from "./local-user";

/** The courses' colours, in order (the six of the frames; the user may change them). */
export const COURSE_PALETTE = (["violet", "orange", "teal", "sky", "pink", "green"] as const).map(
  (name) => token(`color-swatch-${name}`),
);

function option(name: string): string | null {
  const at = process.argv.indexOf(name);
  if (at >= 0) return process.argv[at + 1] ?? null;
  const npm = process.env[`npm_config_${name.slice(2)}`];
  return npm && npm !== "true" ? npm : null;
}

function flag(name: string): boolean {
  return process.argv.includes(name) || process.env[`npm_config_${name.slice(2)}`] === "true";
}

async function main() {
  const dryRun = !flag("--write");
  const remote = flag("--remote");
  const envFile = option("--env") ?? ".env.local";
  const dir = option("--dir") ?? join("data", "notion-export");
  process.loadEnvFile(envFile);
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const host = new URL(url).hostname;
  if (!remote && !["127.0.0.1", "localhost"].includes(host)) {
    throw new Error(
      `The import is local unless --remote is given; ${envFile} points at "${host}".`,
    );
  }
  const email = env("ALLOWED_EMAIL").trim().toLowerCase();

  const load = (name: string) => {
    try {
      return JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as Record<
        string,
        unknown
      >[];
    } catch {
      throw new Error(`Could not read ${join(dir, `${name}.json`)}.`);
    }
  };
  const data: NotionExport = {
    courses: load("courses"),
    assessments: load("assessments"),
    sessions: load("sessions"),
    tasks: load("tasks"),
  };

  await localUserId(url, email);
  const db = await signInAs(url, email);
  const { data: row, error } = await db
    .from("modules")
    .select("*")
    .eq("slug", "okul")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row && !dryRun) {
    throw new Error(
      'Okul is not switched on for this account: Ayarlar → Modüller → "Etkinleştir".',
    );
  }
  const registry = createRegistry([okul]);
  const ctx = createModuleContext({
    db,
    registry,
    // A dry run on an account without the module reads nothing of the module's: a stand-in row.
    module: row ?? ({ id: "00000000-0000-0000-0000-000000000000", slug: "okul" } as never),
    now: () => new Date(),
  });
  const read = readExport(data);
  const report = await importExport(ctx, read, { dryRun, palette: COURSE_PALETTE });

  console.log(dryRun ? "Dry run (nothing written):" : `Imported into ${host}:`);
  for (const [table, counts] of Object.entries(report.tables)) {
    console.log(`  ${table}: ${counts.inserted} new, ${counts.updated} already there`);
  }
  console.log(`  undated assessments ("Tahmin edilemeyen"): ${report.undated}`);
  console.log(`  project steps linked to their course's only project: ${report.stepsLinked}`);
  console.log(`  time notes without an hour (kept as text): ${report.unparsedTimeNotes}`);
  console.log("  weekly tasks left out, by kind:");
  for (const [kind, n] of Object.entries(report.skippedTasks)) console.log(`    ${kind}: ${n}`);
  if (report.problems.length > 0) {
    console.log("  rows not read whole:");
    for (const problem of report.problems) console.log(`    ${problem.kind}: ${problem.count}`);
  }
  console.log("  running total by course:");
  for (const [code, total] of Object.entries(report.totals)) console.log(`    ${code}: ${total}`);
  if (!dryRun) console.log(`  work proposed: ${report.proposed}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
