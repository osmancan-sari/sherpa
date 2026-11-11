import { beforeEach, describe, expect, it } from "vitest";
import { loadPlanRows } from "@/core/data/keep";
import { buildPlan, planInput } from "@/core/planner";
import { todayCandidates } from "@/core/today/select";
import { dayKey, istanbulInstant, shiftDay, weekStart } from "@/lib/date";
import { seedDemo } from "../../scripts/demo-data";
import { ok, ownerDb, strangerDb, wipe } from "./helpers";

// The sample data (scripts/demo-data.ts) the core is tried with until real modules arrive.

beforeEach(wipe);

describe("sample data", () => {
  it("fills an empty account through the envelope and the user's own paths", async () => {
    const db = ownerDb();
    const now = new Date();
    const summary = await seedDemo(db, now);

    expect(summary).toMatchObject({
      modules: 4,
      work_items: 5,
      rhythms: 4,
      series: 5,
      inbox: 3,
      ai_calls: 3,
    });
    expect(summary.blocks).toBeGreaterThan(30);
    expect(summary.sessions).toBe(26);

    // Module rows without code, each with work of its own.
    const modules = ok(await db.from("modules").select("*"));
    expect(modules.map((row) => row.slug).sort()).toEqual([
      "ev-ornek",
      "is-ornek",
      "okul-ornek",
      "saglik-ornek",
    ]);

    // Proposed work carries its key and source; an effort left open is the middle of the bounds.
    const items = ok(await db.from("work_items").select("*"));
    const midterm = items.find((item) => item.key === "assessment:bbf301e-midterm:prep")!;
    expect(midterm).toMatchObject({
      status: "active",
      effort_total_minutes: 360,
      due_is_hard: true,
      importance: 4,
      source_type: "okul.assessment",
    });
    expect(midterm.provenance).toMatchObject({ effort_total_minutes: "default", due_at: "module" });
    // The AI's part, played by the fake provider: an estimate inside the bounds, a task it read
    // from a line, and a card it was not sure about.
    const report = items.find((item) => item.key === "project:dl:report")!;
    expect(report.provenance).toMatchObject({ effort_total_minutes: "ai" });
    expect(report.effort_total_minutes).toBeGreaterThanOrEqual(180);
    expect(report.effort_total_minutes).toBeLessThanOrEqual(480);
    const read = ok(
      await db.from("tasks").select("*").eq("title", "Okul sunum slaytları").single(),
    );
    expect(read.ai).not.toBeNull();
    const card = ok(
      await db.from("inbox_entries").select("*").eq("raw_text", "perde ölçüsünü al").single(),
    );
    expect(card.status).toBe("needs_confirm");

    // A dependency proposed earlier is resolved to its record.
    const fixes = items.find((item) => item.key === "project:dl:proposal-fixes")!;
    expect(report.depends_on).toEqual([fixes.id]);

    // The fixed-time envelope became a block; the series produced theirs.
    const blocks = ok(await db.from("blocks").select("*"));
    expect(blocks.filter((block) => block.key !== null).map((block) => block.title)).toEqual([
      "BBF301E Midterm",
    ]);
    expect(blocks.filter((block) => block.series_id !== null).length).toBeGreaterThan(30);

    // The Today list has something to offer straight away; work that waits is not in it.
    const tasks = ok(await db.from("tasks").select("*"));
    const rhythms = ok(await db.from("rhythms").select("*"));
    const logs = ok(await db.from("rhythm_logs").select("*"));
    const candidates = todayCandidates({
      tasks,
      workItems: items,
      rhythms,
      rhythmLogs: logs,
      activeModuleIds: new Set(modules.map((row) => row.id)),
      now,
    });
    const titles = candidates.map((candidate) => candidate.title);
    expect(titles.length).toBeGreaterThan(8);
    expect(titles).toContain("YZV406E HW2: lokalizasyon soruları");
    expect(titles).not.toContain("DL ara raporu");
    expect(titles).not.toContain("Staj belgesi");

    // Nothing of it is visible to another account.
    expect(ok(await strangerDb().from("modules").select("id"))).toEqual([]);
    expect(ok(await strangerDb().from("work_items").select("id"))).toEqual([]);
  });

  it("keeps the lifelong module's weekly floor in busy mode (Ç3 acceptance)", async () => {
    const db = ownerDb();
    const now = new Date();
    await seedDemo(db, now);
    const rows = await loadPlanRows(db, now);
    // The week's last day, in busy mode, nothing done yet for the floor this week.
    const sunday = shiftDay(weekStart(dayKey(now)), 6);
    const morning = istanbulInstant(sunday, "08:00");
    const busy = [
      {
        id: "busy",
        user_id: "",
        mode: "busy" as const,
        starts_on: sunday,
        ends_on: sunday,
        note: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ];
    const input = {
      ...planInput({ ...rows, lifeModes: busy }, { date: sunday, now: morning, context: "desk" }),
      spentThisWeek: {},
      dayStart: morning,
    };
    expect(input.lifeMode).toBe("busy");
    const plan = buildPlan(input);
    const health = rows.modules.find((row) => row.slug === "saglik-ornek")!;
    const floor = plan.candidates.find(
      (row) => row.moduleId === health.id && row.mandatory === "floor",
    );
    expect(floor).toBeDefined();
    expect(plan.slots.some((slot) => slot.assignment?.candidate.id === floor!.id)).toBe(true);
    // Its weight in busy mode is low: only the floor brings it in, not its score.
    expect(floor!.score).toBeLessThan(
      plan.candidates.filter((row) => row.mandatory === null)[0]?.score ?? Infinity,
    );
  });

  it("commits this week and marks the busy week ahead", async () => {
    const db = ownerDb();
    await seedDemo(db, new Date());
    const [week] = ok(await db.from("week_plans").select("*"));
    expect(week.committed.length).toBeGreaterThan(0);
    const [period] = ok(await db.from("life_mode_periods").select("mode, note"));
    expect(period).toEqual({ mode: "busy", note: "Vize haftası" });
  });
});
