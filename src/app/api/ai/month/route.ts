import { z } from "zod";
import { monthFlow } from "@/core/ai/flows/planning";
import { aiRoute } from "@/core/ai/route";

/** The coming eight weeks: proposals for the tight ones, kept for the week screen. */
export const POST = aiRoute(z.object({}), (deps) => monthFlow(deps, new Date()));
