import type { ModuleRegistry, ProposalResult } from "@/core/contract/types";
import { createModuleContext } from "@/core/data/context";
import { type AppEvent, type Db, unwrap, toJson } from "@/core/types";

// Events: how modules talk to each other without importing each other. An event is written to
// the `events` table (append-only) and handed, right where it was published, to every active
// module that listens for its type. A listener that fails does not stop the others or the
// publisher; the failure is reported back.

/** Events the core itself publishes. */
export const CORE_EVENTS = {
  /** A module's question was answered: { module, kind, subject_type, subject_id, value }. */
  promptAnswered: "core.prompt_answered",
  /** Ç3c: a session started; to the work's module only. */
  sessionStarted: "core.session_started",
  /** Ç3c: a session ended (done, stopped, deferred, stuck, unanswered); to the work's module only. */
  sessionEnded: "core.session_ended",
  /** Ç3c: the day's waking was recorded; to every active module. */
  dayStarted: "core.day_started",
  /** Ç3c: tonight's bedtime was recorded; to every active module. */
  dayClosed: "core.day_closed",
  /** Rutin 1: a scene's bedtime was taken back ("Geri al"): { date }; to every active module. */
  bedUndone: "core.bed_undone",
  /** Ç3d: a context came from outside (the ingest endpoint `core/context`); to every module. */
  contextReported: "core.context_reported",
} as const;

export type EmitResult = { event: AppEvent; failures: { module: string; error: unknown }[] };

export async function emitEvent(input: {
  db: Db;
  registry: ModuleRegistry;
  type: string;
  payload?: Record<string, unknown>;
  /** The publishing module; null for the core's own events. */
  moduleSlug: string | null;
  now?: () => Date;
  /**
   * Only this module hears it (its slug); null: written, heard by nobody. Left out: every
   * listening module. A module's events always go to everyone listening; the core's session
   * events go to the work's own module only (docs/06-modul-sozlesmesi.md, "Olaylar").
   */
  to?: string | null;
  /** Handed to the listeners' contexts (see createModuleContext). */
  onProposed?: (result: ProposalResult) => Promise<void>;
}): Promise<EmitResult> {
  const { db, registry, type, moduleSlug, now, to, onProposed } = input;
  const event = unwrap(
    await db
      .from("events")
      .insert({ type, module_slug: moduleSlug, payload: toJson(input.payload ?? {}) })
      .select()
      .single(),
  );

  const listeners = registry.list.filter(
    (def) => def.on?.[type] && (to === undefined || def.slug === to),
  );
  const failures: EmitResult["failures"] = [];
  if (listeners.length === 0) return { event, failures };

  const rows = unwrap(
    await db
      .from("modules")
      .select("*")
      .in(
        "slug",
        listeners.map((def) => def.slug),
      )
      .eq("status", "active"),
  );
  for (const def of listeners) {
    const row = rows.find((candidate) => candidate.slug === def.slug);
    // A module that is not switched on does not react to anything.
    if (!row) continue;
    try {
      await def.on![type](
        event,
        createModuleContext({ db, registry, module: row, now, onProposed }),
      );
    } catch (error) {
      failures.push({ module: def.slug, error });
    }
  }
  return { event, failures };
}
