import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminDb,
  anonDb,
  ok,
  ownerDb,
  ownerId,
  strangerDb,
  strangerId,
  SUPABASE_URL,
  wipe,
} from "./helpers";

// Architecture rule: every table has user_id and row level security.
// The list of tables is read from the database itself (the API's own description), so a table
// added later is covered here without anyone remembering to list it; if it has no sample row
// below, the test fails and says so.

type Row = Record<string, unknown>;

/** One valid row per table. `ids` holds rows created earlier in the same pass. */
const SAMPLES: Record<string, (ids: Record<string, string>) => Row> = {
  areas: () => ({ slug: "saglik", name: "Sağlık" }),
  modules: (ids) => ({ slug: "okul", name: "Okul", area_id: ids.areas }),
  work_items: (ids) => ({ module_id: ids.modules, title: "Midterm hazırlığı", key: "a:1" }),
  tasks: (ids) => ({ module_id: ids.modules, work_item_id: ids.work_items, title: "Bölüm 1" }),
  rhythms: (ids) => ({
    module_id: ids.modules,
    title: "Süpürme",
    target_count: 2,
    period: "week",
  }),
  sessions: (ids) => ({ task_id: ids.tasks, module_id: ids.modules }),
  rhythm_logs: (ids) => ({ rhythm_id: ids.rhythms, session_id: ids.sessions }),
  block_series: (ids) => ({
    module_id: ids.modules,
    title: "Ders",
    weekday: 1,
    start_time: "09:00",
    end_time: "11:00",
  }),
  blocks: (ids) => ({
    series_id: ids.block_series,
    occurrence_on: "2026-11-16",
    title: "Ders",
    starts_at: "2026-11-16T09:00:00+03:00",
    ends_at: "2026-11-16T11:00:00+03:00",
  }),
  days: () => ({ date: "2026-11-12" }),
  week_plans: () => ({ week_start: "2026-11-09" }),
  horizon_reviews: () => ({ scope: "month", period_start: "2026-11-01" }),
  life_mode_periods: () => ({ mode: "busy", starts_on: "2026-11-09", ends_on: "2026-11-15" }),
  inbox_entries: () => ({ raw_text: "çamaşır birikti" }),
  prompts: (ids) => ({ module_id: ids.modules, kind: "attendance", question: "Derse girdin mi?" }),
  events: () => ({ type: "deneme.item_added", module_slug: "deneme" }),
  weekly_reviews: () => ({ week_start: "2026-11-09" }),
  planner_stats: () => ({ key: "capacity:home:evening", value: 0.7 }),
  settings: () => ({}),
  deneme_items: () => ({ title: "Deneme kaydı" }),
};

/** Insert order: parents first. Tables not named here go last, in any order. */
const ORDER = [
  "areas",
  "modules",
  "work_items",
  "tasks",
  "rhythms",
  "sessions",
  "rhythm_logs",
  "block_series",
  "blocks",
];

/** Tables whose rows are never changed or removed by design; the grants say so too. */
const NO_UPDATE = new Set(["events"]);
const NO_DELETE = new Set(["events", "inbox_entries"]);

async function exposedTables(): Promise<string[]> {
  const key = process.env.SUPABASE_SECRET_KEY!;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error(`API description answered ${response.status}`);
  const spec = (await response.json()) as { definitions: Record<string, unknown> };
  return Object.keys(spec.definitions);
}

// The generic table name defeats the typed client; these helpers work on plain names.
type AnyDb = { from: (table: string) => ReturnType<ReturnType<typeof adminDb>["from"]> };
const any = (db: unknown) => db as AnyDb;

describe("row level security on every table", () => {
  let tables: string[] = [];
  const ownerRows: Record<string, string> = {};
  const strangerRows: Record<string, string> = {};

  beforeAll(async () => {
    await wipe();
    tables = await exposedTables();
    const ordered = [...ORDER.filter((t) => tables.includes(t))].concat(
      tables.filter((t) => !ORDER.includes(t)),
    );

    // Each account fills every table with one row of its own, through its own session.
    for (const [db, rows] of [
      [ownerDb(), ownerRows],
      [strangerDb(), strangerRows],
    ] as const) {
      for (const table of ordered) {
        const sample = SAMPLES[table];
        if (!sample) continue;
        const row = ok(await any(db).from(table).insert(sample(rows)).select("id").single());
        rows[table] = (row as { id: string }).id;
      }
    }
  });

  afterAll(wipe);

  it("covers every table the API exposes", () => {
    expect(tables.length).toBeGreaterThanOrEqual(19);
    const missing = tables.filter((table) => !SAMPLES[table]);
    expect(missing, "add a sample row for these tables in tests/db/rls.test.ts").toEqual([]);
  });

  it("fills user_id from the session, not from the client", async () => {
    for (const table of tables) {
      const row = ok(
        await any(adminDb()).from(table).select("user_id").eq("id", ownerRows[table]).single(),
      ) as { user_id: string };
      expect(row.user_id, table).toBe(ownerId());
    }
  });

  it("shows each account only its own rows", async () => {
    for (const table of tables) {
      const rows = ok(await any(ownerDb()).from(table).select("id, user_id")) as unknown as {
        id: string;
        user_id: string;
      }[];
      expect(rows.length, table).toBeGreaterThan(0);
      expect(
        rows.every((row) => row.user_id === ownerId()),
        `${table}: owner sees only own rows`,
      ).toBe(true);
      expect(rows.map((row) => row.id)).not.toContain(strangerRows[table]);

      const direct = ok(
        await any(strangerDb()).from(table).select("id").eq("id", ownerRows[table]),
      ) as unknown[];
      expect(direct, `${table}: stranger asks for the owner's row by id`).toEqual([]);
    }
  });

  it("gives the public key alone nothing at all", async () => {
    for (const table of tables) {
      const { data, error } = await any(anonDb()).from(table).select("id");
      expect(error, `${table}: anonymous read is refused`).not.toBeNull();
      expect(data).toBeNull();

      const insert = await any(anonDb()).from(table).insert(SAMPLES[table](ownerRows));
      expect(insert.error, `${table}: anonymous insert is refused`).not.toBeNull();
    }
  });

  it("does not let another account change or remove a row", async () => {
    const admin = adminDb();
    for (const table of tables) {
      const before = ok(
        await any(admin).from(table).select("*").eq("id", ownerRows[table]).single(),
      ) as unknown as Row;

      if (!NO_UPDATE.has(table)) {
        const update = await any(strangerDb())
          .from(table)
          .update({ created_at: "2000-01-01T00:00:00Z" })
          .eq("id", ownerRows[table])
          .select("id");
        expect(update.data ?? [], `${table}: stranger update touches nothing`).toEqual([]);
      }
      if (!NO_DELETE.has(table)) {
        const removal = await any(strangerDb())
          .from(table)
          .delete()
          .eq("id", ownerRows[table])
          .select("id");
        expect(removal.data ?? [], `${table}: stranger delete touches nothing`).toEqual([]);
      }

      const after = ok(
        await any(admin).from(table).select("*").eq("id", ownerRows[table]).single(),
      ) as unknown as Row;
      expect(after, `${table}: the owner's row is unchanged`).toEqual(before);
    }
  });

  it("does not let an account write a row in another account's name", async () => {
    for (const table of tables) {
      const forged: Row = { ...SAMPLES[table](strangerRows), user_id: ownerId() };
      // Unique columns would hide the real reason for a refusal; make the row distinct.
      for (const column of ["slug", "key"]) {
        if (column in forged) forged[column] = `${String(forged[column])}-forged`;
      }
      for (const column of ["date", "week_start", "period_start", "occurrence_on"]) {
        if (column in forged) forged[column] = "2031-01-06";
      }
      const { error } = await any(strangerDb()).from(table).insert(forged);
      expect(error, `${table}: insert with the owner's user_id is refused`).not.toBeNull();
      expect(error!.code, table).toBe("42501");
    }
    expect(strangerId()).not.toBe(ownerId());
  });

  it("keeps the append-only tables append-only, even for their owner", async () => {
    const event = await ownerDb()
      .from("events")
      .update({ type: "changed" })
      .eq("id", ownerRows.events)
      .select("id");
    expect(event.error?.code).toBe("42501");
    const eventDelete = await ownerDb().from("events").delete().eq("id", ownerRows.events);
    expect(eventDelete.error?.code).toBe("42501");
    const inboxDelete = await ownerDb()
      .from("inbox_entries")
      .delete()
      .eq("id", ownerRows.inbox_entries);
    expect(inboxDelete.error?.code).toBe("42501");

    // The owner can still change an inbox entry's status.
    const routed = ok(
      await ownerDb()
        .from("inbox_entries")
        .update({ status: "dismissed" })
        .eq("id", ownerRows.inbox_entries)
        .select("status")
        .single(),
    );
    expect(routed.status).toBe("dismissed");
  });

  it("refuses the session functions to the public key", async () => {
    const start = await anonDb().rpc("start_session", { p_title: "x" });
    expect(start.error).not.toBeNull();
    const end = await anonDb().rpc("end_session", { p_session_id: ownerRows.sessions });
    expect(end.error).not.toBeNull();
    const done = await anonDb().rpc("complete_task", { p_task_id: ownerRows.tasks });
    expect(done.error).not.toBeNull();
    const archive = await anonDb().rpc("archive_module", { p_module_id: ownerRows.modules });
    expect(archive.error).not.toBeNull();
  });

  it("does not let the session functions reach another account's rows", async () => {
    const admin = adminDb();
    const stranger = strangerDb();

    const done = await stranger.rpc("complete_task", { p_task_id: ownerRows.tasks });
    expect(done.error).not.toBeNull();
    const start = await stranger.rpc("start_session", { p_task_id: ownerRows.tasks });
    expect(start.error).not.toBeNull();
    const end = await stranger.rpc("end_session", { p_session_id: ownerRows.sessions });
    expect(end.error).not.toBeNull();
    const archive = await stranger.rpc("archive_module", { p_module_id: ownerRows.modules });
    expect(archive.error).not.toBeNull();

    const task = ok(await admin.from("tasks").select("status").eq("id", ownerRows.tasks).single());
    expect(task.status).toBe("todo");
    const session = ok(
      await admin.from("sessions").select("ended_at").eq("id", ownerRows.sessions).single(),
    );
    expect(session.ended_at).toBeNull();
    const module = ok(
      await admin.from("modules").select("status").eq("id", ownerRows.modules).single(),
    );
    expect(module.status).toBe("active");
  });
});
