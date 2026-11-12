"use client";

import type { FrameSettings } from "@/core/contract/frame";
import { recordBed, recordWake, saveDayFrame, setExpected } from "@/core/data/frame";
import type { DayRow } from "@/core/types";
import { SAVE_FAILED, useNotify } from "@/core/ui/Notices";
import { keys, useCoreMutation } from "./hooks";

// The day's frame on the screens (docs/05-arayuz.md, "Günün çerçevesi"): "Uyandım",
// "Yatıyorum", one day's own waking or bedtime, the settings. Each shows at once.

function useFailureNotice() {
  const notify = useNotify();
  return () => notify(SAVE_FAILED);
}

const stamp = () => new Date().toISOString();

/** The days list with one day's row changed (or added) at once. */
function patchDay(date: string, patch: Partial<DayRow>) {
  return (current: unknown) => {
    const rows = (current as DayRow[] | undefined) ?? [];
    if (rows.some((row) => row.date === date)) {
      return rows.map((row) => (row.date === date ? { ...row, ...patch } : row));
    }
    const now = stamp();
    const draft: DayRow = {
      id: `pending-${date}`,
      user_id: "",
      date,
      day_type: null,
      life_mode: "normal",
      started_at: null,
      finish_line: null,
      top3: [],
      plan: null,
      plan_source: null,
      plan_reasons: null,
      closed_at: null,
      closing_note: null,
      woke_at: null,
      woke_estimated: false,
      bed_at: null,
      planned_wake: null,
      planned_bed: null,
      expected_wake: null,
      expected_bed: null,
      created_at: now,
      updated_at: now,
      ...patch,
    };
    return [...rows, draft];
  };
}

/** "Uyandım", or "Biraz önce": the day's waking. */
export function useRecordWake() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, args: { date: string; at: Date }) => recordWake(db, args.date, args.at),
    optimistic: ({ date, at }) => [
      {
        key: keys.days,
        update: patchDay(date, { woke_at: at.toISOString(), woke_estimated: false }),
      },
    ],
    invalidate: [keys.days],
    onError,
  });
}

/** "Yatıyorum": tonight's bedtime; the screen goes to night. */
export function useRecordBed() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, args: { date: string; at: Date }) => recordBed(db, args.date, args.at),
    optimistic: ({ date, at }) => [
      { key: keys.days, update: patchDay(date, { bed_at: at.toISOString() }) },
    ],
    invalidate: [keys.days],
    onError,
  });
}

/** "Bu gece geç yatacağım" (`bed` on tonight) or "Yarın erken kalkacağım" (`wake` on tomorrow). */
export function useSetExpected() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, args: { date: string; wake?: string | null; bed?: string | null }) =>
      setExpected(db, args.date, args),
    optimistic: ({ date, wake, bed }) => [
      {
        key: keys.days,
        update: patchDay(date, {
          ...(wake !== undefined ? { expected_wake: wake ? `${wake}:00` : null } : {}),
          ...(bed !== undefined ? { expected_bed: bed ? `${bed}:00` : null } : {}),
        }),
      },
    ],
    invalidate: [keys.days, keys.weekPlans],
    onError,
  });
}

/** Settings → Günün çerçevesi. */
export function useSaveDayFrame() {
  const onError = useFailureNotice();
  return useCoreMutation({
    mutate: (db, frame: FrameSettings | null) => saveDayFrame(db, frame),
    invalidate: [keys.settings],
    onError,
  });
}
