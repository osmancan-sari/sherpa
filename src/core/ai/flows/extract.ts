import type { ModuleRegistry } from "@/core/contract/types";
import { dayKey } from "@/lib/date";
import { type ExtractInput, extractSpec } from "../calls/extract";
import { type AiDeps, runAiCall } from "../gateway";
import { weekdayName } from "./enrich";

// `extract`: pasted text → structured suggestions in the shape a module's extractor gives.
// The core runs the call and hands the suggestions back; the module decides what they become
// (usually a card the user confirms). Nothing is written here.

export type ExtractRequest = {
  module: string;
  extractor: string;
  text: string;
  /** When the text was published (ISO), if known. */
  publishedAt?: string | null;
  /** What the module knows that helps to read the text. */
  context?: Record<string, unknown>;
};

export type ExtractOutcome =
  | { status: "ok"; suggestions: unknown[]; note: string | null; callId: string }
  | { status: "skipped" | "failed"; reason: string }
  /** No active module with that extractor. */
  | { status: "unknown" };

/** Longest text sent to the model; a pasted page is cut, not refused. */
export const EXTRACT_MAX_CHARS = 8_000;

export async function runExtract(
  deps: AiDeps,
  registry: ModuleRegistry,
  request: ExtractRequest,
  now: Date,
): Promise<ExtractOutcome> {
  const extractor = registry
    .get(request.module)
    ?.extractors?.find((candidate) => candidate.key === request.extractor);
  if (!extractor) return { status: "unknown" };
  const mod = (
    await deps.db.from("modules").select("id, status").eq("slug", request.module).maybeSingle()
  ).data;
  if (!mod || mod.status !== "active") return { status: "unknown" };

  const input: ExtractInput = {
    text: request.text.slice(0, EXTRACT_MAX_CHARS),
    today: dayKey(now),
    weekday: weekdayName(now),
    published_at: request.publishedAt ? dayKey(new Date(request.publishedAt)) : null,
    context: request.context ?? {},
  };
  const result = await runAiCall(deps, extractSpec(request.module, extractor), input, {
    subject: { type: "module", id: mod.id },
  });
  if (result.status !== "ok") return { status: result.status, reason: result.reason };
  return {
    status: "ok",
    suggestions: result.output.suggestions,
    note: result.output.note,
    callId: result.callId,
  };
}
