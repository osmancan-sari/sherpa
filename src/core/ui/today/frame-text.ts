import type { Assignment, DayFrame, Plan, PlanInput, SleepPlan } from "@/core/planner";
import { blocksOfDay } from "@/core/today/select";
import { formatMinutes, formatTime, shiftDay } from "@/lib/date";

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

/** The waking on the top bar: "uyanış 07:40", "uyanış ~07:40" (estimated), "beklenen 08:00". */
export function wakeText(frame: DayFrame): string {
  if (!frame.woke) return `beklenen uyanış ${formatTime(frame.wake)}`;
  return `uyanış ${frame.estimated ? "~" : ""}${formatTime(frame.wake)}`;
}

export type TodayBriefLine = { top: string[]; firstBlock: string | null; finishLine: string };

/** The morning's short summary: the day's three, the first block, the finish line. */
export function briefLine(input: PlanInput, plan: Plan): TodayBriefLine {
  const top = plan.top3.flatMap((id) => {
    const candidate = plan.candidates.find((row) => row.id === id || row.task?.work_item_id === id);
    return candidate ? [candidate.title] : [];
  });
  const first = blocksOfDay(input.blocks, input.date)
    .filter((block) => block.status !== "cancelled")
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
  return {
    top,
    firstBlock: first ? `${formatTime(new Date(first.starts_at))} ${first.title}` : null,
    finishLine: formatTime(input.finishLine),
  };
}

type SleepDay = { date: string; woke_at: string | null; bed_at: string | null };

const minutesOfDay = (instant: Date) => {
  const [hours, minutes] = formatTime(instant).split(":").map(Number);
  return hours * 60 + minutes;
};
const clockText = (minutes: number) => {
  const whole = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
};
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Hafta's one line (docs/05-arayuz.md, "Günün çerçevesi"): the last seven days' average waking,
 * bedtime and sleep, from the days that have them; null when none has. A bedtime after midnight
 * counts as late in the night, not early in the day.
 */
export function sleepSummary(days: SleepDay[], today: string): string | null {
  const since = shiftDay(today, -7);
  const recent = days.filter((day) => day.date >= since && day.date <= today);
  const wakes = recent.flatMap((day) => (day.woke_at ? [minutesOfDay(new Date(day.woke_at))] : []));
  const beds = recent.flatMap((day) => {
    if (!day.bed_at) return [];
    const minutes = minutesOfDay(new Date(day.bed_at));
    return [minutes < 12 * 60 ? minutes + 1440 : minutes];
  });
  const sleeps = recent.flatMap((day) => {
    const next = days.find((row) => row.date === shiftDay(day.date, 1));
    if (!day.bed_at || !next?.woke_at) return [];
    const minutes = (Date.parse(next.woke_at) - Date.parse(day.bed_at)) / 60_000;
    return minutes > 0 && minutes < 16 * 60 ? [minutes] : [];
  });
  const parts = [
    wakes.length > 0 ? `uyanış ${clockText(average(wakes))}` : null,
    beds.length > 0 ? `yatış ${clockText(average(beds))}` : null,
    sleeps.length > 0 ? `uyku ${formatMinutes(Math.round(average(sleeps) / 5) * 5)}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `Son 7 gün ortalaması: ${parts.join(" · ")}` : null;
}
