import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { WorkProposal } from "@/core/contract/types";
import { loadPlanRows, weekInput } from "@/core/data/keep";
import { propose } from "@/core/data/propose";
import { updateWorkItem } from "@/core/data/work";
import { loadByWeek } from "@/core/planner/week";
import { dayKey, istanbulInstant, shiftDay, weekStart } from "@/lib/date";
import { makeModule, ok, ownerDb, wipe } from "./helpers";

// Okul çekirdek A (docs/06-modul-sozlesmesi.md, "İş zarfı"): a placeholder effort and its one
// sentence, against the real database through the envelope: kept, taken away when the module
// gives the real effort, never laid on the user's own effort, and counted in the week's load.

const db = ownerDb();

beforeEach(wipe);
afterAll(wipe);

const SOURCE = { type: "sinama.sinav", id: "4b0e7f61-2a5c-4d0e-8f3a-6c1d9e2b7a40" };
const BASIS = "Önceki iki midterm 7 ve 9 saat sürdü.";

function prep(effort: WorkProposal["effort"], due: string): WorkProposal {
  return {
    schema: 1,
    key: "sinav:1:hazirlik",
    source: SOURCE,
    title: "Midterm hazırlığı",
    when: { due },
    effort,
  };
}

const item = async () => ok(await db.from("work_items").select("*").single());

describe("a placeholder effort", () => {
  it("is kept with its sentence; the module's real effort later takes both away", async () => {
    const mod = await makeModule(db);
    const due = istanbulInstant(shiftDay(dayKey(new Date()), 10), "10:00").toISOString();
    await propose(db, mod, prep({ total_minutes: 480, provisional: true, basis: BASIS }, due));
    expect(await item()).toMatchObject({
      effort_total_minutes: 480,
      effort_provisional: true,
      effort_basis: BASIS,
    });

    const result = await propose(db, mod, prep({ total_minutes: 420 }, due));
    expect(result.changed).toEqual(
      expect.arrayContaining(["effort_total_minutes", "effort_provisional", "effort_basis"]),
    );
    const real = await item();
    expect(real).toMatchObject({
      effort_total_minutes: 420,
      effort_provisional: false,
      effort_basis: null,
    });
    expect(real.provenance).toMatchObject({ effort_total_minutes: "module" });
  });

  it("never lies on the user's own effort, and the user's effort is never overwritten", async () => {
    const mod = await makeModule(db);
    const due = istanbulInstant(shiftDay(dayKey(new Date()), 10), "10:00").toISOString();
    await propose(db, mod, prep({ total_minutes: 480, provisional: true, basis: BASIS }, due));
    const { id } = await item();
    // The user gives the effort by hand: theirs, and no longer a placeholder.
    await updateWorkItem(db, id, { effort_total_minutes: 300 });
    expect(await item()).toMatchObject({
      effort_total_minutes: 300,
      effort_provisional: false,
      effort_basis: null,
    });
    // The module proposes a placeholder again: the user's effort stays, unmarked.
    const again = await propose(
      db,
      mod,
      prep({ total_minutes: 600, provisional: true, basis: BASIS }, due),
    );
    expect(again.kept).toContain("effort_total_minutes");
    expect(await item()).toMatchObject({
      effort_total_minutes: 300,
      effort_provisional: false,
      effort_basis: null,
    });
  });

  it("counts in the week's load like any effort", async () => {
    const mod = await makeModule(db);
    const now = new Date();
    // Due at the end of next week: the effort is spread over this week and the next.
    const nextWeek = shiftDay(weekStart(dayKey(now)), 7);
    const due = istanbulInstant(shiftDay(nextWeek, 6), "20:00").toISOString();
    await propose(db, mod, prep({ total_minutes: 600, provisional: true, basis: BASIS }, due));
    const input = weekInput(await loadPlanRows(db, now), now);
    const weeks = loadByWeek(input, { from: weekStart(dayKey(now)), weeks: 3 });
    const total = weeks.reduce((sum, week) => sum + (week.byModule[mod.id] ?? 0), 0);
    expect(Math.round(total)).toBe(600);
  });

  it("refuses a sentence longer than 200 characters or over two lines", async () => {
    const mod = await makeModule(db);
    const due = istanbulInstant(shiftDay(dayKey(new Date()), 10), "10:00").toISOString();
    await expect(
      propose(db, mod, prep({ provisional: true, basis: "x".repeat(201) }, due)),
    ).rejects.toThrow(/effort.basis/);
    // The column refuses it too, whoever writes it.
    const direct = await db.from("work_items").insert({
      module_id: mod.id,
      title: "Elle",
      effort_basis: "bir\niki",
    });
    expect(direct.error?.code).toBe("23514");
  });
});
