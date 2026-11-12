import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * The two endpoints that answer without a session and check their own key (Ç3d,
 * docs/02-mimari.md "Kimlik ve güvenlik"): the ingest endpoint (a device token) and the
 * scheduler's (CRON_SECRET). Both answer 401 without their key and never return data.
 */
const OWN_KEY = /^\/api\/(ingest\/[^/]+\/[^/]+|jobs\/tick)$/;

export async function proxy(request: NextRequest) {
  if (OWN_KEY.test(request.nextUrl.pathname)) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything goes through the session gate, pages and API routes alike, except:
     * - Next.js build assets (_next/static)
     * - what the browser and the phone fetch without cookies to install the app:
     *   the manifest, the icons, robots.txt (exact paths, not prefixes)
     * The image optimizer (_next/image) stays behind the gate: nothing signed-out needs it.
     */
    "/((?!_next/static/|robots\\.txt$|manifest\\.webmanifest$|icon\\.png$|apple-icon\\.png$|icons/[^/]+\\.png$).*)",
  ],
};
