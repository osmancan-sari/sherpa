import type { ModuleContext } from "@/core/contract/types";
import type { Tables } from "@/lib/supabase/database.types";

// The module's own table. Nobody else reads or writes it (docs/06-modul-sozlesmesi.md).

export type DenemeItem = Tables<"deneme_items">;
/**
 * "konu" (Ç3e): a topic; it proposes no work, it is one of the module's facets. "rutin" (Ç3f): a
 * daily routine in the waking's or the bedtime's chain.
 */
export type DenemeKind =
  "hedef" | "aliskanlik" | "etkinlik" | "antrenman" | "odak" | "konu" | "rutin";

export const SOURCE_TYPE = "deneme.item";

export const KIND_LABEL: Record<DenemeKind, string> = {
  hedef: "Hedef",
  aliskanlik: "Alışkanlık",
  etkinlik: "Etkinlik",
  antrenman: "Antrenman",
  odak: "Odak",
  konu: "Konu",
  rutin: "Rutin",
};

function unwrap<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null || result.data === undefined) throw new Error("no data returned");
  return result.data;
}

export async function listItems(ctx: ModuleContext): Promise<DenemeItem[]> {
  return unwrap(await ctx.db.from("deneme_items").select("*").order("created_at"));
}

export async function getItem(ctx: ModuleContext, id: string): Promise<DenemeItem | null> {
  const { data, error } = await ctx.db.from("deneme_items").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export type NewItem = {
  title: string;
  kind?: DenemeKind;
  due_on?: string | null;
  minutes?: number | null;
  /** Ç3e: one of the fixed facets ("sabah", "aksam"). */
  facet?: string | null;
  /** Ç3f: a routine's place in its chain (1–99, on the order axis the modules share). */
  chain_order?: number | null;
};

export async function insertItem(ctx: ModuleContext, item: NewItem): Promise<DenemeItem> {
  return unwrap(
    await ctx.db
      .from("deneme_items")
      .insert({
        title: item.title.trim(),
        kind: item.kind ?? "hedef",
        due_on: item.due_on ?? null,
        minutes: item.minutes ?? null,
        facet: item.facet ?? null,
        chain_order: item.chain_order ?? null,
      })
      .select()
      .single(),
  );
}

export async function updateItem(
  ctx: ModuleContext,
  id: string,
  patch: Partial<
    Pick<
      DenemeItem,
      "title" | "due_on" | "minutes" | "done" | "spent_minutes" | "feedback" | "scene_step"
    >
  >,
): Promise<DenemeItem> {
  return unwrap(await ctx.db.from("deneme_items").update(patch).eq("id", id).select().single());
}

export async function deleteItem(ctx: ModuleContext, id: string): Promise<void> {
  const { error } = await ctx.db.from("deneme_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
