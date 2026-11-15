import { planDayFlow, PLAN_REQUEST } from "@/core/ai/flows/planning";
import { aiRoute } from "@/core/ai/route";

/**
 * The day's plan with the AI's advice: `plan` (the morning, the closing's draft with `preview`)
 * and `replan` ("Yeniden planla"). The engine's plan stands whatever the answer.
 */
export const POST = aiRoute(PLAN_REQUEST, (deps, body) => planDayFlow(deps, body, new Date()));
