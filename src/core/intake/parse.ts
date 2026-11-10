import { TASK_MAX_MINUTES } from "@/core/types";
import { dayKey, END_OF_DAY, istanbulInstant, shiftDay, weekdayOf } from "@/lib/date";

// Quick add, structured use: the date and the duration can be typed as short words at the end
// of the line ("Sunum slaytları cuma 45dk"). Only trailing words are read, so a weekday in the
// middle of a title stays part of the title. Pure; the current time is a parameter.

export type QuickText = {
  title: string;
  /** Day key (yyyy-MM-dd) the text names, if any. */
  dueDay: string | null;
  /** Minutes the text names, if any. May be above the limit of one sitting. */
  minutes: number | null;
};

const WEEKDAYS: Record<string, number> = {
  pazartesi: 1,
  pzt: 1,
  salı: 2,
  sali: 2,
  çarşamba: 3,
  carsamba: 3,
  çar: 3,
  perşembe: 4,
  persembe: 4,
  per: 4,
  cuma: 5,
  cumartesi: 6,
  cmt: 6,
  pazar: 7,
};

function fold(word: string): string {
  return word.toLocaleLowerCase("tr-TR");
}

/** `yarın`, `cuma`, `15.11`, `15.11.2026`, `+3g`, `+2h` → a day key, or null. */
export function parseDayWord(word: string, now: Date): string | null {
  const today = dayKey(now);
  const text = fold(word);

  if (text === "bugün" || text === "bugun") return today;
  if (text === "yarın" || text === "yarin") return shiftDay(today, 1);

  if (text in WEEKDAYS) {
    // The next such day; today's own weekday means a week from now.
    const ahead = (WEEKDAYS[text] - weekdayOf(today) + 7) % 7 || 7;
    return shiftDay(today, ahead);
  }

  const relative = text.match(/^\+(\d{1,3})(g|h)$/);
  if (relative) return shiftDay(today, Number(relative[1]) * (relative[2] === "h" ? 7 : 1));

  const date = text.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\.?$/);
  if (date) {
    const [day, month] = [Number(date[1]), Number(date[2])];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const build = (year: number) =>
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const valid = (key: string) => dayKey(istanbulInstant(key, "12:00")) === key;

    if (date[3]) return valid(build(Number(date[3]))) ? build(Number(date[3])) : null;
    // Without a year: this year, or next year when that day has already passed.
    const year = Number(today.slice(0, 4));
    const thisYear = build(year);
    if (!valid(thisYear)) return null;
    return thisYear >= today ? thisYear : build(year + 1);
  }
  return null;
}

/** `45dk`, `90dk`, `1s`, `1sa`, `2saat`, `1.5s`, `1s30dk` → minutes, or null. */
export function parseDurationWord(word: string): number | null {
  const text = fold(word).replace(",", ".");
  const match = text.match(/^(?:(\d+(?:\.\d+)?)(?:s|sa|saat))?(?:(\d+)(?:dk|d|dak|dakika))?$/);
  if (!match || (match[1] === undefined && match[2] === undefined)) return null;
  const minutes = Math.round(Number(match[1] ?? 0) * 60) + Number(match[2] ?? 0);
  return minutes > 0 ? minutes : null;
}

/** Splits a quick-add line into its title and the date and duration words at its end. */
export function parseQuickText(text: string, now: Date): QuickText {
  const words = text.trim().split(/\s+/).filter(Boolean);
  let dueDay: string | null = null;
  let minutes: number | null = null;

  while (words.length > 1) {
    const last = words[words.length - 1];

    if (minutes === null) {
      // "45 dk" typed with a space.
      const unit = fold(last);
      const amount = words[words.length - 2];
      if (/^(dk|dak|dakika|s|sa|saat)$/.test(unit) && /^\d+(?:[.,]\d+)?$/.test(amount)) {
        const joined = parseDurationWord(amount + unit);
        if (joined !== null && words.length > 2) {
          minutes = joined;
          words.splice(-2, 2);
          continue;
        }
      }
      const duration = parseDurationWord(last);
      if (duration !== null) {
        minutes = duration;
        words.pop();
        continue;
      }
    }

    if (dueDay === null) {
      const day = parseDayWord(last, now);
      if (day !== null) {
        dueDay = day;
        words.pop();
        continue;
      }
    }
    break;
  }

  return { title: words.join(" "), dueDay, minutes };
}

/** A day without a time, as a deadline: the end of that day in Istanbul. */
export function dueAtEndOfDay(day: string): string {
  return istanbulInstant(day, END_OF_DAY).toISOString();
}

/** Whether a duration fits in one sitting, i.e. can be saved as a task at all. */
export function fitsOneSitting(minutes: number): boolean {
  return minutes <= TASK_MAX_MINUTES;
}
