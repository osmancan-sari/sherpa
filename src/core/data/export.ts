import { DataError, type Db } from "@/core/types";

// "Export everything": every row the user owns, as one JSON document. The data is never locked
// into the app (docs/02-mimari.md, "Yedek").

/** Every core table. A table added in a later phase is added here; a test compares this list with the database. */
export const CORE_EXPORT_TABLES = [
  "areas",
  "modules",
  "work_items",
  "tasks",
  "rhythms",
  "rhythm_logs",
  "block_series",
  "blocks",
  "sessions",
  "days",
  "week_plans",
  "horizon_reviews",
  "life_mode_periods",
  "inbox_entries",
  "prompts",
  "events",
  "weekly_reviews",
  "planner_stats",
  "settings",
  "ai_calls",
  "ai_feedback",
  "device_tokens",
  "ingest_requests",
  "job_runs",
] as const;

export const EXPORT_FORMAT = 1;
const PAGE = 1000;

export type ExportDocument = {
  app: "sherpa";
  format: typeof EXPORT_FORMAT;
  exported_at: string;
  tables: Record<string, Record<string, unknown>[]>;
};

type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      order: (column: string) => {
        range: (
          from: number,
          to: number,
        ) => PromiseLike<{
          data: Record<string, unknown>[] | null;
          error: { message: string; code?: string } | null;
        }>;
      };
    };
  };
};

async function readAll(db: Db, table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await (db as unknown as LooseDb)
      .from(table)
      .select("*")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new DataError(`${table}: ${error.message}`, error.code);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/**
 * Reads every core table and the given module tables in full. Row level security decides what
 * "everything" is: the rows of the signed-in user.
 */
export async function exportAll(
  db: Db,
  moduleTables: readonly string[],
  now: Date,
): Promise<ExportDocument> {
  const tables: ExportDocument["tables"] = {};
  for (const table of [...CORE_EXPORT_TABLES, ...new Set(moduleTables)]) {
    tables[table] = await readAll(db, table);
  }
  return { app: "sherpa", format: EXPORT_FORMAT, exported_at: now.toISOString(), tables };
}
