import type { Block } from "@/core/types";
import type { ModuleBlockView, ModuleDefinition } from "./types";

// Okul çekirdek A (docs/06-modul-sozlesmesi.md, "Sabit blok görünümü"): which fixed blocks open
// their module's view. Pure: the screens ask it for every block they draw.

/** The block came from a module's proposal (its key): not one the user added by hand. */
export function proposedBlock(block: Pick<Block, "key" | "module_id">): boolean {
  return block.key !== null && block.module_id !== null;
}

/**
 * The view this block opens: its module's `ui.blockView` when the module proposed it, the module
 * is active and its `when` says yes (one that throws: no). Null otherwise; the block then stays as
 * it was.
 */
export function blockViewOf(
  block: Block,
  modules: ReadonlyMap<
    string,
    { row: { status: string }; definition?: Pick<ModuleDefinition, "ui"> | undefined }
  >,
): ModuleBlockView | null {
  if (!proposedBlock(block) || block.status === "cancelled") return null;
  const mod = modules.get(block.module_id!);
  const view = mod?.definition?.ui.blockView;
  if (!mod || mod.row.status !== "active" || !view) return null;
  try {
    return !view.when || view.when(block) ? view : null;
  } catch {
    return null;
  }
}

/** Before, during or after the block's own hours. */
export function blockPhase(
  block: Pick<Block, "starts_at" | "ends_at">,
  now: Date,
): "before" | "during" | "after" {
  const time = now.getTime();
  if (time < Date.parse(block.starts_at)) return "before";
  return time < Date.parse(block.ends_at) ? "during" : "after";
}

/** The address that opens a block's view: Today with the block named. */
export const blockViewHref = (blockId: string) => `/?blok=${encodeURIComponent(blockId)}` as const;
