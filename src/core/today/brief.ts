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
  // Ç4a: the plan's work still ahead in the working window, in time order (no day's three).
  const ahead = plan.slots.flatMap((slot) =>
    slot.part === undefined && slot.assignment && slot.end > input.now ? [slot.assignment] : [],
  );
  const first = ahead[0]?.candidate;
  const frame = input.frame;
  return {
    date: input.date,
    work: {
      count: ahead.length,
      first: first
        ? { title: first.title, module: modules.get(first.moduleId)?.row.name ?? "" }
        : null,
    },
    blocks: blocksOfDay(input.blocks, input.date)
      .filter((block) => block.status !== "cancelled")
      .map((block) => ({
        title: block.title,
        startsAt: new Date(block.starts_at),
        endsAt: new Date(block.ends_at),
      })),
    bedtime: frame ? (frame.bedAt ?? frame.bed) : null,
    wokeAt: frame?.woke ? frame.wake : null,
    wokeFrom: frame?.woke ? (frame.wokeFrom ?? (frame.estimated ? "estimate" : "screen")) : null,
    closed: Boolean(input.closed),
    // Tonight's sleep plan: moved by a recorded bedtime (docs/12, D "Uyku planı" rule 5).
    tomorrow: frame
      ? { wake: frame.tonight.expectedWake, sleepMinutes: frame.tonight.sleepMinutes }
      : null,
  };
}
