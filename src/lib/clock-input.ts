// Typing a clock time on any keyboard (Rutin 1 follow-up, 14 Kas 2026): the phone's number pad has
// no ":", so the field accepts digits alone and puts the colon itself. "0800", "800" and "8" are
// 08:00; "24" and "2400" are 24:00; "8:30", "8.30" and "8,30" are 08:30. Pure: the field calls
// these on every change and when it is left.

const DIGITS = /^\d{1,4}$/;
const SEPARATED = /^(\d{1,2})[:.,](\d{0,2})$/;

/** "HH:mm" from hours and minutes, or null when they are not a time of day (24:00 allowed). */
function clockOf(hours: number, minutes: number): string | null {
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * The finished value of what was typed: "HH:mm" when it reads as a time, else the text as it was
 * (the form's own check then says what is wrong). Empty stays empty.
 */
export function normalizeClock(raw: string): string {
  const text = raw.trim();
  if (text === "") return "";
  if (DIGITS.test(text)) {
    if (text.length <= 2) return clockOf(Number(text), 0) ?? text;
    const hours = Number(text.slice(0, text.length - 2));
    const minutes = Number(text.slice(-2));
    return clockOf(hours, minutes) ?? text;
  }
  const separated = SEPARATED.exec(text);
  if (separated) {
    return clockOf(Number(separated[1]), Number(separated[2] || "0")) ?? text;
  }
  return text;
}

/**
 * The text while it is being typed: only digits and one separator are kept (at most 5
 * characters); four digits in a row become "HH:mm" at once. Three digits wait for the fourth or
 * for the field to be left ("800" is 08:00, "0800" too).
 */
export function typingClock(raw: string): string {
  const kept = raw.replace(/[.,]/g, ":").replace(/[^\d:]/g, "");
  const [head, ...rest] = kept.split(":");
  const text = rest.length > 0 ? `${head}:${rest.join("")}` : head;
  if (/^\d{4}$/.test(text)) return normalizeClock(text);
  return text.slice(0, 5);
}
