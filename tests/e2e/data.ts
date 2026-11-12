import { adminClient } from "./supabase";

// Test data for the signed-in specs. Everything goes through the project owner's client and is
// written in the name of the one test account (ALLOWED_EMAIL on the local stack).

const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL!;

/** Children before parents, so rows can be removed in this order. */
const TABLES = [
  "ingest_requests",
  "device_tokens",
  "ai_calls",
  "ai_feedback",
  "deneme_items",
  "rhythm_logs",
  "sessions",
  "tasks",
  "work_items",
  "rhythms",
  "blocks",
  "block_series",
  "prompts",
  "events",
  "inbox_entries",
  "days",
  "week_plans",
  "horizon_reviews",
  "life_mode_periods",
  "weekly_reviews",
  "planner_stats",
  "settings",
  "modules",
  "areas",
];

let cachedUserId: string | null = null;

export async function userId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const { data, error } = await adminClient().auth.admin.listUsers();
  if (error) throw new Error(`Could not list users: ${error.message}`);
  const user = data.users.find((candidate) => candidate.email === ALLOWED_EMAIL.toLowerCase());
  if (!user) throw new Error(`The test account ${ALLOWED_EMAIL} does not exist.`);
  cachedUserId = user.id;
  return user.id;
}

/**
 * The test account's day: from midnight to a minute before the next. The tests run at any hour
 * (overnight too), and the planner leaves the time after the finish line to the night; with
 * the whole day as working time, what a test adds is planned whenever it runs. Tests of the
 * finish line and the night set their own times. The day's frame (Ç3c) is off: with it the
 * screen would greet the morning and quiet the evening at real hours; its specs switch it on.
 */
export const TEST_DAY = {
  day_start_default: "00:00",
  finish_line_default: "23:59",
  day_frame: null,
};

/** Removes everything the test account owns, and gives it the whole-day settings above. */
export async function resetData(): Promise<void> {
  const admin = adminClient();
  const id = await userId();
  for (const table of TABLES) {
    const { error } = await admin.from(table).delete().eq("user_id", id);
    if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
  }
  const { error } = await admin.from("settings").insert({ user_id: id, ...TEST_DAY });
  if (error) throw new Error(`Could not write the test settings: ${error.message}`);
}

type Row = Record<string, unknown>;

/** Inserts rows in the test account's name and returns them as stored. */
export async function insert<T extends Row = Row>(table: string, rows: Row | Row[]): Promise<T[]> {
  const id = await userId();
  const list = (Array.isArray(rows) ? rows : [rows]).map((row) => ({ ...row, user_id: id }));
  const { data, error } = await adminClient()
    .from(table)
    .insert(list, { defaultToNull: false })
    .select();
  if (error) throw new Error(`Could not insert into ${table}: ${error.message}`);
  return data as T[];
}

/** The test account's rows of a table, oldest first. */
export async function rows<T extends Row = Row>(table: string): Promise<T[]> {
  const id = await userId();
  const { data, error } = await adminClient()
    .from(table)
    .select("*")
    .eq("user_id", id)
    .order("created_at");
  if (error) throw new Error(`Could not read ${table}: ${error.message}`);
  return data as T[];
}

export async function update(table: string, id: string, patch: Row): Promise<void> {
  const { error } = await adminClient().from(table).update(patch).eq("id", id);
  if (error) throw new Error(`Could not update ${table}: ${error.message}`);
}

export type SeededModule = { id: string; slug: string; name: string };

/** A module row without code behind it, the way sample data has them. */
export async function seedModule(
  slug = "okul-ornek",
  name = "Okul",
  color = "#2563eb",
): Promise<SeededModule> {
  const [row] = await insert<SeededModule>("modules", { slug, name, color });
  return row;
}

/** Polls until the condition holds; for effects that land in the database a moment later. */
export async function waitFor<T>(
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  timeoutMs = 5000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let value = await read();
  while (!accept(value)) {
    if (Date.now() > deadline) {
      throw new Error(
        `Condition not met within ${timeoutMs} ms; last value: ${JSON.stringify(value)}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    value = await read();
  }
  return value;
}
