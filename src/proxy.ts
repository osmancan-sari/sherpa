import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
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
