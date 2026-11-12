import "server-only";
import type { z } from "zod";
import { aiConfigFromEnv } from "@/core/ai/config";
import { CORE_SOURCE, PART, scopeOf } from "@/core/contract/ingest";
import type { ModuleContext, ModuleRegistry } from "@/core/contract/types";
import { hashToken, TOKEN_SHAPE } from "@/core/data/tokens";
import type { Db } from "@/core/types";
import { activeModule, type ServerDeps } from "./context";
import { CORE_INGEST_HANDLERS, IngestRejection } from "./core-ingest";
import { actAs, deviceTokenOwner, type TokenOwner } from "./db";

// The ingest endpoint, POST /api/ingest/<source>/<kind> (docs/02-mimari.md, "Cihaz anahtarları
// ve giriş ucu"): the first way in that has no session. The checks, in order: the token (401),
// the rate (429), the kind (404), the scope (403), the module switched on (409), the body
// (413, 400 by the field's name), the Idempotency-Key (a repeat is not handled twice). Then the
// handler runs on the server, in the token owner's name. The token is never written anywhere:
// not to the log, not to an error, not to an event; neither is the body.

/** Requests per token per minute. */
export const INGEST_PER_MINUTE = 20;
/** The largest body taken, in bytes. */
export const INGEST_MAX_BYTES = 64 * 1024;

/** A request "processing" for longer than this was cut off: its key may be taken again. */
export const INGEST_ABANDONED_MS = 5 * 60_000;

const IDEMPOTENCY_KEY = /^[!-~]{1,200}$/;

/** The body as text, or null once it passes the limit (whatever Content-Length said). */
async function readLimited(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

type Status = "processing" | "done" | "rejected" | "failed";

function answer(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

const UNAUTHORIZED = () => answer(401, { error: "unauthorized" });

function bearer(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
  return match ? match[1] : null;
}

/** The body's problems, by name only: a path and what is wrong, never the value. */
function issuesOf(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "(body)",
    message: issue.message,
  }));
}

type Target =
  | {
      kind: "core";
      schema: z.ZodType;
      handle: (payload: unknown, deps: ServerDeps) => Promise<void>;
    }
  | {
      kind: "module";
      slug: string;
      schema: z.ZodType;
      handle: (payload: unknown, ctx: ModuleContext) => Promise<void>;
    };

function targetOf(registry: ModuleRegistry, source: string, kind: string): Target | null {
  if (source === CORE_SOURCE) {
    const own = CORE_INGEST_HANDLERS.find((handler) => handler.kind === kind);
    return own ? { kind: "core", schema: own.schema, handle: own.handle } : null;
  }
  const type = registry.get(source)?.ingest?.find((candidate) => candidate.kind === kind);
  return type ? { kind: "module", slug: source, schema: type.schema, handle: type.handle } : null;
}

export async function handleIngest(
  request: Request,
  params: { source: string; kind: string },
  env: { registry: ModuleRegistry; now?: () => Date; ai?: ServerDeps["ai"] },
): Promise<Response> {
  const now = env.now ?? (() => new Date());
  try {
    // 1. The token.
    const token = bearer(request.headers.get("authorization"));
    if (!token || !TOKEN_SHAPE.test(token)) return UNAUTHORIZED();
    const owner = await deviceTokenOwner(await hashToken(token));
    if (!owner) return UNAUTHORIZED();

    const { source, kind } = params;
    // Not even a name a kind could have: nothing to log it under.
    if (!PART.test(source) || !PART.test(kind)) return answer(404, { error: "unknown_kind" });

    const db = await actAs(owner.userId);
    const deps: ServerDeps = { db, registry: env.registry, now, ai: env.ai ?? aiConfigFromEnv() };
    const log = requestLog(db, owner, source, kind);

    // 2. The rate: what this token sent in the last minute, refused or not. Over it, nothing
    // is written, so a flood of any kind fills nothing.
    if ((await log.lastMinute()) >= INGEST_PER_MINUTE) {
      return answer(429, { error: "rate_limited" }, { "Retry-After": "60" });
    }

    // 3. The kind; 4. the scope; 5. the module.
    const target = targetOf(env.registry, source, kind);
    if (!target) return log.reject(404, "unknown_kind");
    if (!owner.scopes.includes(scopeOf(source, kind))) return log.reject(403, "forbidden");
    let ctx: ModuleContext | null = null;
    if (target.kind === "module") {
      const active = await activeModule(deps, target.slug);
      if (!active) return log.reject(409, "module_inactive");
      ctx = active.ctx;
    }

    // 6. The body, read no further than the limit.
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > INGEST_MAX_BYTES) return log.reject(413, "body_too_large");
    const text = await readLimited(request, INGEST_MAX_BYTES);
    if (text === null) return log.reject(413, "body_too_large");
    let json: unknown;
    try {
      json = text.trim() === "" ? {} : JSON.parse(text);
    } catch {
      return log.reject(400, "invalid_json");
    }
    const parsed = target.schema.safeParse(json);
    if (!parsed.success) {
      const issues = issuesOf(parsed.error);
      return log.reject(400, "invalid_body", issues);
    }

    // 7. The Idempotency-Key.
    const key = request.headers.get("idempotency-key");
    if (key !== null && !IDEMPOTENCY_KEY.test(key)) {
      return log.reject(400, "invalid_idempotency_key");
    }
    const claim = await log.claim(key === null ? null : await hashToken(key));
    if (claim === "done") {
      await log.write("done", 200, "duplicate");
      return answer(200, { ok: true, duplicate: true }, { "Idempotent-Replayed": "true" });
    }
    if (claim === "busy") return log.reject(409, "in_progress");

    // 8. The handler, in the token owner's name.
    try {
      if (target.kind === "core") await target.handle(parsed.data, deps);
      else await target.handle(parsed.data, ctx!);
    } catch (error) {
      if (error instanceof IngestRejection) {
        await log.finish(claim, "rejected", 400, `invalid_body: ${error.path}`, true);
        return answer(400, {
          error: "invalid_body",
          issues: [{ path: error.path, message: error.message }],
        });
      }
      // The handler's message goes to the server log only; the request may be tried again.
      console.error(`ingest ${source}/${kind} failed`, error instanceof Error ? error.message : "");
      await log.finish(claim, "failed", 500, "handler_failed", true);
      return answer(500, { error: "failed" });
    }
    await log.finish(claim, "done", 200, null, false);
    return answer(200, { ok: true });
  } catch (error) {
    console.error("ingest failed", error instanceof Error ? error.message : "");
    return answer(500, { error: "server_error" });
  }
}

/** The request's rows in `ingest_requests`, written in the owner's name. */
function requestLog(db: Db, owner: TokenOwner, source: string, kind: string) {
  const base = { token_id: owner.tokenId, source, kind };

  async function write(status: Status, http: number, error: string | null) {
    const { error: failure } = await db.from("ingest_requests").insert({
      ...base,
      status,
      http_status: http,
      error,
      finished_at: new Date().toISOString(),
    });
    if (failure) throw new Error(failure.message);
  }

  return {
    write,

    async reject(http: number, error: string, issues?: { path: string; message: string }[]) {
      const named = issues ? `${error}: ${issues.map((issue) => issue.path).join(", ")}` : error;
      await write("rejected", http, named.slice(0, 300));
      return answer(http, issues ? { error, issues } : { error });
    },

    /** Requests of this token in the last minute (by the server's clock: rows are stamped so). */
    async lastMinute(): Promise<number> {
      const { count, error } = await db
        .from("ingest_requests")
        .select("id", { count: "exact", head: true })
        .eq("token_id", owner.tokenId)
        .gte("created_at", new Date(Date.now() - 60_000).toISOString());
      if (error) throw new Error(error.message);
      return count ?? 0;
    },

    /**
     * Takes the key (its digest) for this request: its row id, "done" when the key was handled
     * before, or "busy" when that request is still running. A request without a key always gets
     * a row. A request left "processing" longer than INGEST_ABANDONED_MS (its function was cut
     * off) gives its key up: it is marked failed and this one takes over.
     */
    async claim(key: string | null): Promise<string | "done" | "busy"> {
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data, error } = await db
          .from("ingest_requests")
          .insert({ ...base, idempotency_key: key, status: "processing", http_status: 102 })
          .select("id")
          .single();
        if (!error) return data.id;
        if (error.code !== "23505" || key === null) throw new Error(error.message);
        const first = await db
          .from("ingest_requests")
          .select("id, status, created_at")
          .eq("token_id", owner.tokenId)
          .eq("idempotency_key", key)
          .maybeSingle();
        if (first.error) throw new Error(first.error.message);
        if (!first.data) continue;
        if (first.data.status === "done") return "done";
        const abandoned = Date.parse(first.data.created_at) < Date.now() - INGEST_ABANDONED_MS;
        if (!abandoned) return "busy";
        const released = await db
          .from("ingest_requests")
          .update({
            status: "failed",
            http_status: 500,
            error: "abandoned",
            idempotency_key: null,
            finished_at: new Date().toISOString(),
          })
          .eq("id", first.data.id)
          .eq("status", "processing");
        if (released.error) throw new Error(released.error.message);
      }
      return "busy";
    },

    /** Ends the claimed row; a request that did not get through gives its key back. */
    async finish(
      id: string,
      status: Status,
      http: number,
      error: string | null,
      releaseKey: boolean,
    ) {
      const { error: failure } = await db
        .from("ingest_requests")
        .update({
          status,
          http_status: http,
          error,
          finished_at: new Date().toISOString(),
          ...(releaseKey ? { idempotency_key: null } : {}),
        })
        .eq("id", id);
      if (failure) throw new Error(failure.message);
    },
  };
}
