import type { ModuleDefinition, ModuleFacet } from "@/core/contract/types";
import { dayKey } from "@/lib/date";
import { EveningTab, MorningTab } from "./components/StepsTab";
import { listRoutines, listRuns } from "./queries";
import { listeners, proposeAll, writeStartList } from "./rules";
import { rutinScene } from "./scene";
import { runDay } from "./server/flow";

// Rutin (docs/moduller/rutin.md): the morning's and the evening's care steps, one by one on the
// scene, and their record kept without a single entry. The steps are data (the module page edits
// them); nothing here names one.

/** The two facets (rutin.md, 1): the morning (two blocks) and the evening, each its own colour. */
export const FACETS: ModuleFacet[] = [
  { key: "sabah", name: "Sabah", color: "#ffd58a", scene: "rutin", tone: "calm" },
  { key: "aksam", name: "Akşam", color: "#aab6ff", scene: "rutin", tone: "calm" },
];

export const rutin: ModuleDefinition = {
  slug: "rutin",
  name: "Rutin",
  kind: "lifelong",
  area: { slug: "saglik", name: "Sağlık" },
  color: "#ffd58a",

  async facets() {
    return FACETS;
  },

  // 1. Main screen: the day's routines.
  async chip(ctx) {
    // The core's day: after midnight the evening is still the night before's (B3).
    const now = ctx.now();
    const morningDay = dayKey(now);
    const eveningDay = runDay(now, "aksam", []);
    const [routines, runs] = await Promise.all([
      listRoutines(ctx),
      listRuns(ctx, eveningDay < morningDay ? eveningDay : morningDay),
    ]);
    if (routines.length === 0) return { text: "liste yok", health: "ok" };
    const finished = (key: string) => {
      const routine = routines.find((row) => row.key === key);
      const day = key === "aksam" ? eveningDay : morningDay;
      return runs.some(
        (run) => run.routine_id === routine?.id && run.day === day && run.finished_at !== null,
      );
    };
    const morning = finished("sabah") && finished("hazirlik");
    const evening = finished("aksam");
    const text =
      morning && evening
        ? "sabah ve akşam yapıldı"
        : morning
          ? "sabah yapıldı"
          : evening
            ? "akşam yapıldı"
            : "bugün henüz başlamadı";
    return { text, health: "ok" };
  },

  // 2. No entries: the steps are edited on the module page; quick add adds none (rutin.md, 7).
  intake: [],

  // 3. Events: none published (nobody listens); the sessions open and close the runs.
  emits: [],
  on: listeners,

  // 4. The same in every mode: the routines stay once a day (rutin.md, 9).
  modeBehavior: {
    normal: { weightMultiplier: 1, floorMultiplier: 1 },
    busy: { weightMultiplier: 1, floorMultiplier: 1 },
    minimum: { weightMultiplier: 1, floorMultiplier: 1 },
    holiday: { weightMultiplier: 1, floorMultiplier: 1 },
  },

  // 5. Weekly report: the counts; no suggestion sentences (rutin.md, 10). The full numbers are step 2.
  async weeklyReport(ctx, week) {
    const [routines, runs] = await Promise.all([listRoutines(ctx), listRuns(ctx, week.from)]);
    const inWeek = runs.filter((run) => run.day <= week.to && run.finished_at);
    const days = (keys: string[]) => {
      const ids = routines.filter((row) => keys.includes(row.key)).map((row) => row.id);
      return new Set(inWeek.filter((run) => ids.includes(run.routine_id)).map((run) => run.day))
        .size;
    };
    return {
      metrics: [
        { label: "Sabah yapılan gün", value: String(days(["sabah"])) },
        { label: "Akşam yapılan gün", value: String(days(["aksam"])) },
      ],
      suggestions: [],
    };
  },

  // 6. Life cycle: the starting list the first time, then the three rhythms (again on every
  // switch-on: archiving took them back).
  async onActivate(ctx) {
    await writeStartList(ctx);
    await proposeAll(ctx);
  },

  tables: ["rutin_routines", "rutin_steps", "rutin_runs", "rutin_run_steps"],

  ui: {
    tabs: [
      { key: "sabah", label: "Sabah", component: MorningTab },
      { key: "aksam", label: "Akşam", component: EveningTab },
    ],
    scenes: { rutin: rutinScene },
  },
};
