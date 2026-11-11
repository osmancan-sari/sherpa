// The planner (docs/04-planlayici.md): pure functions of data and the current time. Nothing in
// this folder reads the database, the clock or the network.

export * from "./types";
export {
  buildPlan,
  pickForMinutes,
  fits,
  contextFits,
  planningDay,
  slotLabel,
  DEFER_LIMIT,
} from "./plan";
export { buildCandidates, compareScored, isReturning, rhythmState } from "./candidates";
export { buildSlots, dayCapacity, dayTypeOf, plannerSettings, DEFAULT_SETTINGS } from "./slots";
export {
  commitWeek,
  cutSittings,
  loadByWeek,
  recommitReason,
  sittingChanges,
  weekCapacity,
} from "./week";
export type { WeekAdvice, WeekInput, WeekLoad, WeekPlan, LoadInput, RecommitReason } from "./week";
export { capacityFactors, estimateMultipliers } from "./learn";
export { planInput, tomorrowInput, lifeModeOn, readShares, storedPlan } from "./input";
export type { PlanRows, StoredDayPlan } from "./input";
