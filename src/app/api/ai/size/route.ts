import { z } from "zod";
import { sizeTask, sizeWorkItem } from "@/core/ai/flows/size";
import { aiRoute } from "@/core/ai/route";
import { registry } from "@/modules/registry";

/**
 * A module proposed a work item: estimate the judgement fields it left empty (or whose scope
 * changed). A task: only a duration `enrich` left to a default (a confirmed inbox card).
 */
export const POST = aiRoute(
  z.object({ id: z.guid(), type: z.enum(["work_item", "task"]).default("work_item") }),
  (deps, body) =>
    body.type === "task"
      ? sizeTask(deps, registry, body, new Date())
      : sizeWorkItem(deps, registry, body, new Date()),
);
