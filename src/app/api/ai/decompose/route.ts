import { z } from "zod";
import { decomposeWorkItem } from "@/core/ai/flows/decompose";
import { aiRoute } from "@/core/ai/route";

/** "Adımlara böl": suggest smaller pieces of a work item, to be accepted by the user. */
export const POST = aiRoute(z.object({ id: z.guid() }), (deps, body) =>
  decomposeWorkItem(deps, body, new Date()),
);
