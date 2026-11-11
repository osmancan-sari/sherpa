import { z } from "zod";
import { EXTRACT_MAX_CHARS, runExtract } from "@/core/ai/flows/extract";
import { aiRoute } from "@/core/ai/route";
import { registry } from "@/modules/registry";

/** Pasted text → a module extractor's suggestions. Nothing is written. */
export const POST = aiRoute(
  z.object({
    module: z.string().min(1).max(100),
    extractor: z.string().min(1).max(100),
    text: z
      .string()
      .trim()
      .min(1)
      .max(EXTRACT_MAX_CHARS * 4),
    publishedAt: z.iso.datetime({ offset: true }).nullish(),
    // What the module knows about the text; small, like everything sent to the model (rule 7).
    context: z
      .record(z.string(), z.unknown())
      .refine((value) => JSON.stringify(value).length <= EXTRACT_MAX_CHARS, "context too large")
      .optional(),
  }),
  (deps, body) => runExtract(deps, registry, body, new Date()),
);
