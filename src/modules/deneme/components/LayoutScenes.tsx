"use client";

import { useEffect, useRef, useState } from "react";
import { useRefreshAll } from "@/core/app/actions";
import { useModuleQuery } from "@/core/app/hooks";
import type { SceneProps } from "@/core/contract/types";
import {
  type FlowPlan,
  type FlowState,
  FlowLayout,
  flowView,
  Panel,
  type PomodoroPlan,
  type PomodoroState,
  PomodoroLayout,
  ResumeNote,
  SessionEnd,
  SessionFile,
  SessionSections,
  token,
  useSessionEnd,
} from "@/core/ui/kit";
import { SAVE_FAILED, useNotify } from "@/core/ui/Notices";
import { type DenemeItem, getItem, updateItem } from "../queries";
import { sourceOf } from "../subject";

// Okul çekirdek A: two of the module's focused sittings on the kit's scene layouts
// (docs/06-modul-sozlesmesi.md, "Sahne yerleşimleri"). The layout's state lives in the record
// (`layout_state`), so a reload and the other device show the same round, break and time. The
// pomodoro tells the core its focus minutes (breaks out); the flow asks "Nerede kaldın?" on the
// way out (`beforeExit`, scene.ts) and shows the last sentence when the next sitting begins.

/** The method is the layout's input, the module's own setting; here fixed and short to try. */
export const POMODORO_PLAN: PomodoroPlan = { focusMinutes: 25, breakMinutes: 5, rounds: 2 };

/** The record behind the running work, its layout state kept in step with the screen. */
function useRecordState<T>(props: SceneProps) {
  const { subject, ctx } = props;
  const refreshAll = useRefreshAll();
  const notify = useNotify();
  const id = sourceOf(subject);
  const record = useModuleQuery(ctx.module, ["item", id], (moduleCtx) =>
    id ? getItem(moduleCtx, id) : Promise.resolve(null),
  );
  const stored = (record.data?.layout_state ?? null) as T | null;
  // What this screen just did, while the row still holds what it held then; once the row has
  // moved on (this write, or another device's), the row is the truth.
  const [local, setLocal] = useState<{ state: T; from: string } | null>(null);
  const storedKey = JSON.stringify(stored);
  const state = local && local.from === storedKey ? local.state : stored;
  const save = (next: T) => {
    setLocal({ state: next, from: storedKey });
    if (!id) return;
    updateItem(ctx, id, { layout_state: next as unknown as DenemeItem["layout_state"] })
      .then(() => refreshAll())
      .catch(() => notify(SAVE_FAILED));
  };
  return { record: record.data ?? null, state, save, loading: record.isLoading };
}

const subtitleOf = (props: SceneProps) =>
  [props.facet?.name ?? "Deneme", "sınama oturumu"].join(" · ");

/** Pomodoro: rounds and breaks; "Bitti" tells the core the focus minutes. */
export function PomodoroScene(props: SceneProps) {
  const { subject, session, device, controls, facet, strip } = props;
  const { state, save, loading } = useRecordState<PomodoroState>(props);
  const [ended, end] = useSessionEnd();
  const title = subject.kind === "task" ? subject.task.title : subject.rhythm.title;
  const color = facet?.color ?? token("color-swatch-teal");
  useEffect(() => strip(ended ? { hidden: true } : null), [strip, ended]);
  if (loading) return null;
  if (ended) return <SessionEnd />;
  return (
    <div className="flex flex-1 flex-col" data-testid="deneme-pomodoro">
      <PomodoroLayout
        device={device}
        plan={POMODORO_PLAN}
        state={state}
        startedAt={session.startedAt}
        sessionId={session.id}
        onChange={save}
        onFinish={(counted) => end(() => void controls.finish(counted))}
        color={color}
        title={title}
        subtitle={subtitleOf(props)}
        boxes={
          <SessionSections
            color={color}
            sections={[
              {
                key: "oku",
                title: "Oku: birinci bölüm",
                measure: "1 tur",
                state: "current",
                open: { label: "Aç", href: "/m/deneme" },
              },
              { key: "coz", title: "Çöz: sorular", measure: "1 tur", state: "next" },
            ]}
          />
        }
      />
    </div>
  );
}

/** Akış: work counts up, breaks count up and are no work; "Bitir" tells the worked minutes. */
export function FlowScene(props: SceneProps) {
  const { subject, session, device, controls, facet } = props;
  const { record, state, save, loading } = useRecordState<FlowState>(props);
  const title = subject.kind === "task" ? subject.task.title : subject.rhythm.title;
  const color = facet?.color ?? token("color-swatch-blue");
  const plan: FlowPlan = {
    plannedMinutes: subject.kind === "task" ? subject.task.est_minutes : subject.rhythm.est_minutes,
  };
  // The scene takes the Today keys (scene.ts): Space ends the sitting with its worked minutes,
  // through the way out's note like "Bitir".
  const latest = useRef(() => {});
  useEffect(() => {
    latest.current = () => {
      if (session.id === "pending") return;
      const view = flowView(plan, state, session.startedAt, new Date(), session.id);
      void controls.finish(view.countedMinutes);
    };
  });
  useEffect(
    () =>
      props.keys?.listen((key) => {
        if (key === "space") latest.current();
      }),
    [props.keys],
  );
  if (loading) return null;
  return (
    <div className="flex flex-1 flex-col" data-testid="deneme-flow">
      <FlowLayout
        device={device}
        plan={plan}
        state={state}
        startedAt={session.startedAt}
        sessionId={session.id}
        onChange={save}
        onFinish={(counted) => void controls.finish(counted)}
        color={color}
        title={title}
        subtitle={subtitleOf(props)}
        boxes={
          <>
            {record?.exit_note ? (
              <ResumeNote text={record.exit_note} detail="geçen oturumdan çıkarken yazdın" />
            ) : null}
            <Panel variant="dense" className="py-1">
              <SessionFile title={`${title}.pdf`} detail="Kaydın metni" />
            </Panel>
          </>
        }
      />
    </div>
  );
}
