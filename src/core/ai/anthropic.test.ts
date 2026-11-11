import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { decomposeSpec } from "./calls/decompose";
import { enrichSpec } from "./calls/enrich";
import { extractSpec } from "./calls/extract";
import { sizeSpec } from "./calls/size";
import type { ModelTier, ProviderRequest } from "./types";

vi.mock("server-only", () => ({}));
const { anthropicProvider } = await import("./anthropic");

// The real provider without a key: the SDK runs as in production, but its HTTP requests are
// answered here. What is checked is the mapping between the API and the gateway.

const extract = extractSpec("okul", {
  key: "duyuru",
  version: "1",
  instructions: "x",
  item: z.object({ title: z.string(), due: z.string().nullable() }),
});

describe("structured output formats", () => {
  for (const spec of [enrichSpec, sizeSpec, decomposeSpec, extract]) {
    it(`${spec.kind}: converts to a strict JSON schema object`, () => {
      const format = zodOutputFormat(spec.schema as z.ZodType<unknown>);
      expect(format.type).toBe("json_schema");
      expect(format.schema).toMatchObject({ type: "object", additionalProperties: false });
      // Every property is required in strict mode; "unknown" is expressed as null.
      const schema = format.schema as { properties: object; required: string[] };
      expect(schema.required.sort()).toEqual(Object.keys(schema.properties).sort());
    });
  }
});

type Sent = { url: string; body: Record<string, unknown> };

function message(over: Record<string, unknown> = {}) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [
      { type: "text", text: '{"n":' },
      { type: "text", text: "2}" },
    ],
    stop_reason: "end_turn",
    stop_sequence: null,
    stop_details: null,
    usage: {
      input_tokens: 1200,
      output_tokens: 80,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
    },
    ...over,
  };
}

/** A provider whose every request gets the given response; the requests are kept. */
function provider(respond: (init: RequestInit) => Promise<Response> | Response) {
  const sent: Sent[] = [];
  const fetchMock = async (input: string | URL | Request, init?: RequestInit) => {
    sent.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? "{}")),
    });
    return respond(init ?? {});
  };
  return { sent, provider: anthropicProvider("sk-test", { fetch: fetchMock as typeof fetch }) };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function request(tier: ModelTier = "fast", signal = new AbortController().signal): ProviderRequest {
  return {
    kind: "size",
    model: tier === "fast" ? "claude-haiku-5-5" : "claude-sonnet-5-5",
    tier,
    system: "Sistem",
    user: '{"a":1}',
    schema: z.object({ n: z.number() }),
    maxTokens: 3000,
    signal,
  };
}

describe("the Anthropic provider", () => {
  it("asks for structured output in the call's schema, with the tier's effort", async () => {
    const { sent, provider: fast } = provider(() => json(message()));
    await fast.complete(request("fast"));
    const [call] = sent;
    expect(call.url).toMatch(/\/v1\/messages$/);
    expect(call.body).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: 3000,
      system: "Sistem",
      messages: [{ role: "user", content: '{"a":1}' }],
      output_config: { effort: "low", format: { type: "json_schema" } },
    });
    // Sampling parameters are not sent (the current API rejects them).
    expect(call.body).not.toHaveProperty("temperature");

    const { sent: planSent, provider: plan } = provider(() =>
      json(message({ model: "claude-sonnet-5-5" })),
    );
    await plan.complete(request("plan"));
    expect(planSent[0].body).toMatchObject({ output_config: { effort: "medium" } });
  });

  it("joins the text blocks and reports the tokens, counting cache tokens in full", async () => {
    const { provider: p } = provider(() =>
      json(
        message({
          content: [
            { type: "thinking", thinking: "", signature: "x" },
            { type: "text", text: '{"n":' },
            { type: "text", text: "2}" },
          ],
          usage: {
            input_tokens: 1000,
            output_tokens: 90,
            cache_creation_input_tokens: 20,
            cache_read_input_tokens: 5,
          },
        }),
      ),
    );
    expect(await p.complete(request())).toEqual({
      text: '{"n":2}',
      model: "claude-haiku-5-5",
      inputTokens: 1025,
      outputTokens: 90,
    });
  });

  it("maps a refusal and a cut-off answer, keeping what they used", async () => {
    const refused = provider(() =>
      json(
        message({
          content: [],
          stop_reason: "refusal",
          stop_details: { type: "refusal", category: "cyber", explanation: null },
        }),
      ),
    ).provider;
    await expect(refused.complete(request())).rejects.toMatchObject({
      reason: "refused",
      message: "cyber",
      usage: { inputTokens: 1200, outputTokens: 80, model: "claude-haiku-5-5" },
    });

    const truncated = provider(() => json(message({ stop_reason: "max_tokens" }))).provider;
    await expect(truncated.complete(request())).rejects.toMatchObject({
      reason: "truncated",
      usage: { outputTokens: 80 },
    });
  });

  it("maps API errors and network failures to provider errors, without retrying", async () => {
    const { sent, provider: p } = provider(() =>
      json({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }, 529),
    );
    await expect(p.complete(request())).rejects.toMatchObject({ reason: "provider_error" });
    expect(sent).toHaveLength(1);

    const down = provider(() => {
      throw new TypeError("fetch failed");
    }).provider;
    await expect(down.complete(request())).rejects.toMatchObject({ reason: "provider_error" });

    const badKey = provider(() =>
      json({ type: "error", error: { type: "authentication_error", message: "bad key" } }, 401),
    ).provider;
    await expect(badKey.complete(request())).rejects.toMatchObject({
      reason: "provider_error",
      message: expect.stringContaining("401"),
    });
  });

  it("maps the gateway's abort to a timeout", async () => {
    const controller = new AbortController();
    const { provider: p } = provider(
      (init) =>
        new Promise<Response>((_, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const pending = p.complete(request("fast", controller.signal));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ reason: "timeout" });
  });
});
