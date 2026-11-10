import type { ModuleDefinition, StructuredBlockHandler } from "@/core/contract/types";

// Hook for structured blocks: text pasted into quick add may carry a fenced block that a module
// knows how to read (the `sherpa` block a Claude course project prints after a prep document,
// docs/moduller/okul.md). The core finds and parses the block; which module takes it is decided
// by the handlers the modules register. No AI call is involved.

export const BLOCK_LANGUAGE = "sherpa";

export type StructuredBlock = {
  /** The JSON inside the fence. */
  payload: unknown;
  /** The fence exactly as it was pasted. */
  raw: string;
};

const FENCE = /(```|~~~)[ \t]*sherpa[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*\1/g;

/** Finds every `sherpa` block in a text. A block whose content is not valid JSON is skipped. */
export function findStructuredBlocks(text: string): StructuredBlock[] {
  const blocks: StructuredBlock[] = [];
  for (const match of text.matchAll(FENCE)) {
    try {
      blocks.push({ payload: JSON.parse(match[2]), raw: match[0] });
    } catch {
      // Not JSON: leave it to the inbox as ordinary text.
    }
  }
  return blocks;
}

export type BlockRoute = {
  block: StructuredBlock;
  module: ModuleDefinition;
  handler: StructuredBlockHandler;
};

/**
 * Pairs each block with the first module that accepts it. Blocks nobody accepts are returned
 * separately; the caller keeps them in the inbox.
 */
export function routeStructuredBlocks(
  blocks: StructuredBlock[],
  modules: readonly ModuleDefinition[],
): { routed: BlockRoute[]; unclaimed: StructuredBlock[] } {
  const routed: BlockRoute[] = [];
  const unclaimed: StructuredBlock[] = [];

  for (const block of blocks) {
    let match: BlockRoute | null = null;
    for (const mod of modules) {
      const handler = (mod.blocks ?? []).find((candidate) => {
        try {
          return candidate.match(block.payload);
        } catch {
          return false;
        }
      });
      if (handler) {
        match = { block, module: mod, handler };
        break;
      }
    }
    if (match) routed.push(match);
    else unclaimed.push(block);
  }
  return { routed, unclaimed };
}
