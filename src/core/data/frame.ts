import { type FrameSettings, toStoredFrame } from "@/core/contract/frame";
import { check, type Db, type DayRow, toJson, unwrap } from "@/core/types";

// The day's frame in the data (docs/03-veri-modeli.md, `days`, `settings.day_frame`): waking
// and bedtime as they happen, the user's own values for one day, what the sleep plan chose,
// and the settings. Each write is one upsert of the day's row.

const onDay = { onConflict: "user_id,date" } as const;

/** "Uyandım" (or a moment before it): the day's waking, said by the user. */
export async function recordWake(db: Db, date: string, at: Date): Promise<DayRow> {
  return unwrap(
    await db
      .from("days")
      .upsert({ date, woke_at: at.toISOString(), woke_estimated: false }, onDay)
      .select()
      .single(),
  );
}

/**
 * Nobody said "Uyandım" but the user touched a screen: the waking is taken from that moment and
 * marked estimated. Only when no waking is recorded yet; returns the row when it wrote one.
 */
export async function estimateWake(db: Db, date: string, at: Date): Promise<DayRow | null> {
  check(await db.from("days").upsert({ date }, { ...onDay, ignoreDuplicates: true }));
  const { data, error } = await db
    .from("days")
    .update({ woke_at: at.toISOString(), woke_estimated: true })
    .eq("date", date)
    .is("woke_at", null)
    .select();
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

/** "Yatıyorum": tonight's bedtime. Not said, nothing is written: the app never makes one up. */
export async function recordBed(db: Db, date: string, at: Date): Promise<DayRow> {
  return unwrap(
    await db.from("days").upsert({ date, bed_at: at.toISOString() }, onDay).select().single(),
  );
}

/**
 * The user's own value for one day only: "yarın erken kalkacağım" (`wake`, on tomorrow's row),
 * "bu gece geç yatacağım" (`bed`, on tonight's). "HH:mm", or null to take it back.
 */
export async function setExpected(
  db: Db,
  date: string,
  value: { wake?: string | null; bed?: string | null },
): Promise<DayRow> {
  const row: { date: string; expected_wake?: string | null; expected_bed?: string | null } = {
    date,
  };
  if (value.wake !== undefined) row.expected_wake = value.wake;
  if (value.bed !== undefined) row.expected_bed = value.bed;
  return unwrap(await db.from("days").upsert(row, onDay).select().single());
}

/** What the sleep plan chose, kept on the days for the record ("HH:mm"). */
export async function savePlannedSleep(
  db: Db,
  rows: { date: string; planned_wake?: string; planned_bed?: string }[],
): Promise<void> {
  for (const row of rows) check(await db.from("days").upsert(row, onDay));
}

/** Settings → Günün çerçevesi. Null switches the frame off. */
export async function saveDayFrame(db: Db, frame: FrameSettings | null): Promise<void> {
  check(
    await db
      .from("settings")
      .upsert(
        { day_frame: frame ? toJson(toStoredFrame(frame)) : null },
        { onConflict: "user_id" },
      ),
  );
}

/** The days' waking and bedtime as a module reads them (`ctx.days`). */
export type DayFrameRecord = {
  date: string;
  wokeAt: string | null;
  wokeEstimated: boolean;
  bedAt: string | null;
  plannedWake: string | null;
  plannedBed: string | null;
};

export async function listDayFrames(db: Db, sinceDay: string): Promise<DayFrameRecord[]> {
  const rows = unwrap(
    await db
      .from("days")
      .select("date, woke_at, woke_estimated, bed_at, planned_wake, planned_bed")
      .gte("date", sinceDay)
      .order("date"),
  );
  return rows.map((row) => ({
    date: row.date,
    wokeAt: row.woke_at,
    wokeEstimated: row.woke_estimated,
    bedAt: row.bed_at,
    plannedWake: row.planned_wake?.slice(0, 5) ?? null,
    plannedBed: row.planned_bed?.slice(0, 5) ?? null,
  }));
}
