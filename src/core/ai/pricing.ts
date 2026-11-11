// What a call costs, in US dollars per million tokens.
//
// Taken from the official price list on 11 Nov 2026 (docs/10-yapay-zeka.md, "Maliyet").
// A model that is not listed here is not called at all: its cost could not be counted against
// the monthly budget. Changing AI_MODEL_FAST or AI_MODEL_PLAN to a new model means adding it here.

type Price = {
  input: number;
  output: number;
  /** Above this many input tokens the long-context price applies to the whole call. */
  longContext?: { above: number; input: number; output: number };
};

const PRICES: Record<string, Price> = {
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    longContext: { above: 100_000, input: 0.5, output: 2.5 },
  },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
  // The fake provider of the tests: each tier priced like the real model of that tier, so the
  // budget is exercised the way it will be with a key.
  "fake-fast": { input: 0.1, output: 0.5 },
  "fake-plan": { input: 2, output: 10 },
};

export function hasPrice(model: string): boolean {
  return Object.hasOwn(PRICES, model);
}

/** Cost of one call in dollars; null for a model without a price. */
export function callCost(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = Object.hasOwn(PRICES, model) ? PRICES[model] : undefined;
  if (!price) return null;
  const long = price.longContext && inputTokens > price.longContext.above;
  const input = long ? price.longContext!.input : price.input;
  const output = long ? price.longContext!.output : price.output;
  // Rounded to a millionth of a dollar, the precision the log keeps meaningfully.
  return Math.round(inputTokens * input + outputTokens * output) / 1_000_000;
}
