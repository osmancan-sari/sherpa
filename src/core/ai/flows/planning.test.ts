import { describe, expect, it } from "vitest";
import {
  buildPlan,
  commitWeek,
  DEFAULT_SETTINGS,
  type PlanInput,
  type PlanRows,
} from "@/core/planner";
import { moduleRow, rhythm, task, workItem } from "@/core/testing/factories";
import { istanbulInstant } from "@/lib/date";
import { adviceOf, MAX_CANDIDATES, planCallInput, weekCallInput } from "./planning";

// The planning flows' pure parts (src/core/ai/flows/planning.ts).

const DATE = "2026-11-12";
const at = (time: string) => istanbulInstant(DATE, time);

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    now: at("08:00"),
    date: DATE,
    dayType: "home",
    lifeMode: "normal",
    dayStart: at("08:00"),
    finishLine: at("19:00"),
    blocks: [],
    tasks: [],
    workItems: [],
    rhythms: [],
    rhythmLogs: [],
    modules: [moduleRow()],
    context: "desk",
    settings: DEFAULT_SETTINGS,
    stats: [],
    ...overrides,
  };
}

const rows = (overrides: Partial<PlanRows> = {}): PlanRows => ({
  settings: null,
  modules: [moduleRow()],
  tasks: [],
  workItems: [],
  rhythms: [],
  rhythmLogs: [],
  blocks: [],
  sessions: [],
  openSession: null,
  prompts: [],
  inbox: [],
  days: [],
  weekPlans: [],
  lifeModes: [],
  stats: [],
  ...overrides,
});

describe("the plan call's input", () => {
  it("is the engine's plan in short, at most 80 candidates, with the module's name", () => {
    const tasks = Array.from({ length: 90 }, (_, n) => task({ title: `İş ${n}`, est_minutes: 15 }));
    const plan = buildPlan(input({ tasks }));
    const call = planCallInput(rows({ tasks }), input({ tasks }), plan, "Erken kalk", false);
    expect(call.candidates).toHaveLength(MAX_CANDIDATES);
    expect(call.candidates[0]).toMatchObject({ module: "Deneme", minutes: 15, mandatory: null });
    expect(call).toMatchObject({ date: DATE, weekday: "perşembe", note: "Erken kalk" });
    expect(call.base.top3).toEqual(plan.top3);
    expect(call).not.toHaveProperty("done_today");
  });
});

describe("the AI's answer as advice", () => {
  it("keeps only the ids the engine knows, with their reasons", () => {
    const known = task({ title: "Bilinen" });
    const plan = buildPlan(input({ tasks: [known] }));
    const advice = adviceOf(
      {
        top3: [
          { id: known.id, reason: "En önemlisi." },
          { id: "uydurma", reason: "Yok." },
        ],
        prefer: [],
        defer: [{ id: "baska", reason: "Yok." }],
        estimates: [],
        warnings: [],
      },
      plan,
    );
    expect(advice).toEqual({
      top3: [known.id],
      prefer: [],
      defer: [],
      reasons: { [known.id]: "En önemlisi." },
    });
  });
});

describe("the week call's input", () => {
  it("gives each module only what its rhythms and floor need as the floor, and the engine's shares", () => {
    const mod = moduleRow({ kind: "lifelong", weekly_floor_minutes: 120 });
    const walk = rhythm({ module_id: mod.id, target_count: 2, est_minutes: 30 });
    const item = workItem({ module_id: mod.id, title: "Proje", effort_total_minutes: 300 });
    const monday = "2026-11-16";
    const week = {
      now: istanbulInstant(monday, "08:00"),
      weekStart: monday,
      items: [item],
      tasks: [],
      rhythms: [walk],
      modules: [mod],
      blocks: [],
      settings: DEFAULT_SETTINGS,
      stats: [],
      lifeMode: "normal" as const,
    };
    const base = commitWeek(week);
    const call = weekCallInput(
      week,
      base,
      rows({ modules: [mod], workItems: [item], rhythms: [walk] }),
    );
    // The floor (120) is more than the rhythm (60); the item's share is not part of it.
    expect(call.fixed_minutes).toEqual([{ module: "Deneme", minutes: 120 }]);
    expect(call.items).toMatchObject([
      { id: item.id, module: "Deneme", share_minutes: 45, required: false },
    ]);
    expect(call.base).toEqual([item.id]);
    expect(call.last_week).toBeNull();
  });
});
