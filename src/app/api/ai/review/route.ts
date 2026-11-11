import { z } from "zod";
import { reviewFlow } from "@/core/ai/flows/planning";
import { aiRoute } from "@/core/ai/route";
import { registry } from "@/modules/registry";

/** The week behind, from the modules' own reports; kept for the week screen. */
export const POST = aiRoute(z.object({}), (deps) => reviewFlow(deps, registry, new Date()));
