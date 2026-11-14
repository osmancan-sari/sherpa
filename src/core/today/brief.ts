import type { TodayBrief } from "@/core/contract/types";
import type { Plan, PlanInput } from "@/core/planner";
import { blocksOfDay } from "./select";

// The day in short (docs/06-modul-sozlesmesi.md, `TodayBrief`): what a scene or a narration reads
// of the plan. Pure: made from the planner's input and plan.

/** The day in short for a scene or a narration (read only). */
export function briefOf(
  input: PlanInput,
  plan: Plan,
  modules: ReadonlyMap<string, { row: { name: string } }>,
): TodayBrief {
  const top = plan.top3.flatMap((id) => {
    const candidate = plan.candidates.find((row) => row.id === id || row.task?.work_item_id === id);
    if (!candidate) return [];
    return [
      {
        title: candidate.title,
        module: modules.get(candidate.moduleId)?.row.name ?? "",
        reason: input.advice?.reasons?.[id] ?? null,
      },
    ];
  });
  const frame = input.frame;
  return {
    date: input.date,
    top,
    blocks: blocksOfDay(input.blocks, input.date)
      .filter((block) => block.status !== "cancelled")
      .map((block) => ({
        title: block.title,
        startsAt: new Date(block.starts_at),
        endsAt: new Date(block.ends_at),
      })),
    finishLine: input.finishLine,
    wokeAt: frame?.woke ? frame.wake : null,
    wokeFrom: frame?.woke ? (frame.wokeFrom ?? (frame.estimated ? "estimate" : "screen")) : null,
    closed: Boolean(input.closed),
    // Tonight's sleep plan: moved by a recorded bedtime (docs/12, D "Uyku planı" rule 5).
    tomorrow: frame
      ? { wake: frame.tonight.expectedWake, sleepMinutes: frame.tonight.sleepMinutes }
      : null,
  };
}
