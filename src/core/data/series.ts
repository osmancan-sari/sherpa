import type { BlockSeries } from "@/core/types";
import { daysBetween, istanbulInstant, weekdayOf } from "@/lib/date";

/** How far ahead blocks are generated from a weekly series. */
export const SERIES_HORIZON_DAYS = 56;

export type Occurrence = {
  occurrence_on: string;
  starts_at: string;
  ends_at: string;
};

type SeriesShape = Pick<
  BlockSeries,
  "weekday" | "start_time" | "end_time" | "valid_from" | "valid_to"
>;

/**
 * The days a weekly series falls on between two days (both included), as concrete instants.
 * Pure: the range is given, nothing reads the clock.
 */
export function expandSeries(series: SeriesShape, fromDay: string, toDay: string): Occurrence[] {
  const from = series.valid_from > fromDay ? series.valid_from : fromDay;
  const to = series.valid_to !== null && series.valid_to < toDay ? series.valid_to : toDay;
  if (from > to) return [];

  return daysBetween(from, to)
    .filter((day) => weekdayOf(day) === series.weekday)
    .map((day) => ({
      occurrence_on: day,
      starts_at: istanbulInstant(day, series.start_time.slice(0, 5)).toISOString(),
      ends_at: istanbulInstant(day, series.end_time.slice(0, 5)).toISOString(),
    }));
}
