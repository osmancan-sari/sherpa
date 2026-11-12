import { handleTick } from "@/core/server/jobs";
import { registry } from "@/modules/registry";

/**
 * The scheduler's one endpoint (Ç3d; docs/02-mimari.md "Zamanlanmış işler"): POST from the
 * database's pg_cron every 15 minutes, GET from the host's cron once a day. Both carry
 * `Authorization: Bearer <CRON_SECRET>`; without it, 401. It answers with counts only.
 */
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  return handleTick(request, { registry });
}

export async function GET(request: Request): Promise<Response> {
  return handleTick(request, { registry });
}
