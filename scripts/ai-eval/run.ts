import { readFileSync } from "node:fs";
import { aiConfigFromEnv } from "@/core/ai/config";
import { type EvalReport, type EvalSuite, evaluateEnrich } from "@/core/ai/eval";
import { fakeProvider } from "@/core/ai/fake";
import { localSetup, signInAs } from "../local-user";

// Quality check of `enrich` (docs/10-yapay-zeka.md). Asks through the app's own gateway as the
// local account (ALLOWED_EMAIL, local Supabase), so every call is in `ai_calls` with its cost
// and counts against the month's budget.
//
//   npm run ai:eval              the real model: ANTHROPIC_API_KEY and AI_MODEL_FAST in
//                                .env.local; costs a few cents
//   npm run ai:eval -- --fake    the recorded fake provider, to try the script itself
//
// Run it when a prompt or the model changes. An unchanged prompt and model reuse the answers of
// an earlier run (the gateway's rule 10); change the prompt's version to ask again.

const percent = (share: number) => `${Math.round(share * 100)}%`;

function print(report: EvalReport) {
  console.log(`Model: ${report.model || "-"}`);
  console.log(`Answered: ${report.answered}/${report.total}`);
  if (report.answered === 0) console.log(`  ${report.rows[0]?.error ?? ""}`);
  console.log(`Routing (module): ${percent(report.routing)}`);
  console.log(`Task or work item: ${percent(report.target)}`);
  console.log(`Deadline: ${percent(report.due)}`);
  const error = report.minutesMedianError;
  console.log(`Duration, median error: ${error === null ? "-" : percent(error)}`);
  console.log(`Cost: ${report.costUsd.toFixed(4)} $ (${report.reused} answers reused)`);
  const misses = report.rows.filter((row) => !row.module || !row.target || !row.due);
  if (misses.length === 0) return;
  console.log("\nMisses:");
  for (const row of misses) {
    const got = row.output
      ? `module=${row.output.module.value} target=${row.output.target.value} due=${row.output.due.value} min=${row.output.est_minutes.value}`
      : `no answer (${row.error})`;
    console.log(`- ${row.text}\n    ${got}`);
  }
}

async function main() {
  const { url, email } = localSetup("The AI quality check");
  const suite = JSON.parse(
    readFileSync(new URL("./cases.json", import.meta.url), "utf8"),
  ) as EvalSuite;
  const fake = process.argv.includes("--fake");
  const db = await signInAs(url, email);
  const config = fake
    ? {
        provider: fakeProvider(),
        models: { fast: "fake-fast", plan: "fake-plan" },
        timeouts: { fast: 30_000, plan: 30_000 },
      }
    : aiConfigFromEnv({ ...process.env, SHERPA_AI_FAKE: undefined, AI_TIMEOUT_FAST_MS: "30000" });
  if (!config.provider) {
    throw new Error("ANTHROPIC_API_KEY is not set in .env.local (or use --fake).");
  }
  print(await evaluateEnrich({ db, config }, suite));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
