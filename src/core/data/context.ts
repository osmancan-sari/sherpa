import type {
  ModuleContext,
  ModuleRegistry,
  ProposalResult,
  PromptRequest,
} from "@/core/contract/types";
import { computeFacets } from "@/core/contract/facets";
import { emitEvent } from "@/core/events/bus";
import { rhythmProgress } from "@/core/today/select";
import { check, type Db, type ModuleRow, unwrap, toJson } from "@/core/types";
import { dayKey, shiftDay } from "@/lib/date";
import { listDayFrames } from "./frame";
import { propose, withdraw } from "./propose";

/**
 * Builds what the core hands a module: its row, database access for its own tables, and the
 * contract's verbs. Works with a browser or a server client; nothing here knows which.
 */
export function createModuleContext(input: {
  db: Db;
  registry: ModuleRegistry;
  module: ModuleRow;
  now?: () => Date;
  /**
   * Runs after each of the module's proposals, before `propose` resolves. The server uses it
   * to ask `size` at once (Ç3d); the browser asks through `onProposal` instead. It reaches the
   * contexts of the listeners the module's events wake as well.
   */
  onProposed?: (result: ProposalResult) => Promise<void>;
}): ModuleContext {
  const { db, registry, module: mod, onProposed } = input;
  const now = input.now ?? (() => new Date());
  const definition = registry.get(mod.slug);

  const ctx: ModuleContext = {
    module: mod,
    db,
    now,
    async propose(proposal) {
      // Ç3e: a facet must be in the module's list as it is now, computed with this context.
      const facets = await computeFacets(definition, ctx);
      const result = await propose(db, mod, proposal, facets);
      if (onProposed) await onProposed(result);
      return result;
    },
    withdraw: (key) => withdraw(db, mod, key),

    async emit(type, payload = {}) {
      if (!definition?.emits.includes(type)) {
        throw new Error(`module "${mod.slug}" does not declare the event "${type}" in emits`);
      }
      await emitEvent({ db, registry, type, payload, moduleSlug: mod.slug, now, onProposed });
    },

    async ask(prompt: PromptRequest) {
      check(
        await db.from("prompts").insert({
          module_id: mod.id,
          kind: prompt.kind,
          question: prompt.question,
          options: toJson(prompt.options),
          subject_type: prompt.subject?.type ?? null,
          subject_id: prompt.subject?.id ?? null,
          ask_after: (prompt.askAfter ?? now()).toISOString(),
        }),
      );
    },

    work: {
      async items() {
        return unwrap(
          await db.from("work_items").select("*").eq("module_id", mod.id).order("created_at"),
        );
      },
      async tasks() {
        return unwrap(
          await db.from("tasks").select("*").eq("module_id", mod.id).order("created_at"),
        );
      },
      async rhythms() {
        const rhythms = unwrap(
          await db.from("rhythms").select("*").eq("module_id", mod.id).eq("active", true),
        );
        if (rhythms.length === 0) return [];
        const logs = unwrap(
          await db
            .from("rhythm_logs")
            .select("*")
            .in(
              "rhythm_id",
              rhythms.map((rhythm) => rhythm.id),
            )
            .gte("done_on", shiftDay(dayKey(now()), -31)),
        );
        return rhythms.map((rhythm) => rhythmProgress(rhythm, logs, now()));
      },
      async rhythmLogs(sinceDay) {
        const rhythms = unwrap(await db.from("rhythms").select("id").eq("module_id", mod.id));
        if (rhythms.length === 0) return [];
        return unwrap(
          await db
            .from("rhythm_logs")
            .select("*")
            .in(
              "rhythm_id",
              rhythms.map((rhythm) => rhythm.id),
            )
            .gte("done_on", sinceDay),
        );
      },
    },

    days: (sinceDay) => listDayFrames(db, sinceDay),

    async saveSettings(settings) {
      check(
        await db
          .from("modules")
          .update({ settings: toJson(settings) })
          .eq("id", mod.id),
      );
    },
  };
  return ctx;
}
