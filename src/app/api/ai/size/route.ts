import { z } from "zod";
import { sizeWorkItem } from "@/core/ai/flows/size";
import { aiRoute } from "@/core/ai/route";
import { registry } from "@/modules/registry";

/** A module proposed a work item: estimate the judgement fields it left empty. */
export const POST = aiRoute(
  z.object({ id: z.guid(), rescope: z.boolean().optional() }),
  (deps, body) => sizeWorkItem(deps, registry, body, new Date()),
);
