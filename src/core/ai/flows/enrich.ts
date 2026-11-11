import { format } from "date-fns";
import { tr } from "date-fns/locale";
import type { ModuleRegistry } from "@/core/contract/types";
import { parseQuickText } from "@/core/intake/parse";
import { type Db, toJson, unwrap } from "@/core/types";
import { dayKey, inIstanbul } from "@/lib/date";
import { type EnrichInput, enrichSpec } from "../calls/enrich";
import { type AiDeps, runAiCall } from "../gateway";
import { moduleCatalog, recentCorrections, similarFinishedTasks } from "./context";
import { applyEnrichment, type EnrichOutcome, type EnrichSuggestion, isSure } from "./enrich-apply";

// `enrich` on the server: an inbox entry quick add has just saved → the AI's reading of it →
// applied (sure), kept as a card to confirm (not sure), or left as it is (no answer).

export function weekdayName(now: Date): string {
  return format(inIstanbul(now), "EEEE", { locale: tr }).toLocaleLowerCase("tr");
}

export async function buildEnrichInput(
  db: Db,
  registry: ModuleRegistry,
  text: string,
  now: Date,
): Promise<{ input: EnrichInput; moduleIds: Map<string, string> }> {
  const catalog = await moduleCatalog(db, registry);
  const slugById = new Map(catalog.map((mod) => [mod.row.id, mod.slug]));
  return {
    input: {
      text,
      today: dayKey(now),
      weekday: weekdayName(now),
      modules: catalog.map(({ slug, name, area, intake }) => ({ slug, name, area, intake })),
      similar: await similarFinishedTasks(db, text, slugById),
      corrections: await recentCorrections(db, "enrich"),
    },
    moduleIds: new Map(catalog.map((mod) => [mod.slug, mod.row.id])),
  };
}

/** Runs `enrich` for a new inbox entry and applies, keeps or leaves the answer. */
export async function enrichEntry(
  deps: AiDeps,
  registry: ModuleRegistry,
  entryId: string,
  now: Date,
): Promise<EnrichOutcome> {
  const { db } = deps;
  const entry = (await db.from("inbox_entries").select("*").eq("id", entryId).maybeSingle()).data;
  if (!entry || entry.status !== "new") return { status: "gone" };

  const { input, moduleIds } = await buildEnrichInput(db, registry, entry.raw_text, now);
  const result = await runAiCall(deps, enrichSpec, input, {
    subject: { type: "inbox_entry", id: entry.id },
  });
  if (result.status !== "ok") return { status: result.status, reason: result.reason };

  const parsed = parseQuickText(entry.raw_text, now);
  const output = result.output;

  if (!isSure(output, moduleIds)) {
    const suggestion: EnrichSuggestion = {
      call_id: result.callId,
      model: result.model,
      output,
      parsed,
    };
    const kept = unwrap(
      await db
        .from("inbox_entries")
        .update({ status: "needs_confirm", suggestion: toJson(suggestion) })
        .eq("id", entry.id)
        .eq("status", "new")
        .select("id"),
    );
    return kept.length > 0 ? { status: "needs_confirm", entryId: entry.id } : { status: "gone" };
  }

  const slug = output.module.value!;
  return applyEnrichment(db, {
    entry,
    output,
    parsed,
    callId: result.callId,
    model: result.model,
    moduleId: moduleIds.get(slug)!,
    moduleSlug: slug,
    now,
  });
}
