import { z } from "zod";
import { enrichEntry } from "@/core/ai/flows/enrich";
import { aiRoute } from "@/core/ai/route";
import { registry } from "@/modules/registry";

/** Quick add saved a free line in the inbox: read it, and turn it into work when sure. */
export const POST = aiRoute(z.object({ entryId: z.guid() }), (deps, body) =>
  enrichEntry(deps, registry, body.entryId, new Date()),
);
