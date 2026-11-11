import "server-only";
import type { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { aiConfigFromEnv } from "./config";
import type { AiDeps } from "./gateway";

// The `/api/ai/*` routes share this: the session is checked in the handler (on top of the
// proxy), the body is validated, and the gateway gets the user's own database client, so the
// log is written and the budget read with the user's rights. The key never leaves the server.

/** The gateway's wiring for the signed-in user, or null without a session. */
export async function aiDepsForRequest(): Promise<AiDeps | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return { db: await createClient(), config: aiConfigFromEnv() };
}

/** A POST handler that runs one AI flow on a validated body and answers with its outcome. */
export function aiRoute<B>(body: z.ZodType<B>, run: (deps: AiDeps, body: B) => Promise<unknown>) {
  return async function POST(request: Request): Promise<Response> {
    const deps = await aiDepsForRequest();
    if (!deps) return Response.json({ error: "unauthorized" }, { status: 401 });

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }
    const parsed = body.safeParse(json);
    if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });

    try {
      return Response.json(await run(deps, parsed.data), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      // The gateway never throws for an AI failure; this is the database or a bug. The work
      // the user entered is already saved, so the screen carries on without the AI.
      console.error("ai route failed", error);
      return Response.json({ status: "failed", reason: "server_error" }, { status: 500 });
    }
  };
}
