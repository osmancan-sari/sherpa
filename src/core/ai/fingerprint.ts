/**
 * JSON with the keys of every object sorted, so the same input always gives the same text,
 * whatever order its fields were built in.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeys(v)]));
  }
  return value;
}

/**
 * Short hash of everything that decides a call's answer: the kind, the model, the prompt and
 * output format versions, and the input. The same question is not asked twice (rule 10).
 */
export async function fingerprint(parts: {
  kind: string;
  model: string;
  version: string;
  input: unknown;
}): Promise<string> {
  const text = canonicalJson(parts);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
