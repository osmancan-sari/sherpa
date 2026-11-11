import type { DecomposeOutput } from "./calls/decompose";
import type { EnrichInput, EnrichOutput } from "./calls/enrich";
import type { SizeInput, SizeOutput } from "./calls/size";
import { type AiKind, type AiProvider, ProviderError, type ProviderRequest } from "./types";

// A provider that never leaves the machine. It answers from recorded rules, so the app and the
// end-to-end tests can run every AI path without an API key (stop D3 in prompts/BASLA.md).
//
// Markers in the input make it misbehave on purpose:
//   [ai:invalid]  answers JSON that does not fit the schema
//   [ai:timeout]  never answers (until the gateway gives up)
//   [ai:error]    fails like an unreachable API
//   [ai:refusal]  refuses, after using some tokens

type Answer = (input: unknown) => unknown;

const none = { value: null, confidence: 0, reason: "" };

function enrich(input: unknown): EnrichOutput {
  const { text } = input as EnrichInput;
  return {
    title: text.trim().slice(0, 200) || "İş",
    module: { value: null, confidence: 0.2, reason: "uygun modül bulunamadı" },
    target: { value: "task", confidence: 0.6, reason: "tek oturumluk görünüyor" },
    est_minutes: { value: 30, confidence: 0.4, reason: "benzer iş yok; varsayılan" },
    energy: { value: "light", confidence: 0.4, reason: "kısa iş" },
    context: { value: "any", confidence: 0.4, reason: "yer belirtilmemiş" },
    importance: { value: 2, confidence: 0.4, reason: "son tarih yok" },
    due: none,
    steps: [],
  };
}

function size(input: unknown): SizeOutput {
  const { need, bounds } = input as SizeInput;
  const wants = (field: SizeInput["need"][number]) => need.includes(field);
  // Inside the bounds but not their middle, so a test can tell the AI's value from the default.
  const effort = bounds ? Math.round((bounds.min + (bounds.max - bounds.min) * 0.6) / 5) * 5 : 120;
  return {
    effort_total_minutes: wants("effort_total_minutes")
      ? { value: effort, confidence: 0.7, reason: "benzer işlerin süresine göre" }
      : none,
    session_minutes: wants("session_minutes")
      ? { value: 45, confidence: 0.6, reason: "odak isteyen iş" }
      : none,
    importance: wants("importance")
      ? { value: 3, confidence: 0.6, reason: "son tarih yakın" }
      : none,
    energy: wants("energy") ? { value: "deep", confidence: 0.6, reason: "odak isteyen iş" } : none,
  };
}

function decompose(): DecomposeOutput {
  return {
    steps: [
      { ref: "a", title: "Kapsamı çıkar", effort_minutes: 45, depends_on: [], due: null },
      { ref: "b", title: "İlk taslak", effort_minutes: 120, depends_on: ["a"], due: null },
      {
        ref: "c",
        title: "Gözden geçir ve bitir",
        effort_minutes: 60,
        depends_on: ["b"],
        due: null,
      },
    ],
    reason: "Önce kapsam, sonra taslak, en son gözden geçirme.",
  };
}

const ANSWERS: Record<AiKind, Answer> = {
  enrich,
  size,
  decompose,
  extract: () => ({ suggestions: [], note: null }),
};

/** Rough token count, so the fake's calls have a cost and the budget is exercised. */
const tokens = (text: string) => Math.max(1, Math.ceil(text.length / 4));

export function fakeProvider(answers: Partial<Record<AiKind, Answer>> = {}): AiProvider {
  return {
    name: "fake",
    async complete(request: ProviderRequest) {
      const usage = {
        model: request.model,
        inputTokens: tokens(request.system) + tokens(request.user),
        outputTokens: 50,
      };
      if (request.user.includes("[ai:timeout]")) {
        await new Promise<never>((_, reject) => {
          request.signal.addEventListener("abort", () =>
            reject(new ProviderError("timeout", "aborted")),
          );
        });
      }
      if (request.user.includes("[ai:error]")) {
        throw new ProviderError("provider_error", "fake: unreachable");
      }
      if (request.user.includes("[ai:refusal]")) {
        throw new ProviderError("refused", "fake: refusal", usage);
      }
      if (request.user.includes("[ai:invalid]")) {
        return { ...usage, text: JSON.stringify({ title: 42 }) };
      }
      const answer = answers[request.kind] ?? ANSWERS[request.kind];
      const text = JSON.stringify(answer(JSON.parse(request.user)));
      return { ...usage, outputTokens: tokens(text), text };
    },
  };
}
