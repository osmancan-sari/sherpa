import type { Block, Context, DayType } from "@/core/types";
import { istanbulInstant, shiftDay } from "@/lib/date";

// Where the device is (docs/04-planlayici.md, "Bağlam tahmini", Ç4a): nobody chooses it. The
// second screen is at the desk; on the phone it is inferred, in order, from what the phone's
// automation reported lately (`core/context`), from a fixed block with a place now or soon, from
// the day's type. With none of them the context is unknown (null) and the filter is off: every
// work is a candidate. Pure: the moment and the rows are parameters.

/** A reported context counts for this many hours. */
export const REPORT_HOURS = 3;
/** A block with a place counts this many minutes before it starts. */
export const BLOCK_AHEAD_MINUTES = 30;

const HOUR = 3_600_000;
const MINUTE = 60_000;

export type ReportedContext = { context: Context; at: Date };

export type ContextArgs = {
  /** The second screen ("desk") or the phone. */
  device: "desk" | "phone";
  now: Date;
  /** The day being planned. */
  date: string;
  /** The last value `core/context` wrote; null when there is none. */
  reported: ReportedContext | null;
  blocks: Block[];
};

/** Turkish lower case, without the marks that differ between spellings ("Kampüs" = "kampus"). */
function plain(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u");
}

const PLACE_WORDS: { context: Context; words: string[] }[] = [
  { context: "home", words: ["ev", "evde", "home"] },
  { context: "office", words: ["ofis", "is", "isyeri", "office"] },
  { context: "campus", words: ["kampus", "okul", "universite", "fakulte", "campus"] },
  { context: "commute", words: ["yol", "yolda", "commute"] },
];

/**
 * The context of a block's place: a known word in its place ("Ev", "Ofis", "Kampüs", "Yolda"),
 * else the block's day type, else somewhere out of home (`out`).
 */
export function placeContext(block: Pick<Block, "location" | "day_type">): Context {
  const words = plain(block.location ?? "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  for (const place of PLACE_WORDS) {
    if (place.words.some((word) => words.includes(word))) return place.context;
  }
  return block.day_type ?? "out";
}

/** The day type the day's own blocks give it; null when none of them says (no default). */
export function statedDayType(day: string, blocks: Block[]): DayType | null {
  const start = istanbulInstant(day).getTime();
  const end = istanbulInstant(shiftDay(day, 1)).getTime();
  const typed = blocks.find(
    (block) =>
      block.status !== "cancelled" &&
      block.day_type !== null &&
      Date.parse(block.starts_at) < end &&
      Date.parse(block.ends_at) > start,
  );
  return typed?.day_type ?? null;
}

/** The report kept on the settings row (`reported_context`, `reported_context_at`). */
export function reportedOf(
  row: { reported_context: Context | null; reported_context_at: string | null } | null,
): ReportedContext | null {
  if (!row?.reported_context || !row.reported_context_at) return null;
  return { context: row.reported_context, at: new Date(row.reported_context_at) };
}

/** Where the device is; null: unknown, the context filter is off. */
export function inferContext(args: ContextArgs): Context | null {
  if (args.device === "desk") return "desk";
  const now = args.now.getTime();
  // (a) What the phone's automation reported in the last three hours (location, later).
  if (args.reported) {
    const at = args.reported.at.getTime();
    if (at <= now && now - at <= REPORT_HOURS * HOUR) return args.reported.context;
  }
  // (b) A fixed block with a place that is on now, or starts within half an hour.
  const placed = args.blocks
    .filter(
      (block) =>
        block.status !== "cancelled" &&
        block.location !== null &&
        block.location.trim() !== "" &&
        Date.parse(block.ends_at) > now &&
        Date.parse(block.starts_at) - BLOCK_AHEAD_MINUTES * MINUTE <= now,
    )
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  if (placed.length > 0) return placeContext(placed[0]);
  // (c) The day's type, as its blocks state it.
  return statedDayType(args.date, args.blocks);
}
