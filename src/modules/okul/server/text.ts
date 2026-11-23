import { dayKey, formatTime, shiftDay, weekdayOf } from "@/lib/date";

// The module's short Turkish texts (okul-sayfalar.md): days, kinds, lengths. Pure; the pages and
// the rules share them.

export const WEEKDAY_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
export const WEEKDAY_LONG = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];
export const MONTH_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];

export const KIND_LABEL: Record<string, string> = {
  quiz: "Quiz",
  midterm: "Midterm",
  final: "Final",
  homework: "Ödev",
  project: "Proje",
  project_step: "Proje adımı",
  presentation: "Sunum",
};

/** "24 Kas" */
export function dayMonth(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return `${date} ${MONTH_SHORT[month - 1]}`;
}

/** "Sal 24 Kas" */
export function weekdayDayMonth(day: string): string {
  return `${WEEKDAY_SHORT[weekdayOf(day) - 1]} ${dayMonth(day)}`;
}

/** A day near now as people say it: "bugün", "yarın", "Sal" within the week, else "24 Kas". */
export function nearDay(day: string, now: Date): string {
  const today = dayKey(now);
  if (day === today) return "bugün";
  if (day === shiftDay(today, 1)) return "yarın";
  if (day > today && day <= shiftDay(today, 6)) return WEEKDAY_SHORT[weekdayOf(day) - 1];
  return dayMonth(day);
}

/** "09:30" from a database time ("09:30:00"). */
export const clock = (time: string | null) => (time ? time.slice(0, 5) : null);

/** An instant's day and time: "Sal 24 Kas 10:30". */
export function whenText(at: Date): string {
  return `${weekdayDayMonth(dayKey(at))} ${formatTime(at)}`;
}

/** Days between two day keys (to − from). */
export function daysUntil(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** A weight as the pages write it: "%10", "%7,5". */
export function percent(value: number | string | null): string | null {
  if (value === null) return null;
  const number = Number(value);
  return `%${Number.isInteger(number) ? number : number.toFixed(1).replace(".", ",")}`;
}

/** A score or a total with a Turkish decimal comma: "7,4". */
export function decimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}
