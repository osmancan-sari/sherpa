import type { ModuleRegistry } from "@/core/contract/types";
import { type Db, type ModuleRow, unwrap } from "@/core/types";
import type { AiKind } from "../types";

// What the calls are told besides their own input: the modules, finished work that looks
// alike, and the user's corrections. Small on purpose (rule 7: no call sees the whole database).

/** Lower-case words of three letters or more, for a rough likeness between titles. */
export function words(text: string): Set<string> {
  return new Set(
    text
      .toLocaleLowerCase("tr")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3),
  );
}

function likeness(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared;
}

/** Minutes really spent per task, from its finished sessions. */
async function spentByTask(db: Db, taskIds: string[]): Promise<Map<string, number>> {
  const spent = new Map<string, number>();
  if (taskIds.length === 0) return spent;
  const sessions = unwrap(
    await db
      .from("sessions")
      .select("task_id, started_at, ended_at")
      .in("task_id", taskIds)
      .not("ended_at", "is", null),
  );
  for (const session of sessions) {
    if (!session.task_id || !session.ended_at) continue;
    const minutes = (Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60_000;
    spent.set(session.task_id, (spent.get(session.task_id) ?? 0) + minutes);
  }
  return spent;
}

/**
 * Up to `limit` finished tasks whose titles share words with the text, with the minutes they
 * really took (the sessions' time, or the estimate when no session was measured).
 */
export async function similarFinishedTasks(
  db: Db,
  text: string,
  slugById: Map<string, string>,
  limit = 5,
): Promise<{ title: string; module: string | null; minutes: number }[]> {
  const target = words(text);
  if (target.size === 0) return [];
  const done = unwrap(
    await db
      .from("tasks")
      .select("id, title, module_id, est_minutes, done_at")
      .eq("status", "done")
      .order("done_at", { ascending: false })
      .limit(300),
  );
  const ranked = done
    .map((task) => ({ task, score: likeness(target, words(task.title)) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ task }) => task);
  const spent = await spentByTask(
    db,
    ranked.map((task) => task.id),
  );
  return ranked.map((task) => ({
    title: task.title,
    module: task.module_id ? (slugById.get(task.module_id) ?? null) : null,
    minutes: Math.round(spent.get(task.id) ?? task.est_minutes),
  }));
}

/** The last finished work items of a module: what was estimated and what was really spent. */
export async function finishedItemsOfModule(
  db: Db,
  moduleId: string,
  limit = 8,
): Promise<{ title: string; estimated: number | null; spent: number }[]> {
  const items = unwrap(
    await db
      .from("work_items")
      .select("id, title, effort_total_minutes")
      .eq("module_id", moduleId)
      .eq("status", "done")
      .order("updated_at", { ascending: false })
      .limit(limit),
  );
  if (items.length === 0) return [];
  const tasks = unwrap(
    await db
      .from("tasks")
      .select("id, work_item_id")
      .in(
        "work_item_id",
        items.map((item) => item.id),
      ),
  );
  const spent = await spentByTask(
    db,
    tasks.map((task) => task.id),
  );
  return items.map((item) => ({
    title: item.title,
    estimated: item.effort_total_minutes,
    spent: Math.round(
      tasks
        .filter((task) => task.work_item_id === item.id)
        .reduce((sum, task) => sum + (spent.get(task.id) ?? 0), 0),
    ),
  }));
}

/**
 * The user's last corrections of a call's answers: at most `perModule` for each module and
 * `total` in all, newest first (rule 8).
 */
export async function recentCorrections(
  db: Db,
  kind: AiKind,
  options: { moduleSlug?: string; perModule?: number; total?: number } = {},
): Promise<{ module: string; input: string; ai: unknown; user: unknown }[]> {
  const perModule = options.perModule ?? 10;
  const total = options.total ?? 20;
  let query = db
    .from("ai_feedback")
    .select("module_slug, input_summary, ai_value, user_value")
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(total * 3);
  if (options.moduleSlug) query = query.eq("module_slug", options.moduleSlug);
  const rows = unwrap(await query);

  const counts = new Map<string, number>();
  const picked: { module: string; input: string; ai: unknown; user: unknown }[] = [];
  for (const row of rows) {
    const count = counts.get(row.module_slug) ?? 0;
    if (count >= perModule || picked.length >= total) continue;
    counts.set(row.module_slug, count + 1);
    picked.push({
      module: row.module_slug,
      input: row.input_summary,
      ai: row.ai_value,
      user: row.user_value,
    });
  }
  return picked;
}

export type CatalogModule = {
  row: ModuleRow;
  slug: string;
  name: string;
  area: string | null;
  intake: { label: string; examples: string[] }[];
};

/** The active modules and what they take, for routing. A module without code has no intake. */
export async function moduleCatalog(db: Db, registry: ModuleRegistry): Promise<CatalogModule[]> {
  const rows = unwrap(
    await db.from("modules").select("*").eq("status", "active").order("created_at"),
  );
  return rows.map((row) => {
    const definition = registry.get(row.slug);
    return {
      row,
      slug: row.slug,
      name: row.name,
      area: definition?.area?.name ?? null,
      intake: (definition?.intake ?? []).map((type) => ({
        label: type.label,
        examples: type.examples,
      })),
    };
  });
}
