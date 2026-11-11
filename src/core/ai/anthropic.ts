import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { type AiProvider, ProviderError, type ProviderRequest } from "./types";

/**
 * The real provider: Anthropic's Messages API with structured outputs. The answer is asked for
 * as JSON in the call's schema (`output_config.format`); the gateway validates it again.
 * Retries are off: the gateway's timeout is the whole wait, and a failed call simply means the
 * work goes on without AI.
 */
export function anthropicProvider(apiKey: string): AiProvider {
  const client = new Anthropic({ apiKey, maxRetries: 0 });

  return {
    name: "anthropic",
    async complete(request: ProviderRequest) {
      let message: Anthropic.Message;
      try {
        message = await client.messages.create(
          {
            model: request.model,
            max_tokens: request.maxTokens,
            system: request.system,
            messages: [{ role: "user", content: request.user }],
            output_config: {
              // Intake calls must answer within seconds; judgement calls may think more.
              effort: request.tier === "fast" ? "low" : "medium",
              format: zodOutputFormat(request.schema),
            },
          },
          { signal: request.signal },
        );
      } catch (error) {
        if (error instanceof Anthropic.APIUserAbortError) {
          throw new ProviderError("timeout", "aborted");
        }
        if (error instanceof Anthropic.APIConnectionTimeoutError) {
          throw new ProviderError("timeout", error.message);
        }
        if (error instanceof Anthropic.APIError) {
          throw new ProviderError("provider_error", `${error.status ?? "-"} ${error.message}`);
        }
        throw new ProviderError("provider_error", String(error));
      }

      const usage = {
        model: message.model,
        // Prompt caching is not used (docs/10-yapay-zeka.md); counted in full if it ever appears.
        inputTokens:
          message.usage.input_tokens +
          (message.usage.cache_creation_input_tokens ?? 0) +
          (message.usage.cache_read_input_tokens ?? 0),
        outputTokens: message.usage.output_tokens,
      };
      if (message.stop_reason === "refusal") {
        throw new ProviderError("refused", message.stop_details?.category ?? "refusal", usage);
      }
      if (message.stop_reason === "max_tokens") {
        throw new ProviderError("truncated", `stopped at ${request.maxTokens} tokens`, usage);
      }

      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
      return { text, ...usage };
    },
  };
}
