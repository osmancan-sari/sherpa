import { exportAll } from "@/core/data/export";
import { getCurrentUser } from "@/lib/auth/session";
import { dayKey } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import { registry } from "@/modules/registry";

/**
 * "Tümünü dışa aktar": every row the signed-in user owns, core and module tables alike, as one
 * JSON file. The session is checked here as well as in the proxy; the data is read with the
 * user's own rights, so row level security decides what "everything" is.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const moduleTables = registry.list.flatMap((definition) => definition.tables ?? []);
  const document = await exportAll(await createClient(), moduleTables, now);

  return new Response(JSON.stringify(document, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sherpa-${dayKey(now)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
