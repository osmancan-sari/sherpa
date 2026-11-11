import { z } from "zod";
import { planDayFlow } from "@/core/ai/flows/planning";
import { aiRoute } from "@/core/ai/route";

/**
 * The day's plan with the AI's advice: `plan` (the morning, the closing's draft with `preview`)
 * and `replan` ("Yeniden planla"). The engine's plan stands whatever the answer.
 */
export const POST = aiRoute(
  z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    kind: z.enum(["plan", "replan"]).default("plan"),
    note: z.string().max(500).nullable().optional(),
    preview: z.boolean().optional(),
    context: z.enum(["any", "desk", "home", "campus", "office", "out", "commute"]).optional(),
  }),
  (deps, body) => planDayFlow(deps, body, new Date()),
);
