import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  cancelBlock,
  createBlock,
  createSeries,
  endSeries,
  ensureBlocksAhead,
  listBlocks,
  listSeries,
  restoreBlock,
  updateBlock,
  updateSeries,
} from "@/core/data/blocks";
import { CORE_EXPORT_TABLES, exportAll } from "@/core/data/export";
import { addInboxEntry, dismissEntry, listInbox, markRouted } from "@/core/data/inbox";
import { SERIES_HORIZON_DAYS } from "@/core/data/series";
import { createTask, listTasks } from "@/core/data/work";
import { dayKey, shiftDay, weekdayOf } from "@/lib/date";
import { CORE_TABLES, makeModule, ok, ownerDb, strangerDb, SUPABASE_URL, wipe } from "./helpers";

// Block series, the inbox and the export, against the real database.

const db = ownerDb();

beforeEach(wipe);
afterAll(wipe);

// A fixed "now": Thursday 12 November 2026, 10:40 in Istanbul.
const NOW = new Date("2026-11-12T10:40:00+03:00");
const TODAY = "2026-11-12";

const mondays = {
  title: "YZV406E",
  kind: "class" as const,
  weekday: 1,
  start_time: "09:00",
  end_time: "11:00",
};

const seriesBlocks = async (seriesId: string) =>
  ok(await db.from("blocks").select("*").eq("series_id", seriesId).order("occurrence_on"));

describe("a weekly series", () => {
  it("produces the coming weeks' blocks", async () => {
    const series = await createSeries(
      db,
      { ...mondays, location: "A101", day_type: "campus" },
      NOW,
    );
    const blocks = await seriesBlocks(series.id);

    expect(blocks).toHaveLength(8);
    expect(blocks.map((block) => block.occurrence_on)).toEqual(
      [16, 23, 30]
        .map((day) => `2026-11-${day}`)
        .concat(
          ["07", "14", "21", "28"].map((day) => `2026-12-${day}`),
          ["2027-01-04"],
        ),
    );
    for (const block of blocks) {
      expect(weekdayOf(block.occurrence_on!)).toBe(1);
      expect(block).toMatchObject({
        title: "YZV406E",
        kind: "class",
        location: "A101",
        day_type: "campus",
        status: "planned",
      });
      expect(block.occurrence_on! <= shiftDay(TODAY, SERIES_HORIZON_DAYS)).toBe(true);
    }
    expect(new Date(blocks[0].starts_at).toISOString()).toBe("2026-11-16T06:00:00.000Z");
    expect(new Date(blocks[0].ends_at).toISOString()).toBe("2026-11-16T08:00:00.000Z");
  });

  it("lets a single block be cancelled; the others stay and it is not produced again", async () => {
    const series = await createSeries(db, mondays, NOW);
    const [first] = await seriesBlocks(series.id);

    await cancelBlock(db, first.id);
    let blocks = await seriesBlocks(series.id);
    expect(blocks.map((block) => block.status)).toEqual([
      "cancelled",
      ...Array<string>(7).fill("planned"),
    ]);

    // Producing again, by the daily top-up or by editing the series, leaves it cancelled.
    expect(await ensureBlocksAhead(db, NOW)).toBe(0);
    await updateSeries(db, series.id, { location: "B202" }, NOW);
    blocks = await seriesBlocks(series.id);
    expect(blocks).toHaveLength(8);
    expect(blocks[0]).toMatchObject({ id: first.id, status: "cancelled", location: null });
    expect(blocks[1]).toMatchObject({ status: "planned", location: "B202" });

    await restoreBlock(db, first.id);
    expect((await seriesBlocks(series.id))[0].status).toBe("planned");
  });

  it("does not bring back the old time of a block that was moved by hand", async () => {
    const series = await createSeries(db, mondays, NOW);
    const [first] = await seriesBlocks(series.id);
    await updateBlock(db, first.id, {
      starts_at: "2026-11-16T14:00:00+03:00",
      ends_at: "2026-11-16T16:00:00+03:00",
    });

    await updateSeries(db, series.id, { start_time: "10:00", end_time: "12:00" }, NOW);
    await ensureBlocksAhead(db, NOW);

    const blocks = await seriesBlocks(series.id);
    expect(blocks).toHaveLength(8);
    expect(new Date(blocks[0].starts_at).toISOString()).toBe("2026-11-16T11:00:00.000Z");
    expect(blocks[0].provenance).toEqual({ starts_at: "user", ends_at: "user" });
    // The untouched ones follow the series to its new time.
    expect(new Date(blocks[1].starts_at).toISOString()).toBe("2026-11-23T07:00:00.000Z");
  });

  it("tops up the horizon as time passes, without touching what exists", async () => {
    const series = await createSeries(db, mondays, NOW);
    const before = await seriesBlocks(series.id);

    const twoWeeksOn = new Date("2026-11-26T10:40:00+03:00");
    expect(await ensureBlocksAhead(db, twoWeeksOn)).toBe(2);
    const after = await seriesBlocks(series.id);
    expect(after).toHaveLength(10);
    expect(after.slice(0, 8).map((block) => block.id)).toEqual(before.map((block) => block.id));
    expect(after.at(-1)!.occurrence_on).toBe("2027-01-18");
    // Running it again on the same day adds nothing.
    expect(await ensureBlocksAhead(db, twoWeeksOn)).toBe(0);
  });

  it("respects the series' own start and end", async () => {
    const series = await createSeries(
      db,
      { ...mondays, valid_from: "2026-11-20", valid_to: "2026-12-10" },
      NOW,
    );
    expect((await seriesBlocks(series.id)).map((block) => block.occurrence_on)).toEqual([
      "2026-11-23",
      "2026-11-30",
      "2026-12-07",
    ]);
  });

  it("ends from today on: coming blocks go, past blocks stay", async () => {
    const series = await createSeries(db, { ...mondays, valid_from: "2026-11-01" }, NOW);
    ok(
      await db
        .from("blocks")
        .insert({
          series_id: series.id,
          occurrence_on: "2026-11-09",
          title: "YZV406E",
          starts_at: "2026-11-09T09:00:00+03:00",
          ends_at: "2026-11-09T11:00:00+03:00",
        })
        .select()
        .single(),
    );
    await endSeries(db, series.id, NOW);

    expect((await seriesBlocks(series.id)).map((block) => block.occurrence_on)).toEqual([
      "2026-11-09",
    ]);
    expect(await listSeries(db, NOW)).toEqual([]);
    expect(await ensureBlocksAhead(db, NOW)).toBe(0);
  });

  it("lists the blocks from today on, one-off blocks included", async () => {
    await createSeries(db, mondays, NOW);
    await createBlock(db, {
      title: "Diş hekimi",
      starts_at: "2026-11-12T16:00:00+03:00",
      ends_at: "2026-11-12T17:00:00+03:00",
    });
    await createBlock(db, {
      title: "Geçen hafta",
      starts_at: "2026-11-05T16:00:00+03:00",
      ends_at: "2026-11-05T17:00:00+03:00",
    });
    const blocks = await listBlocks(db, NOW);
    expect(blocks.map((block) => block.title)).toEqual(["Diş hekimi", ...Array(8).fill("YZV406E")]);
    expect(dayKey(new Date(blocks[0].starts_at))).toBe(TODAY);
  });
});

describe("inbox", () => {
  it("keeps raw entries; routing and dismissing only change their status", async () => {
    const first = await addInboxEntry(db, "  çamaşır birikti ");
    const second = await addInboxEntry(db, "sunum slaytları");
    expect(first.raw_text).toBe("çamaşır birikti");
    expect((await listInbox(db)).map((entry) => entry.raw_text)).toEqual([
      "çamaşır birikti",
      "sunum slaytları",
    ]);

    const mod = await makeModule(db);
    const task = await createTask(db, { module_id: mod.id, title: "Çamaşır" });
    await markRouted(db, first.id, [{ type: "task", id: task.id, module: mod.slug }]);
    await dismissEntry(db, second.id);

    expect(await listInbox(db)).toEqual([]);
    const all = ok(await db.from("inbox_entries").select("*").order("created_at"));
    expect(all.map((entry) => entry.status)).toEqual(["routed", "dismissed"]);
    expect(all[0].routed).toEqual([{ type: "task", id: task.id, module: mod.slug }]);
    expect(all[0].routed_at).not.toBeNull();

    await expect(addInboxEntry(db, "   ")).rejects.toThrow();
  });
});

describe("tasks", () => {
  it("lists open tasks and the ones finished recently", async () => {
    const mod = await makeModule(db);
    await createTask(db, { module_id: mod.id, title: "Açık" });
    const done = await createTask(db, { module_id: mod.id, title: "Bugün biten" });
    ok(await db.rpc("complete_task", { p_task_id: done.id }));
    ok(
      await db
        .from("tasks")
        .insert({
          module_id: mod.id,
          title: "Eski",
          status: "done",
          done_at: "2026-01-01T10:00:00Z",
        })
        .select()
        .single(),
    );
    ok(
      await db
        .from("tasks")
        .insert({ module_id: mod.id, title: "Bırakılan", status: "dropped" })
        .select()
        .single(),
    );
    const titles = (await listTasks(db, new Date())).map((task) => task.title).sort();
    expect(titles).toEqual(["Açık", "Bugün biten"]);
  });

  it("gives a new task the default length and trims its title", async () => {
    const mod = await makeModule(db);
    const task = await createTask(db, { module_id: mod.id, title: "  Fatura öde " });
    expect(task).toMatchObject({
      title: "Fatura öde",
      est_minutes: 30,
      status: "todo",
      importance: 2,
    });
    await expect(
      createTask(db, { module_id: mod.id, title: "Uzun", est_minutes: 120 }),
    ).rejects.toThrow();
  });
});

describe("export", () => {
  it("covers every core table the database has", async () => {
    const key = process.env.SUPABASE_SECRET_KEY!;
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const spec = (await response.json()) as { definitions: Record<string, unknown> };
    const coreTables = Object.keys(spec.definitions).filter(
      (table) => !table.startsWith("deneme_"),
    );
    expect([...CORE_EXPORT_TABLES].sort()).toEqual(coreTables.sort());
    expect([...CORE_TABLES].sort()).toEqual(coreTables.sort());
  });

  it("returns every row the user owns, and nothing of anyone else", async () => {
    const mod = await makeModule(db);
    const task = await createTask(db, { module_id: mod.id, title: "Benim işim" });
    await addInboxEntry(db, "benim notum");
    await createSeries(db, mondays, NOW);

    const theirs = await makeModule(strangerDb(), "onlarin", "Onların");
    await createTask(strangerDb(), { module_id: theirs.id, title: "Onların işi" });

    const document = await exportAll(db, [], NOW);
    expect(document).toMatchObject({ app: "sherpa", format: 1, exported_at: NOW.toISOString() });
    expect(Object.keys(document.tables).sort()).toEqual([...CORE_EXPORT_TABLES].sort());
    expect(document.tables.tasks).toEqual([
      expect.objectContaining({ id: task.id, title: "Benim işim" }),
    ]);
    expect(document.tables.modules.map((row) => row.slug)).toEqual(["sinama"]);
    expect(document.tables.inbox_entries).toHaveLength(1);
    expect(document.tables.block_series).toHaveLength(1);
    expect(document.tables.blocks).toHaveLength(8);
    expect(document.tables.days).toEqual([]);
    expect(JSON.stringify(document)).not.toContain("Onların");
    // It survives a round trip as JSON.
    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });

  it("reads tables longer than one page in full", async () => {
    const mod = await makeModule(db);
    const rows = Array.from({ length: 1205 }, (_, index) => ({
      module_id: mod.id,
      title: `İş ${index}`,
    }));
    ok(await db.from("tasks").insert(rows).select("id"));
    const document = await exportAll(db, [], NOW);
    expect(document.tables.tasks).toHaveLength(1205);
    expect(new Set(document.tables.tasks.map((row) => row.id)).size).toBe(1205);
  });
});
