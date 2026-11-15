import { TOKENS, type TokenName } from "./tokens.gen";

// The design values as data, for the code that computes with them (the sky, contrast checks, the
// colour picker). The values live in tokens.css; tokens.gen.ts is its generated mirror.

export { TOKENS, type TokenName };

/** A token's value with every `var(--…)` in it resolved. */
export function token(name: TokenName): string {
  return resolve(TOKENS[name]);
}

function resolve(value: string, depth = 0): string {
  if (depth > 8) throw new Error(`Token reference too deep: ${value}`);
  return value.replace(/var\(--([a-z0-9-]+)\)/gi, (_, ref: string) => {
    if (!(ref in TOKENS)) throw new Error(`Unknown token: --${ref}`);
    return resolve(TOKENS[ref as TokenName], depth + 1);
  });
}

/** The CSS reference of a token, for inline styles that must stay live (theme, preferences). */
export const cssVar = (name: TokenName) => `var(--${name})`;
