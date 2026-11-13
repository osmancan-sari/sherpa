import { describe, expect, it } from "vitest";
import { block, moduleRow, rhythm, task, workItem } from "@/core/testing/factories";
import { istanbulInstant } from "@/lib/date";
import { buildPlan } from "./plan";
import { DEFAULT_SETTINGS } from "./slots";
import type { Plan, PlanInput } from "./types";

// Ç3e: a facet is not an input of the planner (docs/06-modul-sozlesmesi.md, "Bölümler" rule 7;
// docs/12, bölüm F rule 9). The same input with facets on its work gives the same plan.

const DATE = "2026-11-12";
const at = (time: string) => istanbulInstant(DATE, time);

function input(withFacets: boolean): PlanInput {
  const facet = (key: string) => (withFacets ? key : null);
  const item = workItem({
    id: "11111111-0000-4000-8000-000000000001",
    title: "Rapor",
    effort_total_minutes: 120,
    session_minutes: 45,
    due_at: at("23:59").toISOString(),
    facet: facet("ders-1"),
  });
  return {
    now: at("08:00"),
    date: DATE,
    dayType: "home",
    lifeMode: "normal",
    dayStart: at("08:00"),
    finishLine: at("19:00"),
    blocks: [
      block({
        starts_at: at("12:00").toISOString(),
        ends_at: at("13:00").toISOString(),
        facet: facet("ders-1"),
      }),
    ],
    tasks: [
      task({
        id: "11111111-0000-4000-8000-000000000002",
        title: "Esneme",
        est_minutes: 20,
        facet: facet("sabah"),
      }),
      task({
        id: "11111111-0000-4000-8000-000000000003",
        title: "Rapor oturumu",
        work_item_id: item.id,
        est_minutes: 45,
        planned_date: DATE,
      }),
      task({
        id: "11111111-0000-4000-8000-000000000004",
        title: "Kitap",
        est_minutes: 30,
        facet: facet("aksam"),
        importance: 3,
      }),
    ],
    workItems: [item],
    rhythms: [
      rhythm({
        id: "11111111-0000-4000-8000-000000000005",
        title: "Yürüyüş",
        facet: facet("sabah"),
      }),
    ],
    rhythmLogs: [],
    modules: [moduleRow({ facet_colors: withFacets ? { sabah: "#e11d48" } : {} })],
    context: "desk",
    settings: DEFAULT_SETTINGS,
    stats: [],
  };
}

/** Everything the plan decides, without the rows it carries along. */
const decisions = (plan: Plan) => ({
  slots: plan.slots.map((slot) => [
    slot.kind,
    slot.start.toISOString(),
    slot.end.toISOString(),
    slot.assignment?.candidate.id ?? null,
    slot.assignment?.minutes ?? null,
  ]),
  top3: plan.top3,
  now: plan.now.kind,
  overflow: plan.overflow.map((candidate) => candidate.id),
  candidates: plan.candidates.map((candidate) => [candidate.id, candidate.score]),
  warnings: plan.warnings.map((warning) => [warning.kind, warning.subjectId]),
  usable: plan.usableMinutes,
  planned: plan.plannedMinutes,
});

describe("facets and the planner", () => {
  it("the same input with facets on its work gives the same plan", () => {
    const without = decisions(buildPlan(input(false)));
    const withFacets = decisions(buildPlan(input(true)));
    expect(withFacets).toEqual(without);
    // The plan is not empty: there is something to compare.
    expect(without.slots.some((slot) => slot[3] !== null)).toBe(true);
  });
});
