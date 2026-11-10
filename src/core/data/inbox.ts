import {
  check,
  type Db,
  type InboxEntry,
  type Prompt,
  type Settings,
  unwrap,
  toJson,
} from "@/core/types";

// Inbox: raw entries that have not been routed yet. Entries are never deleted; their status
// changes (docs/03-veri-modeli.md).

/** Entries waiting to be routed, oldest first. */
export async function listInbox(db: Db): Promise<InboxEntry[]> {
  return unwrap(
    await db
      .from("inbox_entries")
      .select("*")
      .in("status", ["new", "needs_confirm"])
      .order("created_at"),
  );
}

export async function addInboxEntry(db: Db, rawText: string, id?: string): Promise<InboxEntry> {
  return unwrap(
    await db.from("inbox_entries").insert({ id, raw_text: rawText.trim() }).select().single(),
  );
}

/** What an entry became: the kinds and ids of the records created from it. */
export type RoutedTo = { type: string; id?: string; module?: string }[];

export async function markRouted(db: Db, id: string, routed: RoutedTo): Promise<void> {
  check(
    await db
      .from("inbox_entries")
      .update({
        status: "routed",
        routed: toJson(routed),
        routed_at: new Date().toISOString(),
      })
      .eq("id", id),
  );
}

/** "Sil" in the inbox: the entry leaves the list but stays in the data. */
export async function dismissEntry(db: Db, id: string): Promise<void> {
  check(await db.from("inbox_entries").update({ status: "dismissed" }).eq("id", id));
}

// --- Prompts: one question after an event ------------------------------------------------------

/** Pending questions that are due, oldest first. The screen shows only the first. */
export async function listDuePrompts(db: Db, now: Date): Promise<Prompt[]> {
  return unwrap(
    await db
      .from("prompts")
      .select("*")
      .eq("status", "pending")
      .lte("ask_after", now.toISOString())
      .order("ask_after"),
  );
}

/** Records the answer. Returns null when the question was not pending any more. */
export async function answerPrompt(db: Db, id: string, value: string): Promise<Prompt | null> {
  const { data, error } = await db
    .from("prompts")
    .update({ status: "answered", answer: { value }, answered_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** "Sonra": the question comes back in a few hours. */
export async function snoozePrompt(db: Db, id: string, now: Date, hours = 3): Promise<void> {
  const askAfter = new Date(now.getTime() + hours * 3_600_000).toISOString();
  check(await db.from("prompts").update({ ask_after: askAfter }).eq("id", id));
}

// --- Settings ----------------------------------------------------------------------------------

/** The user's settings row, or null when everything is still at its default. */
export async function getSettings(db: Db): Promise<Settings | null> {
  const { data, error } = await db.from("settings").select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
