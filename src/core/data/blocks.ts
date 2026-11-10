import { markUserEdited } from "@/core/contract/envelope";
import {
  type Block,
  type BlockSeries,
  check,
  type Db,
  type Provenance,
  unwrap,
} from "@/core/types";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { dayKey, shiftDay } from "@/lib/date";
import { expandSeries, SERIES_HORIZON_DAYS } from "./series";

// Fixed blocks: weekly series, the concrete blocks generated from them, and one-off blocks.

/** Blocks from the start of today onwards, as far as the generation horizon. */
export async function listBlocks(db: Db, now: Date): Promise<Block[]> {
  const today = dayKey(now);
  return unwrap(
    await db
      .from("blocks")
      .select("*")
      .gte("ends_at", `${shiftDay(today, -1)}T21:00:00Z`)
      .lte("starts_at", `${shiftDay(today, SERIES_HORIZON_DAYS + 1)}T21:00:00Z`)
      .order("starts_at"),
  );
}

/** Series that are still running or start later. */
export async function listSeries(db: Db, now: Date): Promise<BlockSeries[]> {
  return unwrap(
    await db
      .from("block_series")
      .select("*")
      .or(`valid_to.is.null,valid_to.gte.${dayKey(now)}`)
      .order("weekday")
      .order("start_time"),
  );
}

export type NewSeries = Pick<
  TablesInsert<"block_series">,
  "title" | "kind" | "weekday" | "start_time" | "end_time"
> &
  Partial<
    Pick<
      TablesInsert<"block_series">,
      | "id"
      | "module_id"
      | "location"
      | "day_type"
      | "valid_from"
      | "valid_to"
      | "travel_before_min"
      | "travel_after_min"
    >
  >;

function blockFromSeries(series: BlockSeries, occurrence: ReturnType<typeof expandSeries>[number]) {
  return {
    series_id: series.id,
    module_id: series.module_id,
    title: series.title,
    kind: series.kind,
    location: series.location,
    travel_before_min: series.travel_before_min,
    travel_after_min: series.travel_after_min,
    day_type: series.day_type,
    ...occurrence,
  };
}

/**
 * Brings a series' coming blocks in line with the series: blocks nobody touched are rebuilt,
 * blocks that were moved, edited or cancelled by hand are left exactly as they are.
 */
export async function syncSeriesBlocks(db: Db, series: BlockSeries, now: Date): Promise<void> {
  const today = dayKey(now);
  check(
    await db
      .from("blocks")
      .delete()
      .eq("series_id", series.id)
      .gte("occurrence_on", today)
      // A block of today that is already over happened; it is not rewritten.
      .gt("ends_at", now.toISOString())
      .eq("status", "planned")
      .eq("provenance", "{}"),
  );
  const occurrences = expandSeries(series, today, shiftDay(today, SERIES_HORIZON_DAYS));
  if (occurrences.length === 0) return;
  check(
    await db.from("blocks").upsert(
      occurrences.map((occurrence) => blockFromSeries(series, occurrence)),
      { onConflict: "series_id,occurrence_on", ignoreDuplicates: true },
    ),
  );
}

/**
 * Tops up the coming weeks of every running series. Runs when the app opens, so the calendar
 * stays filled without anyone doing anything; existing blocks are never touched.
 */
export async function ensureBlocksAhead(db: Db, now: Date): Promise<number> {
  const today = dayKey(now);
  const until = shiftDay(today, SERIES_HORIZON_DAYS);
  const rows = (await listSeries(db, now)).flatMap((series) =>
    expandSeries(series, today, until).map((occurrence) => blockFromSeries(series, occurrence)),
  );
  if (rows.length === 0) return 0;
  const created = unwrap(
    await db
      .from("blocks")
      .upsert(rows, { onConflict: "series_id,occurrence_on", ignoreDuplicates: true })
      .select("id"),
  );
  return created.length;
}

export async function createSeries(db: Db, series: NewSeries, now: Date): Promise<BlockSeries> {
  const created = unwrap(
    await db
      .from("block_series")
      .insert({ ...series, title: series.title.trim() })
      .select()
      .single(),
  );
  await syncSeriesBlocks(db, created, now);
  return created;
}

export type SeriesEdit = Partial<
  Pick<
    BlockSeries,
    "title" | "kind" | "weekday" | "start_time" | "end_time" | "location" | "day_type" | "valid_to"
  >
>;

export async function updateSeries(
  db: Db,
  id: string,
  edit: SeriesEdit,
  now: Date,
): Promise<BlockSeries> {
  const updated = unwrap(await db.from("block_series").update(edit).eq("id", id).select().single());
  await syncSeriesBlocks(db, updated, now);
  return updated;
}

/**
 * Ends a series from today on. Past blocks stay (they happened); coming blocks go, including
 * the ones edited by hand, because the user is removing the whole series.
 */
export async function endSeries(db: Db, id: string, now: Date): Promise<void> {
  const today = dayKey(now);
  check(
    await db
      .from("block_series")
      .update({ valid_to: shiftDay(today, -1) })
      .eq("id", id),
  );
  check(
    await db
      .from("blocks")
      .delete()
      .eq("series_id", id)
      .gte("occurrence_on", today)
      .gt("ends_at", now.toISOString()),
  );
}

export type NewBlock = Pick<TablesInsert<"blocks">, "title" | "starts_at" | "ends_at"> &
  Partial<Pick<TablesInsert<"blocks">, "id" | "kind" | "module_id" | "location" | "day_type">>;

/** A one-off block. */
export async function createBlock(db: Db, block: NewBlock): Promise<Block> {
  return unwrap(
    await db
      .from("blocks")
      .insert({ ...block, title: block.title.trim() })
      .select()
      .single(),
  );
}

export type BlockEdit = Partial<
  Pick<Block, "title" | "starts_at" | "ends_at" | "location" | "kind" | "status">
>;

/** The user edits one block: the edited fields are remembered, so regeneration leaves it alone. */
export async function updateBlock(db: Db, id: string, edit: BlockEdit): Promise<Block> {
  const current = unwrap(await db.from("blocks").select("provenance").eq("id", id).single());
  const provenance = markUserEdited(current.provenance as Provenance, Object.keys(edit));
  return unwrap(
    await db
      .from("blocks")
      .update({ ...edit, provenance })
      .eq("id", id)
      .select()
      .single(),
  );
}

/** Cancels a single block; the rest of its series goes on. */
export async function cancelBlock(db: Db, id: string): Promise<Block> {
  return updateBlock(db, id, { status: "cancelled" });
}

/** Brings a cancelled block back. */
export async function restoreBlock(db: Db, id: string): Promise<Block> {
  return updateBlock(db, id, { status: "planned" });
}
