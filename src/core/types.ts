import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Json, Tables } from "@/lib/supabase/database.types";

/** A Supabase client of either side (browser or server); the core's data functions take one. */
export type Db = SupabaseClient<Database>;

export type Area = Tables<"areas">;
export type ModuleRow = Tables<"modules">;
export type WorkItem = Tables<"work_items">;
export type Task = Tables<"tasks">;
export type Rhythm = Tables<"rhythms">;
export type RhythmLog = Tables<"rhythm_logs">;
export type BlockSeries = Tables<"block_series">;
export type Block = Tables<"blocks">;
export type Session = Tables<"sessions">;
export type InboxEntry = Tables<"inbox_entries">;
export type Prompt = Tables<"prompts">;
export type AppEvent = Tables<"events">;
export type Settings = Tables<"settings">;
export type AiCall = Tables<"ai_calls">;
export type AiFeedback = Tables<"ai_feedback">;
export type DayRow = Tables<"days">;
export type WeekPlanRow = Tables<"week_plans">;
export type LifeModePeriod = Tables<"life_mode_periods">;
export type PlannerStatRow = Tables<"planner_stats">;
export type WeeklyReview = Tables<"weekly_reviews">;
export type HorizonReview = Tables<"horizon_reviews">;

export type Energy = Enums<"energy_kind">;
export type Context = Enums<"context_kind">;
export type LifeMode = Enums<"life_mode">;
export type Period = Enums<"period_kind">;
export type BlockKind = Enums<"block_kind">;
export type DayType = Enums<"day_type">;
export type ModuleKind = Enums<"module_kind">;
export type ModuleStatus = Enums<"module_status">;

/** Who put a value in a field. A user's value is never overwritten by a module or the AI. */
export type FieldSource = "module" | "ai" | "user" | "default";
export type Provenance = Record<string, FieldSource>;

/** A task is one sitting: at most this long (docs/03-veri-modeli.md). */
export const TASK_MAX_MINUTES = 90;
export const TASK_MIN_MINUTES = 5;
export const TASK_DEFAULT_MINUTES = 30;
/** Length of a sitting when a work item does not say (settings.slot.deep_min). */
export const SESSION_DEFAULT_MINUTES = 45;

export class DataError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "DataError";
  }
}

/** Unwraps a Supabase result or throws; keeps the data functions free of error plumbing. */
export function unwrap<T>(result: {
  data: T;
  error: { message: string; code?: string } | null;
}): NonNullable<T> {
  if (result.error) throw new DataError(result.error.message, result.error.code);
  if (result.data === null || result.data === undefined) throw new DataError("no data returned");
  return result.data;
}

/** Like unwrap, for calls that return nothing. */
export function check(result: { error: { message: string; code?: string } | null }): void {
  if (result.error) throw new DataError(result.error.message, result.error.code);
}

/** A plain value as a jsonb column takes it (the generated type does not accept `unknown`). */
export function toJson(value: unknown): NonNullable<Json> {
  return value as NonNullable<Json>;
}
