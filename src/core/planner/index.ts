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
export {
  buildSlots,
  dayCapacity,
  dayEndOf,
  dayTypeOf,
  plannerSettings,
  wholeDaySlotMinutes,
  DEFAULT_SETTINGS,
} from "./slots";
export {
  commitWeek,
  cutSittings,
  loadByWeek,
  recommitReason,
  sittingChanges,
  weekCapacity,
  weekNoTime,
  weekWork,
} from "./week";
export type {
  WeekAdvice,
  WeekInput,
  WeekLoad,
  WeekPlan,
  WeekWorkRow,
  LoadInput,
  RecommitReason,
} from "./week";
export { FORECAST_WEEKS, forecastDays } from "./forecast";
export { calendarOf } from "./calendar";
export type { CalendarData } from "./calendar";
export type { ForecastDay } from "./forecast";
export {
  BLOCK_AHEAD_MINUTES,
  REPORT_HOURS,
  inferContext,
  placeContext,
  reportedOf,
  statedDayType,
} from "./context";
export type { ContextArgs, ReportedContext } from "./context";
export { capacityFactors, estimateMultipliers } from "./learn";
export { ANSWER_MINUTES, OVERRUN_FACTOR, overrun } from "./overrun";
export type { Overrun } from "./overrun";
export { planInput, tomorrowInput, readShares, storedPlan, weekSettings } from "./input";
export { bedInstant, dayStartClock, sleepPlan, MORNING_GRACE } from "./frame";
export type { FrameDay, SleepArgs } from "./frame";
export type { PlanRows, StoredDayPlan } from "./input";
