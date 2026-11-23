"use client";

import { useEffect, useRef, useState } from "react";
import { useRefreshAll } from "@/core/app/actions";
import { useModuleQuery } from "@/core/app/hooks";
import type { ModuleContext, SceneProps } from "@/core/contract/types";
import type { Task, WorkItem } from "@/core/types";
import {
  Button,
  type ChecklistStep,
  Checklist,
  type FlowState,
  FlowLayout,
  flowView,
  Input,
  ListRow,
  Panel,
  PanelLabel,
  type PomodoroState,
  PomodoroLayout,
  pomodoroView,
  ResumeNote,
  SessionEnd,
  SessionLayout,
  Tag,
  token,
  useSessionEnd,
} from "@/core/ui/kit";
import { SAVE_FAILED, useNotify } from "@/core/ui/Notices";
import { dayKey, formatMinutes, formatTime, weekdayOf } from "@/lib/date";
import {
  type Assessment,
  type Course,
  getAssessment,
  getMeeting,
  loadTerm,
  type Meeting,
  updateAssessment,
  updateMeeting,
} from "../queries";
import {
  DEFAULT_POMODORO,
  extendWork,
  markSubmitted,
  methodsOf,
  settingsOf,
  workTypeOf,
} from "../rules";
import { addStep } from "../server/entries";
import { deadlineOf, examStartOf, key, SOURCE, stepsOf } from "../server/proposals";
import { spentOn } from "../server/pages";
import { KIND_LABEL, weekdayDayMonth, WEEKDAY_SHORT } from "../server/text";
import { sourceIdOf, sourceTypeOf } from "../subject";

// Okul's scenes (okul-sahneler.md; frames K1–K4, SahneToplanti): a preparation on the pomodoro
// without sections (step 1: "Dokümanım hazır"; no "Bu oturumda", no "Aç", no "Kaldığın yer"), a
// homework or a step on the flow (code) or the pomodoro (written work), the hand-in on the
// checklist, a team meeting on its own list. The layout's state lives in the assessment (for its
// session), so a reload and the other device show the same; the methods and lengths come from the
// settings. "Bitti" on a work's last sitting opens the hand-in on the same scene (decision 5).

type Loaded = {
  assessment: Assessment | null;
  course: Course | null;
  meeting: Meeting | null;
  steps: Assessment[];
  spent: number;
  sittings: Task[];
};

function useLoaded(props: SceneProps) {
  const { subject, ctx } = props;
  const id = sourceIdOf(subject);
  const type = sourceTypeOf(subject);
  const item = subject.kind === "task" ? subject.workItem : null;
  return useModuleQuery(ctx.module, ["scene", type, id], async (context): Promise<Loaded> => {
    if (!id)
      return { assessment: null, course: null, meeting: null, steps: [], spent: 0, sittings: [] };
    const data = await loadTerm(context);
    const meeting = type === SOURCE.meeting ? await getMeeting(context, id) : null;
    const assessmentId = meeting ? meeting.project_id : id;
    const assessment =
      data.assessments.find((row) => row.id === assessmentId) ??
      (await getAssessment(context, assessmentId));
    const course = data.courses.find((row) => row.id === assessment?.course_id) ?? null;
    const tasks = item
      ? (await context.work.tasks()).filter((t) => t.work_item_id === item.id)
      : [];
    return {
      assessment,
      course,
      meeting,
      steps: assessment ? stepsOf(assessment, data.assessments) : [],
      spent: assessment ? spentOn(data.log, assessment.id, type === SOURCE.prep) : 0,
      sittings: tasks.filter((task) => task.status !== "dropped"),
    };
  });
}

/** A write of the scene: kept on this screen until the row has caught up (the other device too). */
function useStored<T>(stored: T | null, write: (next: T) => Promise<unknown>) {
  const refreshAll = useRefreshAll();
  const notify = useNotify();
  const [local, setLocal] = useState<{ state: T; from: string } | null>(null);
  const storedKey = JSON.stringify(stored);
  const state = local && local.from === storedKey ? local.state : stored;
  const save = (next: T) => {
    setLocal({ state: next, from: storedKey });
    write(next)
      .then(() => refreshAll())
      .catch(() => notify(SAVE_FAILED));
  };
  return [state, save] as const;
}

const subtitleOf = (a: Assessment, course: Course | null, step: boolean) => {
  const deadline = deadlineOf(a);
  const name = course ? (step ? `${course.name} projesi` : course.name) : "";
  if (!deadline || !a.date) return name;
  const day = `${WEEKDAY_SHORT[weekdayOf(a.date) - 1]} ${weekdayDayMonth(a.date).split(" ").slice(1).join(" ")}`;
  return `${name} · teslim ${day} ${formatTime(deadline)}`;
};

function examSubtitle(a: Assessment, course: Course | null) {
  const start = examStartOf(a);
  if (!start || !a.date) return course?.name ?? "";
  return `${course?.name ?? ""} · ${(KIND_LABEL[a.kind] ?? a.kind).toLocaleLowerCase("tr")} ${weekdayDayMonth(a.date)}${a.time ? ` ${a.time.slice(0, 5)}` : ""}`;
}

/** "Bu ödevde 1 sa 30 dk / 3 sa" and "oturum 1 / 2 · bugün 90 dk planlı". */
function ProgressBox({
  label,
  spent,
  item,
  task,
  sittings,
}: {
  label: string;
  spent: number;
  item: WorkItem | null;
  task: Task | null;
  sittings: Task[];
}) {
  const total = item?.effort_total_minutes ?? null;
  const index = task ? sittings.findIndex((row) => row.id === task.id) : -1;
  return (
    <Panel variant="soft" className="gap-0.5 px-4 py-3" data-testid="okul-scene-progress">
      <p className="text-base font-semibold">
        {label} {formatMinutes(spent)}
        {total !== null
          ? ` / ${item?.effort_provisional ? "yaklaşık " : ""}${formatMinutes(total)}`
          : ""}
      </p>
      {task && index >= 0 ? (
        <p className="text-ink-2 text-sm">
          oturum {index + 1} / {sittings.length} · bugün {formatMinutes(task.est_minutes)} planlı
        </p>
      ) : null}
    </Panel>
  );
}

/** The work's last sitting: what is left fits in this one. */
function lastSitting(item: WorkItem | null, task: Task | null): boolean {
  if (!item || !task || item.effort_total_minutes === null) return false;
  return item.effort_total_minutes - item.effort_done_minutes <= task.est_minutes;
}

export function OkulScene(props: SceneProps) {
  const type = sourceTypeOf(props.subject);
  if (type === SOURCE.submit) return <SubmitScene {...props} />;
  if (type === SOURCE.meeting) return <MeetingScene {...props} />;
  return <WorkScene {...props} />;
}

// --- Preparation, homework, step ---------------------------------------------------------------

type ListState = {
  session: string;
  step: number;
  since: string;
  /** The work's "Bitti" opened the list on its own scene (decision 5). */
  work_done?: boolean;
  /** The work's counted minutes at that "Bitti". */
  counted?: number;
  finished?: boolean;
};

function WorkScene(props: SceneProps) {
  const { subject, session, device, controls, facet, strip, ctx } = props;
  const loaded = useLoaded(props);
  const [ended, end] = useSessionEnd();
  const type = sourceTypeOf(subject);
  const prep = type === SOURCE.prep;
  const task = subject.kind === "task" ? subject.task : null;
  const item = subject.kind === "task" ? subject.workItem : null;
  const a = loaded.data?.assessment ?? null;
  const [layout, saveLayout] = useStored<unknown>(a?.layout_state ?? null, (next) =>
    a ? updateAssessment(ctx, a.id, { layout_state: next as never }) : Promise.resolve(),
  );
  const [list, saveList] = useStored<ListState | null>(
    (a?.checklist_state as ListState | null) ?? null,
    (next) =>
      a ? updateAssessment(ctx, a.id, { checklist_state: next as never }) : Promise.resolve(),
  );
  const handIn = list && list.session === session.id && list.work_done && !list.finished;
  const handInStep = handIn ? list.step : 0;
  useEffect(() => {
    if (ended) strip({ hidden: true });
    else if (handIn && a) strip({ title: `${a.title} teslimi`, detail: `${handInStep} / 4` });
    else strip(null);
  }, [strip, ended, handIn, handInStep, a]);
  if (loaded.isLoading || !loaded.data) return null;
  if (!a) return <SessionEnd text="Bu iş artık yok." />;
  if (ended) return <SessionEnd />;
  const course = loaded.data.course;
  const color = facet?.color ?? course?.color ?? token("color-swatch-blue");
  const settings = settingsOf(ctx);
  const method = methodsOf(settings)[prep ? "reading" : workTypeOf(a.output_kind)];
  const last = lastSitting(item, task);
  const step = type === SOURCE.step;

  if (handIn && list) {
    return (
      <HandIn
        {...props}
        a={a}
        course={course}
        list={list}
        save={saveList}
        onUploaded={async () => {
          await markSubmitted(ctx, a.id);
          await controls.finish(list.counted ?? null);
        }}
        onLater={() => {
          saveList({ ...list, finished: true });
          void controls.finish(list.counted ?? null);
        }}
      />
    );
  }

  const done = (counted: number) => {
    // The last sitting's "Bitti" of a work handed in opens the hand-in here (decision 5).
    if (!prep && last && a.submits && !a.submitted_at) {
      saveList({
        session: session.id,
        step: 0,
        since: new Date().toISOString(),
        work_done: true,
        counted,
      });
      return;
    }
    if (prep) end(() => void controls.finish(counted));
    else void controls.finish(counted);
  };
  const enough =
    last && task && item
      ? {
          label: "Bugünlük yeter",
          onClick: () => {
            const counted = currentCounted();
            const workKey = prep ? key.prep(a.id) : step ? key.step(a.id) : key.homework(a.id);
            void controls
              .stop(counted)
              .then(() =>
                extendWork(
                  ctx as ModuleContext,
                  workKey,
                  item.effort_done_minutes + counted + task.est_minutes,
                ),
              );
          },
        }
      : null;
  const title = prep ? `${a.title} hazırlığı` : a.title;
  const subtitle = prep ? examSubtitle(a, course) : subtitleOf(a, course, step);
  const resume =
    !prep &&
    a.resume_note &&
    a.resume_noted_at &&
    Date.parse(a.resume_noted_at) < session.startedAt.getTime()
      ? a.resume_note
      : null;
  const boxes = (
    <>
      {resume ? (
        <ResumeNote
          text={resume}
          detail={`${WEEKDAY_SHORT[weekdayOf(dayKey(new Date(a.resume_noted_at!))) - 1]} ${formatTime(new Date(a.resume_noted_at!))}`}
        />
      ) : null}
      <ProgressBox
        label={
          prep
            ? `Bu ${(KIND_LABEL[a.kind] ?? "").toLocaleLowerCase("tr")}in hazırlığı`
            : step
              ? "Bu alt işte"
              : "Bu ödevde"
        }
        spent={loaded.data.spent}
        item={item}
        task={task}
        sittings={loaded.data.sittings}
      />
    </>
  );
  const pomodoroSettings = { ...DEFAULT_POMODORO, ...(settings.pomodoro ?? {}) };
  const planned = task?.est_minutes ?? 60;
  const plan = {
    focusMinutes: pomodoroSettings.focus,
    breakMinutes: pomodoroSettings.short,
    rounds: Math.max(1, Math.round(planned / (pomodoroSettings.focus + pomodoroSettings.short))),
  };
  function currentCounted(): number {
    const now = new Date();
    return method === "flow"
      ? flowView(
          { plannedMinutes: planned },
          layout as FlowState | null,
          session.startedAt,
          now,
          session.id,
        ).countedMinutes
      : pomodoroView(plan, layout as PomodoroState | null, session.startedAt, now, session.id)
          .countedMinutes;
  }
  const timeUpText =
    !prep && last && a.submits && !a.submitted_at
      ? "Bitti dersen teslim adımları açılır. Bitmediyse 5 dakika eklenir. Bugünlük yeter dersen yeni bir oturum eklenir."
      : undefined;

  return (
    <div
      className="flex flex-1 flex-col"
      data-testid="okul-scene"
      data-method={method}
      data-type={type}
    >
      {method === "flow" ? (
        <FlowLayout
          device={device}
          plan={{ plannedMinutes: planned }}
          state={layout as FlowState | null}
          startedAt={session.startedAt}
          sessionId={session.id}
          onChange={saveLayout}
          onFinish={done}
          color={color}
          title={title}
          subtitle={subtitle}
          boxes={boxes}
          third={enough}
          {...(timeUpText ? { timeUpText } : {})}
        />
      ) : (
        <PomodoroLayout
          device={device}
          plan={plan}
          state={layout as PomodoroState | null}
          startedAt={session.startedAt}
          sessionId={session.id}
          onChange={saveLayout}
          onFinish={done}
          color={color}
          title={title}
          subtitle={subtitle}
          boxes={boxes}
          third={enough}
          {...(timeUpText ? { timeUpText } : {})}
        />
      )}
    </div>
  );
}

// --- The hand-in (frames K4T6, K4P6) ------------------------------------------------------------

const HAND_IN: ChecklistStep[] = [
  { key: "dosya", title: "Dosya hazır", detail: "Teslim edilecek dosyanın son hali" },
  { key: "ad", title: "Dosya adı", detail: "Yönergedeki adlandırmaya uygun" },
  {
    key: "yukle",
    title: "Ninova'ya yükle",
    detail: "Ödev sayfası açılır, dosyayı sen yüklersin",
  },
  {
    key: "gorulsun",
    title: "Yüklendiği görülsün",
    detail: "Adım 2'de Ninova'dan doğrulanacak",
  },
];

function HandIn({
  device,
  facet,
  a,
  course,
  list,
  save,
  onUploaded,
  onLater,
}: SceneProps & {
  a: Assessment;
  course: Course | null;
  list: ListState;
  save: (next: ListState) => void;
  onUploaded: () => Promise<void>;
  onLater: () => void;
}) {
  const color = facet?.color ?? course?.color ?? token("color-swatch-blue");
  const busy = useRef(false);
  const steps = HAND_IN.map((step) =>
    step.key === "yukle"
      ? {
          ...step,
          action: {
            label: "Ninova'yı aç",
            onClick: () => {
              window.open("https://ninova.itu.edu.tr/Kampus1", "_blank", "noopener");
              save({ ...list, step: Math.max(list.step, 3), since: new Date().toISOString() });
            },
          },
        }
      : step,
  );
  return (
    <div className="flex flex-1 flex-col" data-testid="okul-hand-in">
      <Checklist
        device={device}
        steps={steps}
        // The fourth step ("Yüklendiği görülsün") is Ninova's in step 2: it never blocks.
        current={Math.min(list.step, 3)}
        stepSince={new Date(list.since)}
        onStep={(index) => save({ ...list, step: index + 1, since: new Date().toISOString() })}
        title={`${a.title} teslimi`}
        subtitle={subtitleOf(a, course, a.kind === "project_step")}
        color={color}
        quiet={[
          {
            label: "Yükledim",
            onClick: () => {
              if (busy.current) return;
              busy.current = true;
              void onUploaded().finally(() => (busy.current = false));
            },
          },
          { label: "Sonra yap", onClick: onLater },
        ]}
      />
    </div>
  );
}

/** The hand-in's own work (`okul.submit`): the same list, started from Today. */
function SubmitScene(props: SceneProps) {
  const { session, strip, controls, ctx } = props;
  const loaded = useLoaded(props);
  const a = loaded.data?.assessment ?? null;
  const [list, saveList] = useStored<ListState | null>(
    (a?.checklist_state as ListState | null) ?? null,
    (next) =>
      a ? updateAssessment(ctx, a.id, { checklist_state: next as never }) : Promise.resolve(),
  );
  const mine: ListState =
    list && list.session === session.id
      ? list
      : { session: session.id, step: 0, since: session.startedAt.toISOString() };
  useEffect(() => {
    if (a) strip({ title: `${a.title} teslimi`, detail: `${Math.min(mine.step, 4)} / 4` });
  }, [strip, a, mine.step]);
  if (loaded.isLoading || !loaded.data) return null;
  if (!a) return <SessionEnd text="Bu iş artık yok." />;
  return (
    <HandIn
      {...props}
      a={a}
      course={loaded.data.course}
      list={mine}
      save={saveList}
      onUploaded={async () => {
        await markSubmitted(ctx, a.id);
        await controls.finish();
      }}
      // "Sonra yap" closes the list; the hand-in stays open (decision 5).
      onLater={() => void controls.stop()}
    />
  );
}

// --- The team meeting (frame SahneToplanti) -----------------------------------------------------

const NEXT_OWNER: Record<string, "me" | "other" | "none"> = {
  me: "other",
  other: "none",
  none: "me",
};
const OWNER_TEXT: Record<string, string> = { me: "Sen", other: "Başkası", none: "Sahibi yok" };

function MeetingScene(props: SceneProps) {
  const { device, controls, facet, ctx, session } = props;
  const loaded = useLoaded(props);
  const refreshAll = useRefreshAll();
  const notify = useNotify();
  const [text, setText] = useState("");
  if (loaded.isLoading || !loaded.data) return null;
  const { meeting, assessment: project, steps, course } = loaded.data;
  if (!meeting || !project) return <SessionEnd text="Bu toplantı artık yok." />;
  const color = facet?.color ?? course?.color ?? token("color-swatch-blue");
  const run = (write: () => Promise<unknown>) =>
    write()
      .then(() => refreshAll())
      .catch(() => notify(SAVE_FAILED));
  const open = steps.filter((step) => step.status !== "cancelled");
  const add = () => {
    const title = text.trim();
    if (!title) return;
    setText("");
    void run(() => addStep(ctx as ModuleContext, project.id, { title }));
  };
  return (
    <div className="flex flex-1 flex-col" data-testid="okul-meeting">
      <SessionLayout
        device={device}
        testId="layout-checklist"
        title={meeting.title}
        subtitle={`${course?.name ?? ""} projesi`}
        middle={
          <section
            aria-label="Açık adımlar"
            className="glass-dense rounded-dense flex w-full flex-col p-2"
          >
            <div className="flex items-center px-2.5 pt-1.5 pb-1">
              <PanelLabel className="flex-1">Açık adımlar</PanelLabel>
              <span className="text-ink-2 text-sm">sahibine dokun, değiştir</span>
            </div>
            {open.map((step) => (
              <ListRow
                key={step.id}
                data-testid="okul-meeting-step"
                dot={color}
                pending={step.status === "done"}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{step.title}</span>
                    {step.status === "done" ? <Tag>bitti</Tag> : null}
                  </span>
                }
                subtitle={step.date ? `hedef ${weekdayDayMonth(step.date)}` : "tarih yok"}
                trailing={
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        void run(() =>
                          updateAssessment(ctx, step.id, {
                            owner: NEXT_OWNER[step.owner ?? "me"],
                            proposed: false,
                          }),
                        )
                      }
                    >
                      {step.owner === "other"
                        ? (step.owner_name ?? OWNER_TEXT.other)
                        : OWNER_TEXT[step.owner ?? "me"]}
                    </Button>
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() =>
                        void run(() =>
                          updateAssessment(ctx, step.id, {
                            status: step.status === "done" ? "todo" : "done",
                          }),
                        )
                      }
                    >
                      {step.status === "done" ? "Aç" : "Bitti"}
                    </Button>
                  </>
                }
              />
            ))}
            <div className="flex gap-2 px-2.5 pt-2">
              <Input
                aria-label="Yeni adım ya da bekleyen"
                placeholder="Yeni adım ya da bekleyen · tek cümle"
                value={text}
                maxLength={160}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") add();
                }}
              />
              <Button onClick={add} disabled={!text.trim()}>
                Ekle
              </Button>
            </div>
          </section>
        }
        primary={{
          label: "Toplantıyı bitir",
          onClick: () =>
            void run(async () => {
              await updateMeeting(ctx, meeting.id, {
                checklist_state: { session: session.id, finished: true } as never,
              });
              await controls.finish();
            }),
        }}
        quiet={[{ label: "Sonra yap", onClick: () => void controls.stop() }]}
      />
    </div>
  );
}
