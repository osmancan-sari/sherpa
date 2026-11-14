import type { TodayBrief } from "@/core/contract/types";
import { formatTime } from "@/lib/date";

// The day's summary the morning is told with (docs/moduller/rutin.md, 8.3): built from the
// scene's `today` with a pattern, never by the AI. The first fixed block and its time, the day's
// three, the finish line, tonight's bedtime. Said aloud on the device that was touched, and always
// shown in writing. Pure: the moment is a parameter.

const UNITS = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli"];

/** The last word of a number as it is said (07 → "yedi", 30 → "otuz", 0 → ""). */
function lastWord(n: number): string {
  if (n === 0) return "";
  return n % 10 !== 0 ? UNITS[n % 10] : TENS[Math.floor(n / 10)];
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

const list = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} ve ${items[items.length - 1]}`;

export type BriefLine = { left: string; right: string };

/** The day's plan as rows: the next fixed block, the three, the finish line (the board's panel). */
export function briefLines(today: TodayBrief, now: Date): BriefLine[] {
  const lines: BriefLine[] = [];
  const block = today.blocks.find((row) => row.endsAt > now);
  if (block) lines.push({ left: formatTime(block.startsAt), right: block.title });
  if (today.top.length > 0) {
    lines.push({
      left: `${today.top.length} iş`,
      right: today.top.map((row) => row.title).join(" · "),
    });
  }
  lines.push({ left: formatTime(today.finishLine), right: "Gün biter" });
  return lines;
}

/** The summary as it is said: "Günaydın. 10:30'da Derin Öğrenme dersi var. …" */
export function briefText(today: TodayBrief, now: Date, bedtime: string | null): string {
  const parts = ["Günaydın."];
  const block = today.blocks.find((row) => row.endsAt > now);
  if (block) parts.push(`${atTime(formatTime(block.startsAt))} ${block.title} var.`);
  if (today.top.length === 1) parts.push(`Bugünün işi: ${today.top[0].title}.`);
  else if (today.top.length > 1) {
    const count = ["", "bir", "iki", "üç"][today.top.length] ?? String(today.top.length);
    parts.push(`Bugünün ${count} işi: ${list(today.top.map((row) => row.title))}.`);
  }
  parts.push(`Gün ${atTime(formatTime(today.finishLine))} bitiyor.`);
  if (bedtime) parts.push(`Bu gece yatış ${bedtime}.`);
  return parts.join(" ");
}

/** The day's next thing after the morning (the last step's "Sonra"): a fixed block, else the first of the three. */
export function nextOfDay(today: TodayBrief, now: Date): string | null {
  const block = today.blocks.find((row) => row.startsAt > now);
  if (block) return `${formatTime(block.startsAt)} ${block.title}`;
  return today.top[0]?.title ?? null;
}
