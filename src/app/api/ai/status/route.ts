import { aiStatus } from "@/core/ai/status";
import { aiDepsForRequest } from "@/core/ai/route";

/** Whether the AI can answer now, and this month's spending (settings, the one-line notice). */
export async function GET() {
  const deps = await aiDepsForRequest();
  if (!deps) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await aiStatus(deps, new Date()), {
    headers: { "Cache-Control": "no-store" },
  });
}
