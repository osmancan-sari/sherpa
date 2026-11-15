import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRegistry } from "@/core/contract/registry";
import { createModuleContext } from "@/core/data/context";
import { rutin } from "@/modules/rutin/module";
import { listRoutines, listSteps } from "@/modules/rutin/queries";
import { proposeAll, writeStartList } from "@/modules/rutin/rules";
import { makeModule, ok, ownerDb, wipe } from "./helpers";

// Ç4c: the migration that switches Rutin's closing step ("Yarının listesi") on for a user who
// has the list already (supabase/migrations/20261116090000_rutin_closing_step_on.sql). On an
// empty database it touches nothing; here it runs again over a list as production holds it
// (the step off, phase 2, no length), through the local stack's own psql.

const MIGRATION = "supabase/migrations/20261116090000_rutin_closing_step_on.sql";
const db = ownerDb();
const registry = createRegistry([rutin]);

beforeEach(wipe);
afterAll(wipe);

function runMigration() {
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_sherpa",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    { input: readFileSync(MIGRATION, "utf8") },
  );
}

/** A user's list as written before Ç4c: the closing step off, phase 2, no length. */
async function before() {
  const row = await makeModule(db, "rutin", "Rutin");
  const ctx = createModuleContext({ db, registry, module: row });
  await writeStartList(ctx);
  const closing = (await listSteps(ctx)).find((step) => step.kind === "closing")!;
  ok(
    await db
      .from("rutin_steps")
      .update({
        active: false,
        phase: 2,
        minimum: true,
        seconds: 0,
        hint: "Çekirdeğin kapanışına geçer.",
      })
      .eq("id", closing.id)
      .select(),
  );
  await proposeAll(ctx);
  const evening = (await listRoutines(ctx)).find((routine) => routine.key === "aksam")!;
  const rhythm = async () =>
    ok(await db.from("rhythms").select("*").eq("source_id", evening.id).single());
  return { ctx, closing, rhythm };
}

describe("switching the closing step on for an existing list", () => {
  it("switches it on with its length and hint, and the evening's rhythm grows by it", async () => {
    const { ctx, closing, rhythm } = await before();
    expect((await rhythm()).est_minutes).toBe(9);
    runMigration();
    const step = (await listSteps(ctx)).find((row) => row.id === closing.id)!;
    expect(step).toMatchObject({
      active: true,
      phase: 1,
      minimum: false,
      seconds: 240,
      hint: "Yarının planına bak; aklında kalanları yaz.",
    });
    // As Rutin itself proposes it from the open steps (1 + 3 + 3 + 4 + 2).
    expect((await rhythm()).est_minutes).toBe(13);
    await proposeAll(ctx);
    expect((await rhythm()).est_minutes).toBe(13);
  });

  it("leaves a step the user switched off after it was on", async () => {
    const { ctx, closing, rhythm } = await before();
    // Switched off by the user later: phase 1.
    ok(await db.from("rutin_steps").update({ phase: 1 }).eq("id", closing.id).select());
    runMigration();
    expect((await listSteps(ctx)).find((row) => row.id === closing.id)!.active).toBe(false);
    expect((await rhythm()).est_minutes).toBe(9);
  });

  it("keeps a length the user typed for the evening's rhythm", async () => {
    const { ctx, closing, rhythm } = await before();
    const own = await rhythm();
    ok(
      await db
        .from("rhythms")
        .update({
          est_minutes: 20,
          provenance: { ...(own.provenance as Record<string, string>), est_minutes: "user" },
        })
        .eq("id", own.id)
        .select(),
    );
    runMigration();
    expect((await listSteps(ctx)).find((row) => row.id === closing.id)!.active).toBe(true);
    expect((await rhythm()).est_minutes).toBe(20);
  });
});
