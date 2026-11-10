import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
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
