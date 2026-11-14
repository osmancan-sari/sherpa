import { type FrameSettings, toStoredFrame } from "@/core/contract/frame";
import { dayStartClock, plannerSettings, planningDay } from "@/core/planner";
import type { BedUndo, DayFrameRecord } from "@/core/contract/types";
import {
  check,
  type Db,
  type DayRow,
  toJson,
  unwrap,
  type WakeSource,
  wakeSourceOf,
} from "@/core/types";

// The day's frame in the data (docs/03-veri-modeli.md, `days`, `settings.day_frame`): waking
// and bedtime as they happen, the user's own values for one day, what the sleep plan chose,
// and the settings. Each write is one upsert of the day's row.

const onDay = { onConflict: "user_id,date" } as const;

/**
 * "Uyandım" (or a moment before it): the day's waking, said by the user on a screen; or told
 * from outside (`core/wake`, Ç3g: `source` "outside").
 */
export async function recordWake(
  db: Db,
  date: string,
  at: Date,
  source: Exclude<WakeSource, "estimate"> = "screen",
): Promise<DayRow> {
  return unwrap(
    await db
      .from("days")
      .upsert(
        { date, woke_at: at.toISOString(), woke_estimated: false, woke_source: source },
        onDay,
      )
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
    .update({ woke_at: at.toISOString(), woke_estimated: true, woke_source: "estimate" })
    .eq("date", date)
    .is("woke_at", null)
    .select();
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

/**
 * "Yatıyorum": tonight's bedtime. Not said, nothing is written: the app never makes one up.
 * `sessionId`: the scene's "Yatıyorum" (`controls.bed()`) that closed this session; only such a
 * bedtime can be taken back (`undoSceneBed`). Any other way clears the link.
 */
export async function recordBed(
  db: Db,
  date: string,
  at: Date,
  sessionId: string | null = null,
): Promise<DayRow> {
  return unwrap(
    await db
      .from("days")
      .upsert({ date, bed_at: at.toISOString(), bed_session_id: sessionId }, onDay)
      .select()
      .single(),
  );
}

/**
 * Rutin 1: takes back the bedtime a scene's "Yatıyorum" wrote, within 10 minutes: the bedtime is
 * gone and the session runs again. "expired" and "changed" (written another way since, or
 * another session started) change nothing. Two screens at once get one result.
 */
export async function undoSceneBed(db: Db, sessionId: string): Promise<BedUndo> {
  const { data, error } = await db.rpc("undo_scene_bed", { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  if (data !== "undone" && data !== "expired" && data !== "changed") {
    throw new Error(`undo_scene_bed answered ${String(data)}`);
  }
  return data;
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

export type { DayFrameRecord };

export async function listDayFrames(db: Db, sinceDay: string): Promise<DayFrameRecord[]> {
  const rows = unwrap(
    await db
      .from("days")
      .select("date, woke_at, woke_estimated, woke_source, bed_at, planned_wake, planned_bed")
      .gte("date", sinceDay)
      .order("date"),
  );
  return rows.map((row) => ({
    date: row.date,
    wokeAt: row.woke_at,
    wokeEstimated: row.woke_estimated,
    wokeFrom: wakeSourceOf(row),
    bedAt: row.bed_at,
    plannedWake: row.planned_wake?.slice(0, 5) ?? null,
    plannedBed: row.planned_bed?.slice(0, 5) ?? null,
  }));
}

/**
 * Ç3g: the core's planning day of a moment, as the Today screen counts it then (a moment before
 * the night ends is the day before's): for modules (`ctx.day`) and the session events (`day`).
 */
export async function planningDayOf(db: Db, at: Date): Promise<string> {
  const { data } = await db.from("settings").select("*").maybeSingle();
  return planningDay(at, dayStartClock(plannerSettings(data ?? null)));
}
