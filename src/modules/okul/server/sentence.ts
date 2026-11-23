import { dayKey, shiftDay, weekdayOf } from "@/lib/date";

// One sentence to an assessment (okul.md section 7, `assessment`: "Quiz 4 3 Aralık"): the kind,
// the day, the hour, and the rest as its title. Pure and forgiving: what it cannot read it leaves
// empty, and the short form asks for it.

const MONTHS: Record<string, number> = {
  oca: 1,
  ocak: 1,
  şub: 2,
  şubat: 2,
  mar: 3,
  mart: 3,
  nis: 4,
  nisan: 4,
  may: 5,
  mayıs: 5,
  haz: 6,
  haziran: 6,
  tem: 7,
  temmuz: 7,
  ağu: 8,
  ağustos: 8,
  eyl: 9,
  eylül: 9,
  eki: 10,
  ekim: 10,
  kas: 11,
  kasım: 11,
  ara: 12,
  aralık: 12,
};

const WEEKDAYS: Record<string, number> = {
  pazartesi: 1,
  pzt: 1,
  salı: 2,
  sal: 2,
  çarşamba: 3,
  çar: 3,
  perşembe: 4,
  per: 4,
  cuma: 5,
  cum: 5,
  cumartesi: 6,
  cmt: 6,
  pazar: 7,
  paz: 7,
};

const KINDS: [RegExp, string][] = [
  [/^(quiz|kısa sınav)\b/i, "quiz"],
  [/^(midterm|vize|ara sınav)\b/i, "midterm"],
  [/^final\b/i, "final"],
  [/^(ödev|odev|homework|assignment|hw)\b/i, "homework"],
  [/^(proje adımı|proposal|ara rapor)\b/i, "project_step"],
  [/^(proje|project)\b/i, "project"],
  [/^(sunum|presentation)\b/i, "presentation"],
];

export type ReadSentence = {
  title: string;
  kind: string | null;
  date: string | null;
  time: string | null;
};

const lower = (text: string) => text.toLocaleLowerCase("tr");

/** The year that puts the day nearest ahead of now (a day well gone by means next year). */
function nearestYear(month: number, day: number, today: string): string {
  const year = Number(today.slice(0, 4));
  const pad = (n: number) => String(n).padStart(2, "0");
  const thisYear = `${year}-${pad(month)}-${pad(day)}`;
  return thisYear < shiftDay(today, -60) ? `${year + 1}-${pad(month)}-${pad(day)}` : thisYear;
}

export function readSentence(sentence: string, now: Date): ReadSentence {
  const today = dayKey(now);
  let rest = ` ${sentence.trim()} `;
  let date: string | null = null;
  let time: string | null = null;

  const timeMatch = rest.match(/\s(?:saat\s+)?([01]?\d|2[0-3])[:.]([0-5]\d)(?=\s)/i);
  if (timeMatch) {
    time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
    rest = rest.replace(timeMatch[0], " ");
  }

  const words = rest.match(/\s(\d{1,2})\s+([a-zçğıöşü]+)(?=\s)/i);
  const numeric = rest.match(/\s(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?(?=\s)/);
  if (words && MONTHS[lower(words[2])]) {
    date = nearestYear(MONTHS[lower(words[2])], Number(words[1]), today);
    rest = rest.replace(words[0], " ");
  } else if (numeric && Number(numeric[2]) >= 1 && Number(numeric[2]) <= 12) {
    const month = Number(numeric[2]);
    const day = Number(numeric[1]);
    date = numeric[3]
      ? `${numeric[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : nearestYear(month, day, today);
    rest = rest.replace(numeric[0], " ");
  } else {
    for (const token of rest.split(/\s+/)) {
      const word = lower(token);
      if (word === "bugün") date = today;
      else if (word === "yarın") date = shiftDay(today, 1);
      else if (WEEKDAYS[word]) {
        const wanted = WEEKDAYS[word];
        const ahead = (wanted - weekdayOf(today) + 7) % 7 || 7;
        date = shiftDay(today, ahead);
      } else continue;
      rest = rest.replace(token, " ");
      break;
    }
  }

  const title = rest.replace(/\s+/g, " ").trim();
  const kind = KINDS.find(([pattern]) => pattern.test(title))?.[1] ?? null;
  return { title, kind, date, time };
}
