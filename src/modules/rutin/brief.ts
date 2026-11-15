import type { TodayBrief } from "@/core/contract/types";
import { formatTime } from "@/lib/date";

// The day's summary the morning is told with (docs/moduller/rutin.md, 8.3): built from the
// scene's `today` with a pattern, never by the AI. The first fixed block and its time, how much
// work the day has planned and the first of it, tonight's bedtime (Ç4a: no day's three, no finish
// line). Said aloud on the device that was touched, and always shown in writing. Pure: the moment
// is a parameter.

const UNITS = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];

/** The last word of a number as it is said (07 → "yedi", 30 → "otuz", 0 → ""). */
function lastWord(n: number): string {
  if (n === 0) return "";
  return n % 10 !== 0 ? UNITS[n % 10] : TENS[Math.floor(n / 10)];
}

/** A count as it is said: 4 → "dört", 12 → "on iki"; from 100 on, the digits. */
export function countWord(n: number): string {
  if (n <= 0 || n >= 100) return String(n);
  return [TENS[Math.floor(n / 10)], UNITS[n % 10]].filter(Boolean).join(" ");
}

/** "10:30'da", "08:00'de", "13:15'te": the locative of a clock time, by how it is read aloud. */
export function atTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const word = lastWord(minutes) || lastWord(hours === 0 ? 0 : hours) || "sıfır";
  const vowels = word.match(/[aeıioöuü]/g) ?? ["a"];
  const back = "aıou".includes(vowels[vowels.length - 1]);
  const hard = "çfhkpsşt".includes(word[word.length - 1]);
  return `${time}'${hard ? "t" : "d"}${back ? "a" : "e"}`;
}

export type BriefLine = { left: string; right: string };

/** The day's plan as rows: the next fixed block, the day's work, tonight's bedtime (the board's panel). */
export function briefLines(today: TodayBrief, now: Date): BriefLine[] {
  const lines: BriefLine[] = [];
  const block = today.blocks.find((row) => row.endsAt > now);
  if (block) lines.push({ left: formatTime(block.startsAt), right: block.title });
  if (today.work.first) {
    lines.push({
      left: `${today.work.count} iş`,
      right: `İlki ${today.work.first.title}`,
    });
  }
  if (today.bedtime) lines.push({ left: formatTime(today.bedtime), right: "Yatış" });
  return lines;
}

/**
 * The summary as it is said: "Günaydın. 10:30'da Derin Öğrenme dersi var. Bugün dört iş var;
 * ilki proje önerisi. Yatış 23:00."
 */
export function briefText(today: TodayBrief, now: Date): string {
  const parts = ["Günaydın."];
  const block = today.blocks.find((row) => row.endsAt > now);
  if (block) parts.push(`${atTime(formatTime(block.startsAt))} ${block.title} var.`);
  const { count, first } = today.work;
  if (first && count === 1) parts.push(`Bugün bir iş var: ${first.title}.`);
  else if (first) parts.push(`Bugün ${countWord(count)} iş var; ilki ${first.title}.`);
  if (today.bedtime) parts.push(`Yatış ${formatTime(today.bedtime)}.`);
  return parts.join(" ");
}

/** The day's next thing after the morning (the last step's "Sonra"): a fixed block, else the first work. */
export function nextOfDay(today: TodayBrief, now: Date): string | null {
  const block = today.blocks.find((row) => row.startsAt > now);
  if (block) return `${formatTime(block.startsAt)} ${block.title}`;
  return today.work.first?.title ?? null;
}
