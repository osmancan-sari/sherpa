"use client";

import type { FrameSettings } from "@/core/contract/frame";
import type { BedUndo } from "@/core/contract/types";
import { recordBed, recordWake, saveDayFrame, setExpected, undoSceneBed } from "@/core/data/frame";
import { tellBedUndone, tellDayClosed, tellDayStarted } from "@/core/data/session-events";
import { useRegistry } from "./CoreProvider";
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
      bed_session_id: null,
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
  const registry = useRegistry();
  return useCoreMutation({
    mutate: async (db, args: { date: string; at: Date }) => {
      const row = await recordWake(db, args.date, args.at);
      await tellDayStarted(
        { db, registry },
        { date: args.date, wokeAt: row.woke_at ?? args.at.toISOString(), estimated: false },
      );
      return row;
    },
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
  const registry = useRegistry();
  return useCoreMutation({
    mutate: async (db, args: { date: string; at: Date; sessionId?: string | null }) => {
      const row = await recordBed(db, args.date, args.at, args.sessionId ?? null);
      await tellDayClosed(
        { db, registry },
        { date: args.date, bedAt: row.bed_at ?? args.at.toISOString() },
      );
      return row;
    },
    optimistic: ({ date, at, sessionId }) => [
      {
        key: keys.days,
        update: patchDay(date, { bed_at: at.toISOString(), bed_session_id: sessionId ?? null }),
      },
    ],
    invalidate: [keys.days],
    onError,
  });
}

/**
 * Rutin 1: "Geri al" on a scene's bedtime (docs/06-modul-sozlesmesi.md, "Diziler" rule 6): within
 * 10 minutes the bedtime is gone and the session runs again; the modules hear it. The answer says
 * whether it happened ("expired", "changed": nothing changed).
 */
export function useUndoBed() {
  const onError = useFailureNotice();
  const registry = useRegistry();
  return useCoreMutation({
    mutate: async (db, args: { date: string; sessionId: string }): Promise<BedUndo> => {
      const result = await undoSceneBed(db, args.sessionId);
      if (result === "undone") await tellBedUndone({ db, registry }, args);
      return result;
    },
    // Not optimistic: whether it can be taken back is the database's answer (10 minutes, nothing
    // written since); the screen waits for it. The module's own rows come back with Realtime.
    invalidate: [
      keys.days,
      keys.openSession,
      keys.sessions,
      keys.rhythmLogs,
      keys.tasks,
      keys.workItems,
    ],
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
