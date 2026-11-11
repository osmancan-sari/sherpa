import { z } from "zod";
import type { AiCallSpec } from "../gateway";
import { SHARED_RULES } from "./common";

// `extract`: pasted free text (an announcement, an e-mail) → structured suggestions in a shape
// the module gives. The core only carries the call; the module says what to look for and what
// one suggestion looks like, and decides what to do with the answer.

export type ExtractInput = {
  text: string;
  today: string;
  weekday: string;
  /** When the text was published, if known: relative dates in it count from that day. */
  published_at: string | null;
  /** What the module knows that helps to read the text (for example a course's open assessments). */
  context: Record<string, unknown>;
};

export type ExtractOutput<T> = { suggestions: T[]; note: string | null };

export type Extractor<T> = {
  /** Unique inside the module: 'ninova_announcement'. */
  key: string;
  /** Changes whenever the instructions or the item schema change. */
  version: string;
  /** What to look for in the text, in the module's own terms. */
  instructions: string;
  /** One suggestion. */
  item: z.ZodType<T>;
  /** Most suggestions one text may give. */
  max?: number;
};

/** The call spec of one module extractor. */
export function extractSpec<T>(
  moduleSlug: string,
  extractor: Extractor<T>,
): AiCallSpec<ExtractOutput<T>> {
  return {
    kind: "extract",
    version: `extract-1/${moduleSlug}/${extractor.key}/${extractor.version}`,
    maxTokens: 4000,
    schema: z.object({
      suggestions: z.array(extractor.item).max(extractor.max ?? 10),
      note: z.string().max(300).nullable(),
    }) as z.ZodType<ExtractOutput<T>>,
    system: `Read the text the user pasted and pull out structured suggestions. What to look for:

${extractor.instructions}

- Only suggest what the text actually says; an empty list is a fine answer.
- "context" lists what the app already knows; match the text to it where you can.
- note: one short Turkish sentence if something in the text needs the user's attention and is
  not a suggestion, else null.

${SHARED_RULES}`,
  };
}
