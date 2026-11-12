import type { ModuleContext, Outcome, WorkProposal } from "@/core/contract/types";
import type { AppEvent } from "@/core/types";
import { dayKey, END_OF_DAY, istanbulInstant } from "@/lib/date";
import {
  deleteItem,
  type DenemeItem,
  type DenemeKind,
  insertItem,
  type NewItem,
  SOURCE_TYPE,
  updateItem,
} from "./queries";

// The module's rules: what work it proposes for its records, and how it reacts to events.
// This is the code of the "Kurallar" section a real module has in docs/moduller/<slug>.md.

export const EVENTS = {
  itemAdded: "deneme.item_added",
  itemRemoved: "deneme.item_removed",
} as const;

export const FEEDBACK_PROMPT = "zorluk";

type Settings = {
  default_minutes?: number;
  added_count?: number;
  archived_on?: string;
  /** Ç3c: days the module heard begin, and the last of its sessions that ended. */
  days_started?: number;
  last_session?: { result: string; minutes: number };
};

export function settingsOf(ctx: ModuleContext): Settings {
  return (ctx.module.settings ?? {}) as Settings;
}

const keyOf = (item: Pick<DenemeItem, "id">) => `item:${item.id}`;

/** The gym: open 07:00–22:00, crowded on weekday evenings, best on weekend mornings, 20 minutes away. */
export const WORKOUT_TIMING = {
  windows: [{ from: "07:00", to: "22:00" }],
  prefer: [{ days: [6, 7], from: "10:00", to: "12:00" }],
  avoid: [{ days: [1, 2, 3, 4, 5], from: "18:00", to: "20:30" }],
  travel: { before: 20, after: 20 },
  rest_days: 1,
};

/**
 * The envelope for a record. The module states what it knows (the deadline, a length the user
 * typed) and leaves the rest empty: a goal without a length gets bounds, not a guess.
 */
export function proposalFor(item: DenemeItem, settings: Settings, now: Date): WorkProposal {
  const base = {
    schema: 1 as const,
    key: keyOf(item),
    source: { type: SOURCE_TYPE, id: item.id },
    title: item.title,
  };
  const kind = item.kind as DenemeKind;

  if (kind === "aliskanlik") {
    return {
      ...base,
      when: { recurrence: { count: 3, period: "week", floor: 1 } },
      effort: {
        session_minutes: Math.max(5, Math.min(item.minutes ?? settings.default_minutes ?? 15, 90)),
      },
      fit: { energy: "light" },
      meta: { kind },
    };
  }

  if (kind === "antrenman") {
    // A workout at the gym: every time constraint the envelope has (docs/03-veri-modeli.md,
    // "Zaman kısıtları"). A real module would build these from its settings (the gym's hours,
    // the way there); here they are fixed.
    return {
      ...base,
      when: { recurrence: { count: 3, period: "week", floor: 1 } },
      effort: { session_minutes: Math.max(5, Math.min(item.minutes ?? 60, 90)) },
      fit: { energy: "physical", context: "out" },
      timing: WORKOUT_TIMING,
      // The step scene knows a workout by it (src/modules/deneme/components/Scenes.tsx).
      meta: { kind },
    };
  }

  if (kind === "etkinlik") {
    // A fixed hour on its day: 10:00, for as long as the record says (an hour by default).
    const day = item.due_on ?? dayKey(now);
    const start = istanbulInstant(day, "10:00");
    const end = new Date(start.getTime() + (item.minutes ?? 60) * 60_000);
    return {
      ...base,
      when: { fixed: { starts_at: start.toISOString(), ends_at: end.toISOString() } },
    };
  }

  return {
    ...base,
    when: { due: item.due_on ? istanbulInstant(item.due_on, END_OF_DAY).toISOString() : null },
    // A known length is a fact; without one the core (later the AI) decides inside the bounds.
    effort: item.minutes
      ? { total_minutes: item.minutes, session_minutes: Math.min(item.minutes, 45) }
      : { bounds: { min: 30, max: 240 } },
    fit: { energy: "deep", context: "desk" },
    importance: 2,
    meta: { kind },
  };
}

/** Adds a record, proposes its work and tells whoever listens. */
export async function addItem(ctx: ModuleContext, input: NewItem): Promise<DenemeItem> {
  const item = await insertItem(ctx, input);
  await ctx.propose(proposalFor(item, settingsOf(ctx), ctx.now()));
  await ctx.emit(EVENTS.itemAdded, { id: item.id, title: item.title });
  return item;
}

/** The record changed: the same key is proposed again, and the core updates what it may. */
export async function changeItem(
  ctx: ModuleContext,
  id: string,
  patch: Partial<Pick<DenemeItem, "title" | "due_on" | "minutes">>,
): Promise<DenemeItem> {
  const item = await updateItem(ctx, id, patch);
  await ctx.propose(proposalFor(item, settingsOf(ctx), ctx.now()));
  return item;
}

/** The record is gone: its work is taken back. */
export async function removeItem(ctx: ModuleContext, id: string): Promise<void> {
  await ctx.withdraw(keyOf({ id }));
  await deleteItem(ctx, id);
  await ctx.emit(EVENTS.itemRemoved, { id });
}

/** The core reports what the proposed work cost: the record is closed and one question is asked. */
export async function onOutcome(outcome: Outcome, ctx: ModuleContext): Promise<void> {
  if (outcome.source.type !== SOURCE_TYPE || !outcome.source.id) return;
  const item = await updateItem(ctx, outcome.source.id, {
    done: outcome.result === "done",
    spent_minutes: outcome.spentMinutes,
  });
  if (outcome.result !== "done") return;
  await ctx.ask({
    kind: FEEDBACK_PROMPT,
    question: `“${item.title}” nasıldı?`,
    options: [
      { value: "kolay", label: "Kolay" },
      { value: "zor", label: "Zor" },
    ],
    subject: { type: SOURCE_TYPE, id: item.id },
  });
}

/** Event listeners. Modules never import each other; this is how they hear things. */
export const listeners: Record<string, (event: AppEvent, ctx: ModuleContext) => Promise<void>> = {
  // The module listens to its own event too: it keeps a count in its settings.
  [EVENTS.itemAdded]: async (_event, ctx) => {
    const settings = settingsOf(ctx);
    await ctx.saveSettings({ ...settings, added_count: (settings.added_count ?? 0) + 1 });
  },
  // Ç3c: a session of the module's own work started. A workout begins at its first step (the
  // step scene keeps its place in the record).
  "core.session_started": async (event, ctx) => {
    const source = (event.payload as { source?: { type?: string | null; id?: string | null } })
      .source;
    if (source?.type !== SOURCE_TYPE || !source.id) return;
    await updateItem(ctx, source.id, { scene_step: null });
  },
  // Ç3c: how the module's last session ended (done, stopped, deferred, stuck, unanswered).
  "core.session_ended": async (event, ctx) => {
    const payload = event.payload as { result?: string; minutes?: number };
    await ctx.saveSettings({
      ...settingsOf(ctx),
      last_session: { result: payload.result ?? "", minutes: payload.minutes ?? 0 },
    });
  },
  // Ç3c: every module hears the day begin; this one counts them.
  "core.day_started": async (_event, ctx) => {
    const settings = settingsOf(ctx);
    await ctx.saveSettings({ ...settings, days_started: (settings.days_started ?? 0) + 1 });
  },
  // The answer to the question asked in onOutcome.
  "core.prompt_answered": async (event, ctx) => {
    const payload = event.payload as {
      module?: string;
      kind?: string;
      subject_id?: string | null;
      value?: string;
    };
    if (payload.module !== ctx.module.slug || payload.kind !== FEEDBACK_PROMPT) return;
    if (!payload.subject_id || !payload.value) return;
    await updateItem(ctx, payload.subject_id, { feedback: payload.value });
  },
};
