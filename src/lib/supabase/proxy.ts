import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth/allowed-email";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

const LOGIN_PATH = "/giris";

/**
 * Runs on every request: refreshes the Supabase session cookie and gates the app.
 * Without a valid session of the allowed user, pages redirect to the login page
 * and API routes answer 401, so nothing returns data to a stranger.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers)) {
          supabaseResponse.headers.set(name, value);
        }
      },
    },
  });

  // Do not run code between createServerClient and getClaims: getClaims is what
  // validates the token and refreshes it when it has expired.
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  const signedIn = typeof email === "string" && isAllowedEmail(email, process.env.ALLOWED_EMAIL);

  const { pathname } = request.nextUrl;
  const isLogin = pathname === LOGIN_PATH;

  if (!signedIn && !isLogin) {
    if (pathname.startsWith("/api/")) {
      return withSessionCookies(
        NextResponse.json({ error: "unauthorized" }, { status: 401 }),
        supabaseResponse,
      );
    }
    return withSessionCookies(redirectTo(request, LOGIN_PATH), supabaseResponse);
  }

  if (signedIn && isLogin) {
    return withSessionCookies(redirectTo(request, "/"), supabaseResponse);
  }

  return supabaseResponse;
}

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";
  return NextResponse.redirect(target);
}

/** Carries refreshed or cleared session cookies over to a response we build ourselves. */
function withSessionCookies(response: NextResponse, supabaseResponse: NextResponse): NextResponse {
  for (const cookie of supabaseResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = supabaseResponse.headers.get(header);
    if (value) response.headers.set(header, value);
  }
  return response;
}
