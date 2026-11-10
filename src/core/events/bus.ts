import type { ModuleRegistry } from "@/core/contract/types";
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
}): Promise<EmitResult> {
  const { db, registry, type, moduleSlug, now } = input;
  const event = unwrap(
    await db
      .from("events")
      .insert({ type, module_slug: moduleSlug, payload: toJson(input.payload ?? {}) })
      .select()
      .single(),
  );

  const listeners = registry.list.filter((def) => def.on?.[type]);
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
      await def.on![type](event, createModuleContext({ db, registry, module: row, now }));
    } catch (error) {
      failures.push({ module: def.slug, error });
    }
  }
  return { event, failures };
}
