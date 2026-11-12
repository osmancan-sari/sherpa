import { handleIngest } from "@/core/server/ingest";
import { registry } from "@/modules/registry";

/**
 * The ingest endpoint (Ç3d): outside sources write here with a device token. No session: the
 * token is the key (docs/02-mimari.md, "Cihaz anahtarları ve giriş ucu"). Writes only; nothing
 * is ever read back.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/ingest/[source]/[kind]">,
): Promise<Response> {
  return handleIngest(request, await params, { registry });
}
