import type { WeekPlanRow } from "@/core/types";
import { shiftDay, weekStart } from "@/lib/date";
import { type ForecastDay, forecastDays } from "./forecast";
import { readShares } from "./input";
import { type LoadInput, loadByWeek, type WeekLoad, weekWork, type WeekWorkRow } from "./week";
import type { Plan, PlanInput } from "./types";

// Takvim's data in one place (docs/04-planlayici.md, "Takvim'in verisi", Ç4a; the screen is
// Ç4c's): the forecast of the week's days after today, the week's work by deadline and the
// coming eight weeks' work against their time. Pure: today's input and plan, the week's input and
// the stored week plans come in.

export type CalendarData = { days: ForecastDay[]; work: WeekWorkRow[]; weeks: WeekLoad[] };

export function calendarOf(args: {
  /** Today's planner input and plan (the forecast counts what today holds as done). */
  input: PlanInput;
  plan: Plan;
  /** The week's input (`weekInput`): items, tasks, rhythms, modules, blocks, settings. */
  load: LoadInput;
  weekPlans: WeekPlanRow[];
  /** Any day of the week to show. */
  week: string;
}): CalendarData {
  const from = weekStart(args.week);
  const days = forecastDays(args.input, args.plan, { from, to: shiftDay(from, 6) });
  const stored = args.weekPlans.find((row) => row.week_start === from);
  const work = weekWork(
    {
      ...args.load,
      committed: stored?.committed ?? null,
      shares: readShares(stored?.shares),
      reasons: (stored?.reasons ?? {}) as Record<string, string>,
    },
    from,
  );
  return { days, work, weeks: loadByWeek(args.load, { from, weeks: 8 }) };
}
