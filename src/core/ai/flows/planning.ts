import type { ModuleRegistry } from "@/core/contract/types";
import { createModuleContext } from "@/core/data/context";
import { keepWeek, loadPlanRows, weekInput } from "@/core/data/keep";
import { saveDayPlan } from "@/core/data/planning";
import {
  buildPlan,
  commitWeek,
  isFinished,
  loadByWeek,
  type Plan,
  type PlanAdvice,
  type PlanInput,
  planInput,
  type PlanRows,
  type WeekAdvice,
  type WeekInput,
  type WeekPlan,
} from "@/core/planner";
import { remainingEffort } from "@/core/planner/week";
import { type Db, toJson } from "@/core/types";
import { dayKey, formatTime, istanbulInstant, shiftDay, weekStart, weekdayOf } from "@/lib/date";
import {
  type MonthCallInput,
  monthSpec,
  type PlanCallInput,
  type PlanOutput,
  planSpec,
  replanSpec,
  type ReviewCallInput,
  reviewSpec,
  type WeekCallInput,
  weekSpec,
} from "../calls/planning";
import { type AiDeps, runAiCall } from "../gateway";
import { mergeMark, readMark } from "../marks";

// The planning flows (docs/10-yapay-zeka.md, "Plan çağrısının akışı"). Each one: the engine's own
// result first, the AI's suggestion on top of it, the engine again to apply the suggestion within
// its rules. Whatever fails, the engine's result stands.

/** At most this many candidates go to the AI (docs/10, rule 7). */
export const MAX_CANDIDATES = 80;
const WEEKDAYS = ["", "pazartesi", "salı", "çarşamba", "perşembe", "cuma", "cumartesi", "pazar"];

const modName = (rows: PlanRows, id: string) =>
  rows.modules.find((mod) => mod.id === id)?.name ?? "";

/** What the `plan` call sees of a day: the engine's plan and its candidates, in short. */
export function planCallInput(
  rows: PlanRows,
  input: PlanInput,
  base: Plan,
  note: string | null,
  replan: boolean,
): PlanCallInput {
  const yesterday = rows.days.find((day) => day.date === shiftDay(input.date, -1));
  return {
    date: input.date,
    weekday: WEEKDAYS[weekdayOf(input.date)],
    life_mode: input.lifeMode,
    capacity_minutes: base.usableMinutes,
    base: {
      top3: base.top3,
      placed: base.slots.flatMap((slot) => (slot.assignment ? [slot.assignment.candidate.id] : [])),
    },
    candidates: base.candidates.slice(0, MAX_CANDIDATES).map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      module: modName(rows, candidate.moduleId),
      minutes: candidate.minutes,
      due: candidate.dueAt ? dayKey(new Date(candidate.dueAt)) : null,
      importance: candidate.importance,
      energy: candidate.energy,
      mandatory: candidate.mandatory,
    })),
    blocks: input.blocks
      .filter(
        (block) => block.status !== "cancelled" && dayKey(new Date(block.starts_at)) === input.date,
      )
      .map((block) => ({
        title: block.title,
        start: formatTime(new Date(block.starts_at)),
        end: formatTime(new Date(block.ends_at)),
      })),
    yesterday: yesterday
      ? {
          planned: yesterday.top3.length,
          done: yesterday.top3.filter((id) =>
            rows.tasks.some((task) => task.id === id && task.status === "done"),
          ).length,
        }
      : null,
    note,
    ...(replan
      ? {
          done_today: rows.tasks
            .filter(
              (task) =>
                task.status === "done" &&
                task.done_at &&
                dayKey(new Date(task.done_at)) === input.date,
            )
            .map((task) => task.title),
        }
      : {}),
  };
}

/** The AI's answer as the engine's advice: only ids the engine knows. */
export function adviceOf(output: PlanOutput, plan: Plan): PlanAdvice {
  const known = new Set(plan.candidates.map((candidate) => candidate.id));
  const ids = (rows: { id: string }[]) => rows.map((row) => row.id).filter((id) => known.has(id));
  const reasons: Record<string, string> = {};
  for (const row of [...output.top3, ...output.prefer, ...output.defer]) {
    if (known.has(row.id) && row.reason) reasons[row.id] = row.reason;
  }
  return { top3: ids(output.top3), prefer: ids(output.prefer), defer: ids(output.defer), reasons };
}

/** The AI's corrections to estimates, on tasks whose length the user has not set by hand. */
async function applyEstimates(
  db: Db,
  rows: PlanRows,
  output: PlanOutput,
  call: { callId: string; model: string },
  now: Date,
): Promise<void> {
  for (const estimate of output.estimates) {
    const task = rows.tasks.find((row) => row.id === estimate.id && row.status === "todo");
    if (!task) continue;
    const mark = readMark(task.ai);
    if (mark?.user_edited.includes("est_minutes")) continue;
    const next = mergeMark(mark, {
      kind: "plan",
      model: call.model,
      at: now.toISOString(),
      call_id: call.callId,
      input: task.title.slice(0, 300),
      fields: {
        est_minutes: { value: estimate.minutes, confidence: 0.6, reason: estimate.reason },
      },
    });
    await db
      .from("tasks")
      .update({ est_minutes: estimate.minutes, ai: toJson(next) })
      .eq("id", task.id);
  }
}

export type PlanFlowResult =
  | { status: "applied"; advice: PlanAdvice; warnings: string[] }
  | { status: "skipped" | "failed"; reason: string };

/**
 * `plan` (the day ahead, at the closing or on the day's first opening) and `replan` ("Yeniden
 * planla"). With `preview`, the advice is returned and nothing is written (the closing shows it
 * and writes it when the user confirms).
 */
export async function planDayFlow(
  deps: AiDeps,
  options: { date: string; kind: "plan" | "replan"; note?: string | null; preview?: boolean },
  now: Date,
): Promise<PlanFlowResult> {
  const rows = await loadPlanRows(deps.db, now);
  const input = {
    ...planInput(rows, { date: options.date, now, context: "desk" }),
    advice: undefined,
  };
  const replan = options.kind === "replan";
  // For a new plan the engine chooses afresh; the day's three as they were are its own answer.
  const base = buildPlan({ ...input, top3: replan ? undefined : input.top3 });
  // Nothing to plan, nothing to ask (and nothing to pay for).
  if (base.candidates.length === 0) return { status: "skipped", reason: "nothing_to_plan" };
  const result = await runAiCall(
    deps,
    replan ? replanSpec : planSpec,
    planCallInput(rows, input, base, options.note ?? null, replan),
  );
  if (result.status !== "ok") return { status: result.status, reason: result.reason };

  const advice = adviceOf(result.output, base);
  if (options.preview) return { status: "applied", advice, warnings: result.output.warnings };

  await applyEstimates(deps.db, rows, result.output, result, now);
  // The engine again, with the advice: it keeps the rules, the AI only chooses within them.
  const fresh = await loadPlanRows(deps.db, now);
  const again = planInput(fresh, { date: options.date, now, context: "desk" });
  const planned = buildPlan({ ...again, top3: undefined, advice });
  let top3 = planned.top3;
  if (replan) {
    // What is finished of the day's three stays in them.
    const finished = (again.top3 ?? []).filter((id) => isFinished(id, again));
    top3 = [...finished, ...top3.filter((id) => !finished.includes(id))].slice(0, 3);
  }
  await saveDayPlan(deps.db, {
    plan: { ...planned, top3 },
    day: again,
    source: "ai",
    stored: { advice },
    reasons: advice.reasons ?? {},
  });
  return { status: "applied", advice, warnings: result.output.warnings };
}

/** What the `week` call sees: the week's candidates with the engine's shares and its commitment. */
export function weekCallInput(input: WeekInput, base: WeekPlan, rows: PlanRows): WeekCallInput {
  const [load] = loadByWeek(input, { from: input.weekStart, weeks: 1 });
  const fixed = Object.entries(base.moduleBudgets).map(([slug, minutes]) => ({
    module: slug,
    minutes,
  }));
  const lastWeek = rows.weekPlans.find((row) => row.week_start === shiftDay(input.weekStart, -7));
  return {
    week_start: input.weekStart,
    life_mode: base.lifeMode,
    capacity_minutes: load.capacityMinutes,
    fixed_minutes: fixed,
    items: input.items
      .filter((item) => item.status === "active" && remainingEffort(item) > 0)
      .slice(0, MAX_CANDIDATES)
      .map((item) => {
        const share = base.committed.find((row) => row.itemId === item.id);
        return {
          id: item.id,
          title: item.title,
          module: modName(rows, item.module_id),
          remaining_minutes: remainingEffort(item),
          share_minutes: share?.minutes ?? 0,
          due: item.due_at ? dayKey(new Date(item.due_at)) : null,
          importance: item.importance,
          required: share?.required ?? false,
        };
      }),
    base: base.committed.map((row) => row.itemId),
    last_week: lastWeek ? { committed: lastWeek.committed.length, finished: 0 } : null,
  };
}

/**
 * The week's commitment with the AI's advice (`week`): the same `keepWeek` the screens run, the
 * advice handed in. Without an answer the engine commits on its own.
 */
export async function weekFlow(deps: AiDeps, now: Date, force: boolean) {
  const rows = await loadPlanRows(deps.db, now);
  return keepWeek(deps.db, now, {
    force,
    rows,
    advise: async (input): Promise<WeekAdvice | null> => {
      const base = commitWeek(input);
      if (base.committed.length === 0 && base.left.length === 0) return null;
      const result = await runAiCall(deps, weekSpec, weekCallInput(input, base, rows));
      if (result.status !== "ok") return null;
      const known = new Set(input.items.map((item) => item.id));
      const reasons: Record<string, string> = {};
      for (const row of [...result.output.committed, ...result.output.drop]) {
        if (known.has(row.id)) reasons[row.id] = row.reason;
      }
      const slugByName = new Map(rows.modules.map((mod) => [mod.name, mod.slug]));
      return {
        committed: result.output.committed.map((row) => row.id).filter((id) => known.has(id)),
        drop: result.output.drop.map((row) => row.id).filter((id) => known.has(id)),
        moduleBudgets: Object.fromEntries(
          result.output.module_budgets.flatMap((row) => {
            const slug =
              slugByName.get(row.module) ??
              rows.modules.find((mod) => mod.slug === row.module)?.slug;
            return slug ? [[slug, row.minutes]] : [];
          }),
        ),
        reasons,
      };
    },
  });
}

/** `month`: the coming eight weeks; proposals kept for the week screen (`horizon_reviews`). */
export async function monthFlow(deps: AiDeps, now: Date) {
  const rows = await loadPlanRows(deps.db, now);
  const input = weekInput(rows, now);
  const loads = loadByWeek(input, { from: weekStart(dayKey(now)), weeks: 8 });
  const callInput: MonthCallInput = {
    today: dayKey(now),
    weeks: loads.map((load) => ({
      week_start: load.weekStart,
      capacity: load.capacityMinutes,
      demand: load.demandMinutes,
      deadlines: load.deadlines.map((row) => row.title),
    })),
    items: rows.workItems
      .filter((item) => item.status === "active" && remainingEffort(item) > 0)
      .slice(0, MAX_CANDIDATES)
      .map((item) => ({
        id: item.id,
        title: item.title,
        module: modName(rows, item.module_id),
        remaining_minutes: remainingEffort(item),
        due: item.due_at ? dayKey(new Date(item.due_at)) : null,
      })),
  };
  const periodStart = `${dayKey(now).slice(0, 7)}-01`;
  if (callInput.items.length === 0)
    return { status: "skipped" as const, reason: "nothing_to_plan" };
  const result = await runAiCall(deps, monthSpec, callInput);
  if (result.status !== "ok") return { status: result.status, reason: result.reason };
  const { error } = await deps.db.from("horizon_reviews").upsert(
    {
      scope: "month",
      period_start: periodStart,
      load: toJson(callInput.weeks),
      proposals: toJson(result.output.proposals.map((row) => ({ ...row, status: "open" }))),
    },
    { onConflict: "user_id,scope,period_start" },
  );
  if (error) throw new Error(error.message);
  return { status: "applied" as const, proposals: result.output.proposals.length };
}

/** `review`: the week behind, from the modules' own reports; kept in `weekly_reviews`. */
export async function reviewFlow(deps: AiDeps, registry: ModuleRegistry, now: Date) {
  const rows = await loadPlanRows(deps.db, now);
  const week = weekStart(dayKey(now));
  const modules: ReviewCallInput["modules"] = [];
  for (const mod of rows.modules.filter((row) => row.status === "active")) {
    const definition = registry.get(mod.slug);
    if (!definition) continue;
    try {
      const report = await definition.weeklyReport(
        createModuleContext({ db: deps.db, registry, module: mod }),
        {
          from: week,
          to: shiftDay(week, 6),
        },
      );
      modules.push({ module: mod.name, metrics: report.metrics, suggestions: report.suggestions });
    } catch {
      // A module whose report fails is left out; the others still count.
    }
  }
  const worked = new Map<string, number>();
  const from = istanbulInstant(week).getTime();
  for (const session of rows.sessions) {
    if (!session.module_id || session.ended_at === null || Date.parse(session.started_at) < from)
      continue;
    const minutes = (Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60_000;
    worked.set(session.module_id, (worked.get(session.module_id) ?? 0) + minutes);
  }
  const input = weekInput(rows, now);
  const coming = loadByWeek(input, { from: shiftDay(week, 7), weeks: 4 });
  const callInput: ReviewCallInput = {
    week_start: week,
    modules,
    worked: [...worked].map(([id, minutes]) => ({
      module: modName(rows, id),
      minutes: Math.round(minutes),
    })),
    coming: coming.map((load) => ({
      week_start: load.weekStart,
      capacity: load.capacityMinutes,
      demand: load.demandMinutes,
    })),
    life_mode: planInput(rows, { date: dayKey(now), now, context: "desk" }).lifeMode,
  };
  if (modules.length === 0 && callInput.worked.length === 0) {
    return { status: "skipped" as const, reason: "nothing_to_review" };
  }
  const result = await runAiCall(deps, reviewSpec, callInput);
  if (result.status !== "ok") return { status: result.status, reason: result.reason };
  const { error } = await deps.db
    .from("weekly_reviews")
    .upsert(
      { week_start: week, summary: toJson(result.output) },
      { onConflict: "user_id,week_start" },
    );
  if (error) throw new Error(error.message);
  return { status: "applied" as const };
}
