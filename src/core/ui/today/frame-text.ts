import type { Assignment, DayFrame, PlanInput, SleepPlan } from "@/core/planner";
import { blocksOfDay } from "@/core/today/select";
import { formatMinutes, formatTime } from "@/lib/date";

// The day's frame in words (docs/05-arayuz.md, "Günün çerçevesi"). Plain sentences, no blame:
// a short night is said once, as a fact.

export type { Assignment, DayFrame, SleepPlan };

/** "Bu gece yatış 23:30 · yarın uyanış 07:30 · uyku 8 sa". */
export function sleepLine(frame: DayFrame): string {
  const bed = frame.bedAt ?? frame.bed;
  return [
    `Bu gece yatış ${formatTime(bed)}`,
    `yarın uyanış ${formatTime(frame.tonight.expectedWake)}`,
    `uyku ${formatMinutes(frame.tonight.sleepMinutes)}`,
  ].join(" · ");
}

/** Why tonight's sleep is under its target, when it is; null otherwise. */
export function shortLine(tonight: SleepPlan): string | null {
  const most = formatMinutes(tonight.sleepMinutes);
  if (tonight.short === "obligation") {
    return `Yarın erken bir yükümlülük var (en geç ${formatTime(tonight.latestWake)} kalkış); bu gece en çok ${most} uyku.`;
  }
  if (tonight.short === "late_bed") {
    return `Yarın en geç ${formatTime(tonight.latestWake)} kalkış; bu gece uyku ${most}.`;
  }
  if (tonight.short === "early_wake") return `Erken kalkışla bu gece uyku ${most}.`;
  return null;
}

export type TodayBriefLine = { firstBlock: string | null };

/**
 * The morning's short summary: the first block. Ç4a: no day's three ("Günün işleri") and no
 * finish line any more.
 */
export function briefLine(input: PlanInput): TodayBriefLine {
  const first = blocksOfDay(input.blocks, input.date)
    .filter((block) => block.status !== "cancelled")
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
  return {
    firstBlock: first ? `${formatTime(new Date(first.starts_at))} ${first.title}` : null,
  };
}
