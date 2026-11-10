import { getCurrentUser } from "@/lib/auth/session";

/**
 * Who is signed in. Ç0's only API route; it also shows the pattern every later route follows:
 * check the session in the handler itself, on top of the proxy.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json({ email: user.email });
}
