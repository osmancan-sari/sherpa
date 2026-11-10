import { TZDate } from "@date-fns/tz";
import { addDays, format, getISODay, startOfISOWeek, startOfMonth } from "date-fns";
import { tr } from "date-fns/locale";

/** Sherpa runs in one time zone everywhere, whatever the device or server says. */
export const TIME_ZONE = "Europe/Istanbul";

/** The given instant as a date in Istanbul time. */
export function inIstanbul(instant: Date): TZDate {
  return new TZDate(instant, TIME_ZONE);
}

/** Calendar day in Istanbul as `yyyy-MM-dd`; the key used for "today". */
export function dayKey(instant: Date): string {
  return format(inIstanbul(instant), "yyyy-MM-dd");
}

/** Day label as the top bar shows it: "Perşembe 12 Kasım". */
export function formatDayLabel(instant: Date): string {
  return format(inIstanbul(instant), "EEEE d MMMM", { locale: tr });
}

/** Clock time in Istanbul: "10:40". */
export function formatTime(instant: Date): string {
  return format(inIstanbul(instant), "HH:mm");
}

/** The instant a wall-clock time on a calendar day in Istanbul stands for. */
export function istanbulInstant(day: string, time = "00:00"): Date {
  const [year, month, date] = day.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(new TZDate(year, month - 1, date, hours, minutes, 0, TIME_ZONE).getTime());
}

/** A day key moved by whole days. */
export function shiftDay(day: string, days: number): string {
  return dayKey(addDays(istanbulInstant(day, "12:00"), days));
}

/** ISO weekday of a day key: 1 = Monday … 7 = Sunday. */
export function weekdayOf(day: string): number {
  return getISODay(inIstanbul(istanbulInstant(day, "12:00")));
}

/** Monday of the week the day is in. */
export function weekStart(day: string): string {
  return format(startOfISOWeek(inIstanbul(istanbulInstant(day, "12:00"))), "yyyy-MM-dd");
}

/** First day of the month the day is in. */
export function monthStart(day: string): string {
  return format(startOfMonth(inIstanbul(istanbulInstant(day, "12:00"))), "yyyy-MM-dd");
}

/** Every day key from `from` to `to`, both included. */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = shiftDay(day, 1)) days.push(day);
  return days;
}

/**
 * A due date the way lists show it: "bugün", "yarın", the weekday inside the coming week,
 * otherwise "15 Kas". A time other than the end of the day is appended.
 */
export function formatDue(dueAt: string | Date, now: Date): string {
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  const day = dayKey(due);
  const today = dayKey(now);
  let label: string;
  if (day === today) label = "bugün";
  else if (day === shiftDay(today, 1)) label = "yarın";
  else if (day === shiftDay(today, -1)) label = "dün";
  else if (day > today && day <= shiftDay(today, 6)) {
    label = format(inIstanbul(due), "EEEE", { locale: tr });
  } else label = format(inIstanbul(due), "d MMM", { locale: tr });

  const time = formatTime(due);
  return time === END_OF_DAY ? label : `${label} ${time}`;
}

/** A due date given without a time is stored as the end of that day. */
export const END_OF_DAY = "23:59";

/** Minutes as people say them: "45 dk", "1 sa 30 dk", "2 sa". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} sa` : `${hours} sa ${rest} dk`;
}
