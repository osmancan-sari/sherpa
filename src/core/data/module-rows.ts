import type { ModuleDefinition, ModuleRegistry } from "@/core/contract/types";
import { check, type Db, type ModuleRow, type ModuleStatus, unwrap, toJson } from "@/core/types";
import { createModuleContext } from "./context";

// Modules as rows: which ones the user has switched on, and their life cycle.
// The registry says what a module can do; the row says whether it is in use and how it is set.

export async function listModules(db: Db): Promise<ModuleRow[]> {
  return unwrap(await db.from("modules").select("*").order("sort").order("created_at"));
}

export async function getModule(db: Db, slug: string): Promise<ModuleRow | null> {
  const { data, error } = await db.from("modules").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function ensureArea(db: Db, area: { slug: string; name: string }): Promise<string> {
  const row = unwrap(
    await db
      .from("areas")
      .upsert({ slug: area.slug, name: area.name }, { onConflict: "user_id,slug" })
      .select("id")
      .single(),
  );
  return row.id;
}

/**
 * Switches a module on: creates its row from the definition the first time, or brings a paused
 * or archived one back. Then lets the module set itself up (`onActivate`).
 */
export async function activateModule(
  db: Db,
  registry: ModuleRegistry,
  def: ModuleDefinition,
): Promise<ModuleRow> {
  const existing = await getModule(db, def.slug);
  let row: ModuleRow;
  if (existing) {
    row = unwrap(
      await db.from("modules").update({ status: "active" }).eq("id", existing.id).select().single(),
    );
  } else {
    row = unwrap(
      await db
        .from("modules")
        .insert({
          slug: def.slug,
          name: def.name,
          kind: def.kind,
          color: def.color,
          area_id: def.area ? await ensureArea(db, def.area) : null,
          mode_behavior: toJson(def.modeBehavior),
        })
        .select()
        .single(),
    );
  }
  if (existing?.status !== "active") {
    await def.onActivate?.(createModuleContext({ db, registry, module: row }));
  }
  return row;
}

/** Pause and resume. A paused module keeps its data; its work is simply not offered. */
export async function setModuleStatus(
  db: Db,
  id: string,
  status: Exclude<ModuleStatus, "archived">,
): Promise<ModuleRow> {
  return unwrap(await db.from("modules").update({ status }).eq("id", id).select().single());
}

/**
 * Archives a module: open work is dropped, series close, rhythms go quiet, coming blocks are
 * cancelled. Nothing is deleted. The module gets a last word (`onArchive`).
 */
export async function archiveModule(
  db: Db,
  registry: ModuleRegistry,
  mod: ModuleRow,
): Promise<ModuleRow> {
  const archived = unwrap(await db.rpc("archive_module", { p_module_id: mod.id }));
  const def = registry.get(mod.slug);
  await def?.onArchive?.(createModuleContext({ db, registry, module: archived }));
  return archived;
}

export async function saveModuleSettings(
  db: Db,
  id: string,
  settings: Record<string, unknown>,
): Promise<void> {
  check(
    await db
      .from("modules")
      .update({ settings: toJson(settings) })
      .eq("id", id),
  );
}

export type ModuleEdit = Partial<
  Pick<ModuleRow, "name" | "color" | "weight" | "weekly_floor_minutes" | "sort">
>;

export async function updateModule(db: Db, id: string, edit: ModuleEdit): Promise<ModuleRow> {
  return unwrap(await db.from("modules").update(edit).eq("id", id).select().single());
}
