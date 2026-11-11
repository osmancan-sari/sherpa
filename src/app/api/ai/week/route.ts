import { z } from "zod";
import { weekFlow } from "@/core/ai/flows/planning";
import { aiRoute } from "@/core/ai/route";

/** The week's commitment with the AI's advice; `force` is the user's "Haftayı yeniden kur". */
export const POST = aiRoute(z.object({ force: z.boolean().optional() }), async (deps, body) => {
  const result = await weekFlow(deps, new Date(), body.force ?? false);
  return { action: result.action, source: result.plan?.plan_source ?? null };
});
