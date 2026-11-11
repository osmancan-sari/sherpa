import type { ModuleContext, WorkProposal } from "@/core/contract/types";
import type { AppEvent } from "@/core/types";

// The module's rules: which work it proposes for its own records, and how it reacts to events.
// This file is the code of the "Kurallar" section in docs/moduller/<slug>.md.

/**
 * Example of a proposal. `key` is stable per source record: proposing again with the same key
 * updates the same work instead of creating a second one, and never overwrites a field the
 * user changed. State what the module knows; leave the rest empty.
 */
export async function proposeExample(
  ctx: ModuleContext,
  record: { id: string; title: string; dueAt: string | null },
): Promise<void> {
  const proposal: WorkProposal = {
    schema: 1,
    key: `kayit:${record.id}`,
    source: { type: "sablon.kayit", id: record.id },
    title: record.title,
    when: { due: record.dueAt },
    // No length known: give bounds and let the core (later the AI) decide.
    effort: { bounds: { min: 30, max: 120 } },
  };
  await ctx.propose(proposal);
}

/** Event listeners: "<event type>": handler. Modules never import each other. */
export const listeners: Record<string, (event: AppEvent, ctx: ModuleContext) => Promise<void>> = {};
