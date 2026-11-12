import type { ProposalResult } from "@/core/contract/types";

/** Re-proposals that change these fields change the scope of the work: `size` may ask again. */
export const SCOPE_FIELDS: readonly string[] = [
  "title",
  "meta",
  "effort_min_minutes",
  "effort_max_minutes",
];

/**
 * After a module's proposal: a new work item, or one whose scope may have changed, is worth
 * asking about. Only a trigger: the server decides from the data what (if anything) to
 * estimate; most proposals need nothing. Pure; the browser and the server both use it.
 */
export function sizeRequestFor(result: ProposalResult): { id: string } | null {
  if (result.target !== "work_item") return null;
  if (!result.created && !result.changed.some((field) => SCOPE_FIELDS.includes(field))) {
    return null;
  }
  return { id: result.id };
}
