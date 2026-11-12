"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useAddRhythm,
  useDropTask,
  useEditRhythm,
  useEditTask,
  useEditWorkItem,
} from "@/core/app/actions";
import { useRhythms, useSettings, useWorkItems } from "@/core/app/hooks";
import { readTiming, type TimingForm } from "@/core/contract/timing";
import { plannerSettings } from "@/core/planner";
import type { RhythmEdit, TaskEdit, WorkItemEdit } from "@/core/data/work";
import { dueAtEndOfDay } from "@/core/intake/parse";
import type { Candidate } from "@/core/today/select";
import {
  type Period,
  type Rhythm,
  type Task,
  TASK_MAX_MINUTES,
  TASK_MIN_MINUTES,
  type WorkItem,
} from "@/core/types";
import { dayKey } from "@/lib/date";
import { aiHints } from "../ai/AiMarks";
import { SplitButton } from "../ai/Splits";
import { EditDialog, type EditField, type EditValues } from "../EditDialog";
import { TimingSection, useTimingDraft } from "./TimingSection";

// Changing work by hand: a task, a work item or a rhythm. What the user sets here is the
// user's: a later proposal of a module (or, from Ç2, the AI) does not overwrite it.

const IMPORTANCE: EditField = {
  name: "importance",
  label: "Önem",
  type: "select",
  required: true,
  options: [
    { value: "1", label: "Düşük" },
    { value: "2", label: "Normal" },
    { value: "3", label: "Yüksek" },
    { value: "4", label: "Çok yüksek" },
  ],
};
const TITLE: EditField = { name: "title", label: "Ad", type: "text", required: true };
const DUE: EditField = { name: "due", label: "Son tarih", type: "date" };

const TASK_FIELDS: EditField[] = [
  TITLE,
  DUE,
  {
    name: "est_minutes",
    label: "Süre (dk)",
    type: "number",
    required: true,
    min: TASK_MIN_MINUTES,
    max: TASK_MAX_MINUTES,
    step: 5,
  },
  IMPORTANCE,
  {
    name: "status",
    label: "Durum",
    type: "select",
    required: true,
    options: [
      { value: "open", label: "Açık" },
      { value: "waiting", label: "Bekliyor" },
    ],
  },
  { name: "waiting_on", label: "Neyi bekliyor", type: "text" },
];

const ITEM_FIELDS: EditField[] = [
  TITLE,
  DUE,
  { name: "effort_total_minutes", label: "Toplam efor (dk)", type: "number", min: 5, step: 5 },
  {
    name: "session_minutes",
    label: "Oturum (dk)",
    type: "number",
    min: TASK_MIN_MINUTES,
    max: TASK_MAX_MINUTES,
    step: 5,
  },
  IMPORTANCE,
];

const RHYTHM_FIELDS: EditField[] = [
  TITLE,
  { name: "target_count", label: "Hedef", type: "number", required: true, min: 1, max: 31 },
  {
    name: "period",
    label: "Dönem",
    type: "select",
    required: true,
    options: [
      { value: "day", label: "Günde" },
      { value: "week", label: "Haftada" },
      { value: "month", label: "Ayda" },
    ],
  },
  {
    name: "est_minutes",
    label: "Süre (dk)",
    type: "number",
    required: true,
    min: TASK_MIN_MINUTES,
    max: TASK_MAX_MINUTES,
    step: 5,
  },
];

const dayOf = (instant: string | null) => (instant ? dayKey(new Date(instant)) : "");

/**
 * The form's "Zaman" section for a stored timing value: returns the section for EditDialog and
 * the value to save when it changed.
 */
function useTimingSection(
  stored: unknown,
  options: {
    form: (values: EditValues) => TimingForm;
    inherited?: unknown;
    note?: string | null;
  },
) {
  const state = useTimingDraft(stored);
  const settings = plannerSettings(useSettings().data);
  const section = (values: EditValues) => {
    const checked = state.check(options.form(values));
    return {
      valid: checked.valid,
      changed: checked.changed,
      node: (
        <TimingSection
          draft={state.draft}
          onChange={state.setDraft}
          form={options.form(values)}
          issues={checked.issues}
          timing={checked.timing}
          dayStart={settings.dayStart}
          finishLine={settings.finishLine}
          inherited={options.inherited === undefined ? undefined : readTiming(options.inherited)}
          note={options.note}
        />
      ),
    };
  };
  /** The value to save, or undefined when the section did not change. */
  const changedValue = (values: EditValues) => {
    const checked = state.check(options.form(values));
    return checked.changed ? checked.timing : undefined;
  };
  return { section, changedValue };
}

/** Where a work item's or rhythm's constraint came from, said once above the section. */
function sourceNote(provenance: unknown, aiReason?: string): string | null {
  const sources = Object.entries((provenance ?? {}) as Record<string, string>)
    .filter(([key]) => key.startsWith("timing."))
    .map(([, source]) => source);
  if (sources.includes("module"))
    return "Modülün ayarından geliyor; değiştirdiğin alan senin olur.";
  if (aiReason) return `Yapay zeka koydu: ${aiReason}`;
  return null;
}
const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value));

/** The pencil on a row of work: opens the form that fits what the row is. */
export function EditWorkButton({ candidate }: { candidate: Candidate }) {
  const [open, setOpen] = useState(false);
  const rhythms = useRhythms();
  const rhythm =
    candidate.type === "rhythm" ? rhythms.data?.find((row) => row.id === candidate.id) : undefined;
  const close = () => setOpen(false);

  return (
    <>
      <Button
        variant="ghost"
        className="size-11 md:size-9"
        aria-label={`Düzenle: ${candidate.title}`}
        title="Düzenle"
        onClick={() => setOpen(true)}
      >
        <Pencil aria-hidden />
      </Button>
      {open && candidate.task ? <TaskEditor task={candidate.task} onClose={close} /> : null}
      {open && candidate.type === "item" && candidate.item ? (
        <ItemEditor item={candidate.item} onClose={close} />
      ) : null}
      {open && rhythm ? <RhythmEditor rhythm={rhythm} onClose={close} /> : null}
    </>
  );
}

function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const edit = useEditTask();
  const drop = useDropTask();
  const items = useWorkItems();
  const item = task.work_item_id
    ? items.data?.find((row) => row.id === task.work_item_id)
    : undefined;
  const timing = useTimingSection(task.timing, {
    form: () => ({ kind: "task" }),
    // A sitting without its own constraint follows its item's.
    inherited: task.work_item_id ? (item?.timing ?? null) : undefined,
    note: aiHints(task, { timing: "timing" }).timing
      ? `Yapay zeka koydu: ${aiHints(task, { timing: "timing" }).timing}`
      : null,
  });
  const initial: EditValues = {
    title: task.title,
    due: dayOf(task.due_at),
    est_minutes: String(task.est_minutes),
    importance: String(task.importance),
    status: task.status === "waiting" ? "waiting" : "open",
    waiting_on: task.waiting_on ?? "",
  };

  return (
    <EditDialog
      title="İşi düzenle"
      fields={TASK_FIELDS}
      initial={initial}
      hints={aiHints(task, { due_at: "due", est_minutes: "est_minutes", importance: "importance" })}
      section={timing.section}
      onClose={onClose}
      onSave={(changed, values) => {
        const patch: TaskEdit = {};
        const nextTiming = timing.changedValue(values);
        if (nextTiming !== undefined) patch.timing = nextTiming;
        if ("title" in changed) patch.title = changed.title.trim();
        if ("due" in changed) patch.due_at = changed.due ? dueAtEndOfDay(changed.due) : null;
        if ("est_minutes" in changed) patch.est_minutes = Number(changed.est_minutes);
        if ("importance" in changed) patch.importance = Number(changed.importance);
        if ("status" in changed) patch.status = changed.status === "waiting" ? "waiting" : "todo";
        if ("waiting_on" in changed) patch.waiting_on = changed.waiting_on.trim() || null;
        edit.mutate({ id: task.id, patch });
      }}
      extra={
        <Button
          type="button"
          variant="outline"
          className="h-11 md:h-9"
          onClick={() => {
            drop.mutate(task.id);
            onClose();
          }}
        >
          Bırak
        </Button>
      }
    />
  );
}

function ItemEditor({ item, onClose }: { item: WorkItem; onClose: () => void }) {
  const edit = useEditWorkItem();
  const timing = useTimingSection(item.timing, {
    form: () => ({ kind: "deadline" }),
    note: sourceNote(item.provenance, aiHints(item, { timing: "timing" }).timing),
  });
  const initial: EditValues = {
    title: item.title,
    due: dayOf(item.due_at),
    effort_total_minutes:
      item.effort_total_minutes === null ? "" : String(item.effort_total_minutes),
    session_minutes: item.session_minutes === null ? "" : String(item.session_minutes),
    importance: String(item.importance),
  };

  return (
    <EditDialog
      title="İş kalemini düzenle"
      fields={ITEM_FIELDS}
      initial={initial}
      hints={aiHints(item, {
        due_at: "due",
        effort_total_minutes: "effort_total_minutes",
        session_minutes: "session_minutes",
        importance: "importance",
      })}
      extra={<SplitButton item={item} onDone={onClose} />}
      section={timing.section}
      onClose={onClose}
      onSave={(changed, values) => {
        const patch: WorkItemEdit = {};
        const nextTiming = timing.changedValue(values);
        if (nextTiming !== undefined) patch.timing = nextTiming;
        if ("title" in changed) patch.title = changed.title.trim();
        if ("due" in changed) patch.due_at = changed.due ? dueAtEndOfDay(changed.due) : null;
        if ("effort_total_minutes" in changed) {
          patch.effort_total_minutes = numberOrNull(changed.effort_total_minutes);
        }
        if ("session_minutes" in changed) {
          patch.session_minutes = numberOrNull(changed.session_minutes);
        }
        if ("importance" in changed) patch.importance = Number(changed.importance);
        edit.mutate({ id: item.id, patch });
      }}
    />
  );
}

function rhythmPatch(changed: EditValues): RhythmEdit {
  const patch: RhythmEdit = {};
  if ("title" in changed) patch.title = changed.title.trim();
  if ("target_count" in changed) patch.target_count = Number(changed.target_count);
  if ("period" in changed) patch.period = changed.period as Period;
  if ("est_minutes" in changed) patch.est_minutes = Number(changed.est_minutes);
  return patch;
}

function RhythmEditor({ rhythm, onClose }: { rhythm: Rhythm; onClose: () => void }) {
  const edit = useEditRhythm();
  // The rest days must fit the target and period being typed, not only the stored ones.
  const timing = useTimingSection(rhythm.timing, {
    form: (values) => ({
      kind: "recurrence",
      count: Number(values.target_count) || rhythm.target_count,
      period: (values.period as Period) || rhythm.period,
    }),
    note: sourceNote(rhythm.provenance),
  });
  const initial: EditValues = {
    title: rhythm.title,
    target_count: String(rhythm.target_count),
    period: rhythm.period,
    est_minutes: String(rhythm.est_minutes),
  };

  return (
    <EditDialog
      title="Ritmi düzenle"
      fields={RHYTHM_FIELDS}
      initial={initial}
      onClose={onClose}
      section={timing.section}
      onSave={(changed, values) => {
        const patch = rhythmPatch(changed);
        const nextTiming = timing.changedValue(values);
        if (nextTiming !== undefined) patch.timing = nextTiming;
        edit.mutate({ id: rhythm.id, patch });
      }}
      extra={
        <Button
          type="button"
          variant="outline"
          className="h-11 md:h-9"
          onClick={() => {
            edit.mutate({ id: rhythm.id, patch: { active: false } });
            onClose();
          }}
        >
          Durdur
        </Button>
      }
    />
  );
}

/** "Ritim ekle": a repeated target the user sets by hand for a module. */
export function AddRhythmButton({ moduleId }: { moduleId: string }) {
  const [open, setOpen] = useState(false);
  const add = useAddRhythm();
  return (
    <>
      <Button variant="outline" className="h-11 md:h-9" onClick={() => setOpen(true)}>
        Ritim ekle
      </Button>
      {open ? (
        <EditDialog
          title="Yeni ritim"
          fields={RHYTHM_FIELDS}
          initial={{ title: "", target_count: "1", period: "week", est_minutes: "15" }}
          saveLabel="Ekle"
          onClose={() => setOpen(false)}
          onSave={(_changed, values) =>
            add.mutate({
              module_id: moduleId,
              title: values.title.trim(),
              target_count: Number(values.target_count),
              period: values.period as Period,
              est_minutes: Number(values.est_minutes),
            })
          }
        />
      ) : null}
    </>
  );
}
