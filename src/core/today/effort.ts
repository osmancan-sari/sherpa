import type { WorkItem } from "@/core/types";
import { formatMinutes } from "@/lib/date";

// Okul çekirdek A (docs/06-modul-sozlesmesi.md, "İş zarfı"; docs/tasarim/parcalar.md,
// "Yaklaşık süre"): a work item's placeholder effort. The planner counts it like any effort; the
// screens write "yaklaşık" before it, and "Neden?" says what it rests on. Pure.

type EffortRow = Pick<WorkItem, "effort_provisional" | "effort_basis"> | null | undefined;

/** The work item's effort is a placeholder (never the user's own: the core clears it then). */
export function isPlaceholder(item: EffortRow): boolean {
  return Boolean(item?.effort_provisional);
}

/** "yaklaşık 2 sa" for a placeholder's minutes, else "2 sa". */
export function effortText(minutes: number, approx: boolean): string {
  return approx ? `yaklaşık ${formatMinutes(minutes)}` : formatMinutes(minutes);
}

/**
 * The line "Neden?" adds for the work's effort: the module's sentence, else the AI's reason for
 * the number when the number is the AI's. A placeholder says so even without a reason; a real
 * effort with no sentence adds nothing.
 */
export function effortWhy(item: EffortRow, aiReason: string | null = null): string | null {
  if (!item) return null;
  const reason = item.effort_basis?.trim() || aiReason?.trim() || null;
  if (item.effort_provisional) {
    return reason
      ? `Süre yaklaşık: ${reason}`
      : "Süre yaklaşık; modül kesin süreyi verince güncellenir.";
  }
  return item.effort_basis?.trim() ? `Süre: ${item.effort_basis.trim()}` : null;
}
