import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRegistry } from "@/core/contract/registry";
import { createModuleContext } from "@/core/data/context";
import { okul } from "@/modules/okul/module";
import { importExport } from "@/modules/okul/server/importer";
import { type NotionExport, readExport } from "@/modules/okul/server/notion";
import { makeModule, MODULE_TABLES, ok, ownerDb, wipe } from "./helpers";

// The Notion import (docs/08-notion-aktarim.md; prompts/okul-adim-1.md, "Testler" → "Aktarım"),
// against an invented export (tests/fixtures/notion-export): a dry run writes nothing; the counts
// hold; a second run makes no copy; an undated assessment is not planned; only the open,
// unarchived follow-ups and materials of the weekly tasks come over; what the user changed stays.

const db = ownerDb();
const registry = createRegistry([okul]);
const PALETTE = ["#5fd6c6", "#c3a9ff"];

beforeEach(wipe);
afterAll(wipe);

function fixture(): NotionExport {
  const dir = join(process.cwd(), "tests", "fixtures", "notion-export");
  const load = (name: string) => JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8"));
  return {
    courses: load("courses"),
    assessments: load("assessments"),
    sessions: load("sessions"),
    tasks: load("tasks"),
  };
}

async function setup() {
  const row = await makeModule(db, "okul", "Okul");
  return createModuleContext({ db, registry, module: row, now: () => new Date() });
}

const OKUL_TABLES = MODULE_TABLES.filter((table) => table.startsWith("okul_"));
const count = async (table: string) =>
  (await db.from(table as "okul_terms").select("id", { count: "exact", head: true })).count;

describe("reading the export", () => {
  it("maps the four databases and says what it left out, by kind", () => {
    const read = readExport(fixture());
    expect(read.courses.map((course) => course.code)).toEqual(["SNM101E", "SNM202E"]);
    expect(read.courses[0]).toMatchObject({ weekday: 2, start_time: "09:30", end_time: null });
    // A schedule it cannot read stays as text, and is reported.
    expect(read.courses[1]).toMatchObject({ start_time: null, schedule_text: "öğleden sonra" });
    expect(read.assessments).toHaveLength(7);
    expect(read.assessments.filter((a) => a.date_status === "unknown")).toHaveLength(2);
    // "Belirsiz" with a date is an estimate; the hour is read from the time note.
    expect(read.assessments.find((a) => a.title === "Proposal")!.date_status).toBe("estimated");
    expect(read.assessments.find((a) => a.title === "Quiz 2")!.time).toBe("09:30");
    expect(read.assessments.find((a) => a.title === "Ödev 1")!.time).toBe("23:59");
    expect(read.unparsedTimeNotes).toBe(3);
    expect(read.problems).toEqual(
      expect.arrayContaining([
        { kind: "ders: saat okunamadı", count: 1 },
        { kind: "değerlendirme: ders eşleşmedi", count: 1 },
      ]),
    );
    expect(read.sessions).toHaveLength(5);
    expect(read.tasks.map((task) => [task.title, task.kind])).toEqual([
      ["Hocaya proje konusunu sor", "follow_up"],
      ["Kitap bölümü bul", "material"],
    ]);
    expect(read.skippedTasks).toEqual({
      Hazırlık: 1,
      Teslim: 1,
      Sınav: 1,
      "Veri Girişi": 1,
      Türsüz: 1,
      "Takip · arşivli": 1,
      "Materyal · bitti": 1,
    });
  });
});

describe("the import", () => {
  it("writes nothing on a dry run", async () => {
    const ctx = await setup();
    const report = await importExport(ctx, readExport(fixture()), {
      dryRun: true,
      palette: PALETTE,
    });
    expect(report.tables.okul_courses).toEqual({ inserted: 2, updated: 0 });
    expect(report.tables.okul_assessments).toEqual({ inserted: 7, updated: 0 });
    for (const table of OKUL_TABLES) expect(await count(table)).toBe(0);
    expect(ok(await db.from("work_items").select("id"))).toEqual([]);
    expect(ok(await db.from("blocks").select("id"))).toEqual([]);
  });

  it("holds the counts, plans nothing undated, and makes no copy the second time", async () => {
    const ctx = await setup();
    const first = await importExport(ctx, readExport(fixture()), {
      dryRun: false,
      palette: PALETTE,
    });
    expect(first.tables).toMatchObject({
      okul_terms: { inserted: 1, updated: 0 },
      okul_courses: { inserted: 2, updated: 0 },
      okul_assessments: { inserted: 7, updated: 0 },
      okul_sessions: { inserted: 5, updated: 0 },
      okul_tasks: { inserted: 2, updated: 0 },
    });
    expect(first.undated).toBe(2);
    expect(first.stepsLinked).toBe(1);
    expect(first.totals).toEqual({ SNM101E: 0, SNM202E: 0 });
    expect(await count("okul_courses")).toBe(2);
    expect(await count("okul_assessments")).toBe(7);
    expect(await count("okul_sessions")).toBe(5);
    expect(await count("okul_tasks")).toBe(2);
    const proposal = ok(
      await db.from("okul_assessments").select("parent_id").eq("title", "Proposal").single(),
    );
    expect(proposal.parent_id).not.toBeNull();

    // Undated assessments propose nothing ("Tahmin edilemeyen").
    const undated = ok(await db.from("okul_assessments").select("id").eq("date_status", "unknown"));
    const items = ok(await db.from("work_items").select("source_id"));
    expect(undated).toHaveLength(2);
    for (const row of undated) {
      expect(items.some((item) => item.source_id === row.id)).toBe(false);
    }

    const second = await importExport(ctx, readExport(fixture()), {
      dryRun: false,
      palette: PALETTE,
    });
    expect(second.tables).toMatchObject({
      okul_terms: { inserted: 0 },
      okul_courses: { inserted: 0, updated: 2 },
      okul_assessments: { inserted: 0, updated: 7 },
      okul_sessions: { inserted: 0, updated: 5 },
      okul_tasks: { inserted: 0, updated: 2 },
    });
    expect(await count("okul_courses")).toBe(2);
    expect(await count("okul_assessments")).toBe(7);
    expect(await count("okul_sessions")).toBe(5);
    expect(await count("okul_tasks")).toBe(2);
    expect(await count("okul_terms")).toBe(1);
  });

  it("keeps what the user changed since: a date, an attendance, a course's colour", async () => {
    const ctx = await setup();
    await importExport(ctx, readExport(fixture()), { dryRun: false, palette: PALETTE });
    const quiz = ok(await db.from("okul_assessments").select("*").eq("title", "Quiz 2").single());
    ok(
      await db
        .from("okul_assessments")
        .update({ date: "2026-12-17", date_source: "user", date_status: "exact" })
        .eq("id", quiz.id)
        .select(),
    );
    const lesson = ok(await db.from("okul_sessions").select("*").eq("topic", "Son konu").single());
    ok(
      await db
        .from("okul_sessions")
        .update({ attendance: "not_held", attendance_at: new Date().toISOString() })
        .eq("id", lesson.id)
        .select(),
    );
    ok(await db.from("okul_courses").update({ color: "#ff8fb8" }).eq("code", "SNM101E").select());

    await importExport(ctx, readExport(fixture()), { dryRun: false, palette: PALETTE });
    expect(
      ok(await db.from("okul_assessments").select("date, date_source").eq("id", quiz.id).single()),
    ).toEqual({ date: "2026-12-17", date_source: "user" });
    expect(
      ok(await db.from("okul_sessions").select("attendance").eq("id", lesson.id).single()),
    ).toEqual({ attendance: "not_held" });
    expect(
      ok(await db.from("okul_courses").select("color").eq("code", "SNM101E").single()),
    ).toEqual({ color: "#ff8fb8" });
  });
});
