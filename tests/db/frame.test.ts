import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_FRAME } from "@/core/contract/frame";
import {
  estimateWake,
  listDayFrames,
  planningDayOf,
  recordBed,
  recordWake,
  saveDayFrame,
  savePlannedSleep,
  setExpected,
} from "@/core/data/frame";
import { getSettings } from "@/core/data/inbox";
import { istanbulInstant } from "@/lib/date";
import { ok, ownerDb, strangerDb, wipe } from "./helpers";

// The day's frame in the data (src/core/data/frame.ts): waking and bedtime, the user's own
// values for one day, the sleep plan's record, the settings (docs/03-veri-modeli.md).

const db = ownerDb();
beforeEach(wipe);
afterAll(wipe);

const DATE = "2026-11-18";
const at = (time: string, day = DATE) => istanbulInstant(day, time);
/** The day's row, its instants written the way `toISOString` writes them. */
const day = async (date = DATE) => {
  const row = (await db.from("days").select("*").eq("date", date).maybeSingle()).data;
  if (!row) return null;
  const iso = (value: string | null) => (value ? new Date(value).toISOString() : null);
  return { ...row, woke_at: iso(row.woke_at), bed_at: iso(row.bed_at) };
};

describe("waking", () => {
  it("'Uyandım' writes the waking; a moment before it is the user's too", async () => {
    await recordWake(db, DATE, at("07:10"));
    expect(await day()).toMatchObject({
      woke_at: at("07:10").toISOString(),
      woke_estimated: false,
    });
    await recordWake(db, DATE, at("06:40"));
    expect((await day())?.woke_at).toBe(at("06:40").toISOString());
  });

  it("a first touch without 'Uyandım' is an estimated waking, once; 'Uyandım' afterwards replaces it", async () => {
    const first = await estimateWake(db, DATE, at("08:05"));
    expect(first?.woke_estimated).toBe(true);
    expect(await estimateWake(db, DATE, at("09:00"))).toBeNull();
    expect((await day())?.woke_at).toBe(at("08:05").toISOString());
    await recordWake(db, DATE, at("07:30"));
    expect(await day()).toMatchObject({
      woke_at: at("07:30").toISOString(),
      woke_estimated: false,
    });
    // A real waking is never overwritten by a later touch.
    expect(await estimateWake(db, DATE, at("10:00"))).toBeNull();
  });

  it("an estimate keeps what the day row already holds", async () => {
    ok(await db.from("days").insert({ date: DATE, top3: [], closing_note: "not" }).select());
    await estimateWake(db, DATE, at("08:00"));
    expect(await day()).toMatchObject({ closing_note: "not", woke_estimated: true });
  });
});

describe("where the waking came from (Ç3g)", () => {
  it("a screen, outside (core/wake) or the first touch; the latest waking says it", async () => {
    await estimateWake(db, DATE, at("07:20"));
    expect(await day()).toMatchObject({ woke_source: "estimate", woke_estimated: true });
    await recordWake(db, DATE, at("07:05"), "outside");
    expect(await day()).toMatchObject({ woke_source: "outside", woke_estimated: false });
    await recordWake(db, DATE, at("07:00"));
    expect(await day()).toMatchObject({ woke_source: "screen" });
    const [frame] = await listDayFrames(db, DATE);
    expect(frame.wokeFrom).toBe("screen");
  });

  it("the column takes only the three sources", async () => {
    const { error } = await db.from("days").insert({ date: DATE, woke_source: "alarm" });
    expect(error?.message).toMatch(/check/);
  });
});

describe("the planning day (Ç3g)", () => {
  it("is the day before until the night ends: 05:00, or the waking range's start if earlier", async () => {
    expect(await planningDayOf(db, at("00:20", "2026-11-19"))).toBe(DATE);
    expect(await planningDayOf(db, at("05:10", "2026-11-19"))).toBe("2026-11-19");
    await saveDayFrame(db, { ...DEFAULT_FRAME, wake: ["04:30", "07:00"] });
    expect(await planningDayOf(db, at("04:40", "2026-11-19"))).toBe("2026-11-19");
  });
});

describe("bedtime and the user's values", () => {
  it("'Yatıyorum' writes tonight's bedtime on today's row, past midnight too", async () => {
    await recordBed(db, DATE, at("00:40", "2026-11-19"));
    expect((await day())?.bed_at).toBe(at("00:40", "2026-11-19").toISOString());
    expect(await day("2026-11-19")).toBeNull();
  });

  it("'geç yatacağım' and 'erken kalkacağım' change one day only, and can be taken back", async () => {
    await setExpected(db, DATE, { bed: "00:30" });
    await setExpected(db, "2026-11-19", { wake: "06:30" });
    expect(await day()).toMatchObject({ expected_bed: "00:30:00", expected_wake: null });
    expect(await day("2026-11-19")).toMatchObject({ expected_wake: "06:30:00" });
    await setExpected(db, DATE, { bed: null });
    expect((await day())?.expected_bed).toBeNull();
  });

  it("the sleep plan's choice is kept as a record", async () => {
    await savePlannedSleep(db, [
      { date: DATE, planned_bed: "23:30" },
      { date: "2026-11-19", planned_wake: "07:30" },
    ]);
    const frames = await listDayFrames(db, DATE);
    expect(frames).toEqual([
      expect.objectContaining({ date: DATE, plannedBed: "23:30", plannedWake: null }),
      expect.objectContaining({ date: "2026-11-19", plannedWake: "07:30" }),
    ]);
  });

  it("another account sees none of it", async () => {
    await recordWake(db, DATE, at("07:10"));
    expect(await listDayFrames(strangerDb(), DATE)).toEqual([]);
  });
});

describe("the frame's settings", () => {
  it("are saved and switched off", async () => {
    await saveDayFrame(db, { ...DEFAULT_FRAME, sleepMinutes: 450, startOnWake: true });
    expect((await getSettings(db))?.day_frame).toEqual({
      wake: ["06:00", "09:00"],
      bed: ["22:00", "01:00"],
      sleep_minutes: 450,
      start_on_wake: true,
    });
    await saveDayFrame(db, null);
    expect((await getSettings(db))?.day_frame).toBeNull();
  });
});

describe("ctx.days", () => {
  it("lets a module read the days' waking and bedtime", async () => {
    const { createModuleContext } = await import("@/core/data/context");
    const { createRegistry } = await import("@/core/contract/registry");
    const mod = ok(
      await db.from("modules").insert({ slug: "rutin", name: "Rutin" }).select().single(),
    );
    await recordWake(db, DATE, at("07:10"));
    await recordBed(db, DATE, at("23:20"));
    const ctx = createModuleContext({ db, registry: createRegistry([]), module: mod });
    expect(await ctx.days(DATE)).toEqual([
      expect.objectContaining({
        date: DATE,
        wokeAt: expect.any(String),
        wokeEstimated: false,
        bedAt: expect.any(String),
      }),
    ]);
  });
});
