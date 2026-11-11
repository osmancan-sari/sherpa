import type { ProposalResult } from "@/core/contract/types";
import { SCOPE_FIELDS } from "./flows/scope";

// The browser's side of the AI routes. Every request is fire-and-forget for the screen: the
// work is already saved and shown, the answer arrives through the live connection, and a
// failure (offline, server error) leaves the work as it is. Never throws.

export type AiCallName = "enrich" | "size" | "decompose" | "extract";

export async function postAi<T = unknown>(call: AiCallName, body: unknown): Promise<T | null> {
  try {
    const response = await fetch(`/api/ai/${call}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * After a module's proposal: a new work item, or one whose scope changed, may have judgement
 * fields to estimate. The server decides what is missing; most proposals need nothing. Pure.
 */
export function sizeRequestFor(result: ProposalResult): { id: string; rescope: boolean } | null {
  if (result.target !== "work_item") return null;
  const rescope = !result.created && result.changed.some((field) => SCOPE_FIELDS.includes(field));
  if (!result.created && !rescope) return null;
  return { id: result.id, rescope };
}

export function sizeAfterProposal(result: ProposalResult): Promise<unknown> | null {
  const request = sizeRequestFor(result);
  return request ? postAi("size", request) : null;
}
