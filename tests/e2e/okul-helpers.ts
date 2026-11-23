import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createRegistry } from "@/core/contract/registry";
import type { ModuleContext } from "@/core/contract/types";
import { createModuleContext } from "@/core/data/context";
import { activateModule } from "@/core/data/module-rows";
import type { Database, TablesInsert } from "@/lib/supabase/database.types";
import { okul } from "@/modules/okul/module";
import { insertCourse, insertTerm } from "@/modules/okul/queries";
import { seedOkul } from "../../scripts/demo-okul";
import { runNow } from "./clock";
import { adminClient, type Cookie, PUBLISHABLE_KEY, readSession, SUPABASE_URL } from "./supabase";

// Okul's end-to-end data (prompts/okul-adim-1.md, "Testler"): written in the test account's own
// name through the module's rules, the way the app writes it; the sample term (scripts/demo-okul.ts)
// or a small term of its own for a scenario.

export async function userDb() {
  const state = JSON.parse(readFileSync("playwright/.auth/user.json", "utf8")) as {
    cookies: Cookie[];
  };
  const session = await readSession(state.cookies);
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    accessToken: async () => session.access_token,
  });
}

const registry = createRegistry([okul]);

/** Okul switched on, and its context at the run's moment (or `now`). */
export async function okulContext(now: () => Date = runNow): Promise<ModuleContext> {
  const db = await userDb();
  const row = await activateModule(db, registry, okul);
  return createModuleContext({ db, registry, module: row, now });
}

/** The sample term (made up; the frames' six courses). */
export async function sampleTerm(now: Date = runNow()) {
  return seedOkul(await userDb(), now);
}

/** A term of one or two courses for a scenario. */
export async function smallTerm(
  ctx: ModuleContext,
  courses: Omit<TablesInsert<"okul_courses">, "term_id">[],
) {
  const term = await insertTerm(ctx, {
    name: "26-27 Güz",
    starts_on: "2026-09-28",
    ends_on: "2027-01-31",
    finals_from: "2027-01-02",
    finals_to: "2027-01-17",
  });
  const rows = [];
  for (const course of courses) rows.push(await insertCourse(ctx, { ...course, term_id: term.id }));
  return rows;
}

/**
 * What the AI's `size` would write (the run has no AI behind its seeding): the work's effort and
 * its sitting's length, as the AI's.
 */
export async function sized(key: string, total: number, sitting?: number) {
  const admin = adminClient();
  const { data, error } = await admin.from("work_items").select("*").eq("key", key).single();
  if (error) throw new Error(error.message);
  const provenance = {
    ...(data.provenance as object),
    effort_total_minutes: "ai",
    ...(sitting ? { session_minutes: "ai" } : {}),
  };
  const { error: writeError } = await admin
    .from("work_items")
    .update({
      effort_total_minutes: total,
      ...(sitting ? { session_minutes: sitting } : {}),
      provenance,
    })
    .eq("id", data.id);
  if (writeError) throw new Error(writeError.message);
  return data.id as string;
}

/** "HH:MM" of an instant in Istanbul. */
export const hhmm = (at: Date) =>
  at.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
