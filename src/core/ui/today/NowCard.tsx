"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAnswerPrompt,
  useCloseWorkItem,
  useEndSession,
  useSnoozePrompt,
  useStartSession,
} from "@/core/app/actions";
import type { KnownModule } from "@/core/app/hooks";
import {
  useAnswerFollowUp,
  useConfirmSession,
  useDefer,
  useSmallerStep,
  useStopForStuck,
  useWaitOn,
} from "@/core/app/plan-actions";
import type { NowCardContent } from "@/core/contract/types";
import { type Assignment, type Candidate, type NowState, overrun } from "@/core/planner";
import { elapsedMinutes } from "@/core/today/select";
import type { PlannedTarget } from "@/core/data/sessions";
import type { Rhythm, Session, Task, WorkItem } from "@/core/types";
import { useColors } from "@/core/app/facets";
import { formatMinutes, formatTime } from "@/lib/date";
import { EveningCard, MorningCard } from "./FrameCards";
import type { DayFrame, TodayBriefLine } from "./frame-text";

// The "now" card: the largest thing on the Today screen, drawn from the planner's `plan.now`
// (docs/05-arayuz.md, "NowCard durumları").

export function sessionTargetOf(candidate: Pick<Candidate, "type" | "id">) {
  if (candidate.type === "task" || candidate.type === "follow_up") return { taskId: candidate.id };
  if (candidate.type === "item") return { workItemId: candidate.id };
  return { rhythmId: candidate.id };
}

type Props = {
  state: NowState;
  now: Date;
  date: string;
  modules: Map<string, KnownModule>;
  /** The first work of tomorrow, for the night state. */
  tomorrowFirst?: Candidate | null;
  /** Opens the "vakit kalırsa" list (done state). */
  onShowRest?: () => void;
  /** The running work has a scene this device left ("Çık"): "Sahneye dön" (Ç3c). */
  onReturnToScene?: () => void;
  /** "Takıldım" held by the screen (a scene opens it too); the card keeps its own without. */
  stuck?: Task | null;
  onStuckChange?: (task: Task | null) => void;
  /** The day's frame (Ç3c): the morning's and the evening's cards read it. */
  frame?: DayFrame;
  startOnWake?: boolean;
  brief?: TodayBriefLine;
  /** Ç3f: where the running or offered work stands in its chain ("Sabah dizisi 2/3 · …"). */
  chainLine?: string | null;
  /** Ç3f: the chain's next work after a running one (null: none, or the setting is off). */
  nextOf?: (id: string | null | undefined) => PlannedTarget | null;
};

function Frame({ children }: { children: ReactNode }) {
  return (
    <section
      aria-label="Şimdi"
      className="border-border bg-card flex min-h-56 flex-col justify-between gap-6 rounded-2xl border p-6 md:min-h-72 md:p-8"
    >
      <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">Şimdi</p>
      {children}
    </section>
  );
}

const TITLE = "text-3xl leading-tight font-semibold tracking-tight md:text-5xl";
const BIG = "h-12 px-6 text-base";
const SECOND = "h-12 px-5 text-base";

export function NowCard(props: Props) {
  // "Takıldım" closes the session, so the plan's state moves on; the three ways on stay on the
  // card until one is chosen.
  const [own, setOwn] = useState<Task | null>(null);
  const stuck = props.onStuckChange ? (props.stuck ?? null) : own;
  const setStuck = props.onStuckChange ?? setOwn;
  if (stuck) return <Stuck task={stuck} date={props.date} onDone={() => setStuck(null)} />;
  return <CardFor {...props} onStuck={setStuck} />;
}

function CardFor({
  state,
  now,
  date,
  modules,
  tomorrowFirst,
  onShowRest,
  onStuck,
  onReturnToScene,
  frame,
  startOnWake,
  brief,
  chainLine,
  nextOf,
}: Props & { onStuck: (task: Task) => void }) {
  if (state.kind === "morning") {
    return (
      <MorningCard
        date={date}
        now={now}
        first={state.first}
        startOnWake={startOnWake ?? false}
        brief={brief ?? { top: [], firstBlock: null, finishLine: "" }}
        modules={modules}
      />
    );
  }
  if (state.kind === "evening" && frame) {
    return (
      <EveningCard
        date={date}
        now={now}
        frame={frame}
        next={state.next}
        later={state.later ?? null}
        closed={state.closed}
        modules={modules}
        chainLine={chainLine ?? null}
      />
    );
  }
  if (state.kind === "running") {
    return (
      <Running
        session={state.session}
        task={state.task}
        rhythm={state.rhythm}
        now={now}
        date={date}
        modules={modules}
        onStuck={onStuck}
        onReturnToScene={onReturnToScene}
        chainLine={chainLine ?? null}
        next={() => nextOf?.(state.task?.id ?? state.rhythm?.id) ?? null}
      />
    );
  }
  if (state.kind === "block") {
    return (
      <Frame>
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">Sabit blok</p>
          <h2 className={TITLE}>{state.block.title}</h2>
          <p className="text-muted-foreground tabular-nums md:text-lg">
            {formatTime(new Date(state.block.ends_at))} bitiyor
            {state.block.location ? ` · ${state.block.location}` : ""}
          </p>
        </div>
      </Frame>
    );
  }
  if (state.kind === "prompt") return <PromptState prompt={state.prompt} modules={modules} />;
  if (state.kind === "suggest") {
    return (
      <Suggest
        assignment={state.assignment}
        at={state.at}
        date={date}
        modules={modules}
        chainLine={chainLine ?? null}
      />
    );
  }
  if (state.kind === "done") {
    return (
      <Frame>
        <div className="flex flex-col gap-2">
          <h2 className={TITLE}>Bugün tamam</h2>
          <p className="text-muted-foreground tabular-nums md:text-lg">
            {state.finished} iş · {formatMinutes(state.minutes)}
          </p>
        </div>
        {onShowRest ? (
          <div>
            <Button variant="outline" className={SECOND} onClick={onShowRest}>
              Vakit kalırsa
            </Button>
          </div>
        ) : null}
      </Frame>
    );
  }
  if (state.kind === "night") {
    return (
      <Frame>
        <div className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-5xl font-semibold tabular-nums md:text-7xl">
            {formatTime(now)}
          </h2>
          {frame ? (
            <p className="text-muted-foreground tabular-nums md:text-lg">
              Yarın uyanış {formatTime(frame.tonight.expectedWake)}
            </p>
          ) : null}
          <p className="text-muted-foreground md:text-lg">
            {tomorrowFirst
              ? `Yarın ilk iş: ${tomorrowFirst.title}`
              : "Yarın için planlanan bir şey yok."}
          </p>
          {/* Ç3g: a bedtime written by mistake is set right there. */}
          {frame?.bedAt ? (
            <Link
              href="/ayarlar#kayitlar"
              className="text-muted-foreground w-fit text-sm underline underline-offset-4"
            >
              Yatışı düzelt
            </Link>
          ) : null}
        </div>
      </Frame>
    );
  }
  if (state.kind === "return") return <Return top3={state.top3} modules={modules} />;
  return <Empty />;
}

/** The work's module, and its facet when it has one (Ç3e), in the work's colour. */
function ModuleLine({
  mod,
  work,
}: {
  mod: KnownModule | undefined;
  work: { task?: Task | null; item?: WorkItem | null; rhythm?: Rhythm | null };
}) {
  const colors = useColors();
  if (!mod) return null;
  const facet = colors.facetOf(mod.row.id, work);
  return (
    <p className="text-muted-foreground flex items-center gap-2 text-sm md:text-base">
      <span
        aria-hidden
        data-testid="work-dot"
        className="size-2.5 rounded-full"
        style={{ backgroundColor: colors.of(mod.row.id, work) }}
      />
      {facet ? `${mod.row.name} · ${facet.name}` : mod.row.name}
    </p>
  );
}

/** Ç3f: the work's place in its anchored chain, one line under the module. */
function ChainLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p data-testid="chain-line" className="text-muted-foreground text-sm tabular-nums md:text-base">
      {text}
    </p>
  );
}

/** "Neden?": why this work, why now; the engine's notes and the AI's. */
function Why({ reasons }: { reasons: string[] }) {
  const [open, setOpen] = useState(false);
  if (reasons.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 hover:underline"
        onClick={() => setOpen(!open)}
      >
        Neden?
      </button>
      {open ? (
        <ul
          role="note"
          aria-label="Neden bu iş"
          className="text-muted-foreground flex flex-col gap-1 text-sm"
        >
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** "60 dk · yol 20+20 dk" (docs/05-arayuz.md, "Zaman kısıtları"). */
export function travelText(before = 0, after = 0): string | null {
  return before + after > 0 ? `yol ${before}+${after} dk` : null;
}

function Suggest({
  assignment,
  at,
  date,
  modules,
  chainLine,
}: {
  chainLine: string | null;
  assignment: Assignment;
  /** Work bound to its time whose footprint starts later: when to start (or set off). */
  at?: Date;
  date: string;
  modules: Map<string, KnownModule>;
}) {
  const start = useStartSession();
  const defer = useDefer();
  const closeItem = useCloseWorkItem();
  const followUp = useAnswerFollowUp();
  const [unplanned, setUnplanned] = useState(false);
  const { candidate } = assignment;
  const mod = modules.get(candidate.moduleId);

  if (unplanned) {
    return (
      <Frame>
        <UnplannedForm
          onCancel={() => setUnplanned(false)}
          onStart={(title) => {
            start.mutate({ title });
            setUnplanned(false);
          }}
        />
      </Frame>
    );
  }

  // Waiting work whose follow-up day has come: did the answer come?
  if (candidate.type === "follow_up") {
    const task = candidate.task!;
    return (
      <Frame>
        <div className="flex flex-col gap-2">
          <ModuleLine mod={mod} work={candidate} />
          <h2 className={TITLE}>{candidate.title}</h2>
          <p className="text-muted-foreground md:text-lg">
            {task.waiting_on ? `${task.waiting_on} bekleniyor. ` : "Bekleniyor. "}Takip et.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className={BIG} onClick={() => followUp.mutate({ task, came: true, date })}>
            Cevap geldi
          </Button>
          <Button
            variant="outline"
            className={SECOND}
            onClick={() => followUp.mutate({ task, came: false, date })}
          >
            Hâlâ bekliyor
          </Button>
        </div>
      </Frame>
    );
  }

  // The effort planned for a work item is used up: it does not close on its own; the card asks.
  const item = candidate.item;
  if (
    candidate.type === "item" &&
    item?.effort_total_minutes != null &&
    item.effort_done_minutes >= item.effort_total_minutes
  ) {
    return (
      <Frame>
        <div className="flex flex-col gap-2">
          <ModuleLine mod={mod} work={candidate} />
          <h2 className={TITLE}>{candidate.title}</h2>
          <p className="text-muted-foreground md:text-lg">
            Ayrılan {formatMinutes(item.effort_total_minutes)} doldu. Bitti mi?
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className={BIG}
            onClick={() => closeItem.mutate({ itemId: candidate.id, result: "done" })}
          >
            Bitti
          </Button>
          <Button
            variant="outline"
            className={SECOND}
            onClick={() => start.mutate(sessionTargetOf(candidate))}
          >
            Devam et
          </Button>
          <Button variant="ghost" className={SECOND} onClick={() => setUnplanned(true)}>
            Başka bir şey yapıyorum
          </Button>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="flex flex-col gap-2">
        <ModuleLine mod={mod} work={candidate} />
        <ChainLine text={chainLine} />
        <h2 className={TITLE}>{candidate.title}</h2>
        <p className="text-muted-foreground tabular-nums md:text-lg">
          {[
            formatMinutes(assignment.minutes),
            travelText(assignment.travelBefore, assignment.travelAfter),
            candidate.progress,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {at ? (
          <p className="tabular-nums md:text-lg" data-testid="suggest-at">
            {assignment.travelBefore ? "Yola çıkış" : "Başlangıç"} {formatTime(at)}
          </p>
        ) : null}
        <Why reasons={assignment.reasons} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className={BIG} onClick={() => start.mutate(sessionTargetOf(candidate))}>
          Başla
        </Button>
        <Button
          variant="outline"
          className={SECOND}
          onClick={() => defer.mutate({ candidate, date })}
        >
          Ertele
        </Button>
        <Button variant="ghost" className={SECOND} onClick={() => setUnplanned(true)}>
          Başka bir şey yapıyorum
        </Button>
      </div>
    </Frame>
  );
}

function Running({
  session,
  task,
  rhythm,
  now,
  date,
  modules,
  onStuck,
  onReturnToScene,
  chainLine,
  next,
}: {
  onReturnToScene?: () => void;
  chainLine: string | null;
  /** Ç3f: read at the touch: the chain's next work (Bitti and Ertele start it). */
  next: () => PlannedTarget | null;
  session: Session;
  task: Task | null;
  rhythm: Rhythm | null;
  now: Date;
  date: string;
  modules: Map<string, KnownModule>;
  onStuck: (task: Task) => void;
}) {
  const end = useEndSession();
  const defer = useDefer();
  const stop = useStopForStuck();
  const confirm = useConfirmSession();
  const mod = session.module_id ? modules.get(session.module_id) : undefined;
  const title = task?.title ?? rhythm?.title ?? session.title ?? "Oturum";
  const estimate = task?.est_minutes ?? rhythm?.est_minutes ?? null;
  const elapsed = elapsedMinutes(session.started_at, now);
  const extra: NowCardContent | null = task ? (mod?.definition?.nowCard?.(task) ?? null) : null;
  // A session that has not reached the server yet has no id to end.
  const pending = session.id === "pending";
  const asking = overrun(session, estimate, now) !== "none" && !pending;

  const asCandidate: Candidate | null = task
    ? ({ type: "task", id: task.id, task } as Candidate)
    : rhythm
      ? ({ type: "rhythm", id: rhythm.id } as Candidate)
      : null;

  return (
    <Frame>
      <div className="flex flex-col gap-2">
        <ModuleLine mod={mod} work={{ task, rhythm }} />
        <ChainLine text={chainLine} />
        <h2 className={TITLE}>{title}</h2>
        {extra?.detail ? <p className="text-muted-foreground md:text-lg">{extra.detail}</p> : null}
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground tabular-nums">
          {formatMinutes(elapsed)} geçti
          {estimate ? ` · tahmin ${formatMinutes(estimate)}` : ""}
        </p>
        {estimate ? (
          <div
            role="progressbar"
            aria-label="Geçen süre"
            aria-valuemin={0}
            aria-valuemax={estimate}
            aria-valuenow={Math.min(elapsed, estimate)}
            className="bg-muted h-2 overflow-hidden rounded-full"
          >
            <div
              className="bg-foreground h-full rounded-full transition-[width]"
              style={{ width: `${Math.min(100, (elapsed / estimate) * 100)}%` }}
            />
          </div>
        ) : null}
        {asking ? (
          <p role="status" className="md:text-lg">
            Devam ediyor musun?
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          className={BIG}
          disabled={pending}
          onClick={() => end.mutate({ session, outcome: "done", next: next() })}
        >
          Bitti
        </Button>
        {asking ? (
          <Button variant="outline" className={SECOND} onClick={() => confirm.mutate(session)}>
            Devam ediyorum
          </Button>
        ) : null}
        {asCandidate ? (
          <Button
            variant="outline"
            className={SECOND}
            disabled={pending}
            onClick={() => defer.mutate({ candidate: asCandidate, date, session, next: next() })}
          >
            Ertele
          </Button>
        ) : null}
        {task ? (
          <Button
            variant="outline"
            className={SECOND}
            disabled={pending}
            onClick={() => {
              stop.mutate(session);
              onStuck(task);
            }}
          >
            Takıldım
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className={SECOND}
          disabled={pending}
          onClick={() => end.mutate({ session, outcome: "stopped" })}
        >
          Durdur
        </Button>
        {onReturnToScene ? (
          <Button variant="outline" className={SECOND} onClick={onReturnToScene}>
            Sahneye dön
          </Button>
        ) : null}
        {(extra?.links ?? []).map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="border-border hover:bg-muted flex h-12 items-center rounded-lg border px-5 text-base"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </Frame>
  );
}

/** "Takıldım": the session is closed; three ways on (docs/05-arayuz.md). */
function Stuck({ task, date, onDone }: { task: Task; date: string; onDone: () => void }) {
  const smaller = useSmallerStep();
  const wait = useWaitOn();
  const defer = useDefer();
  const [mode, setMode] = useState<"choose" | "smaller" | "wait">("choose");
  const [text, setText] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "smaller" && text.trim()) smaller.mutate({ task, title: text.trim(), date });
    if (mode === "wait") wait.mutate({ task, waitingOn: text.trim() || null, date });
    onDone();
  };
  return (
    <Frame>
      <div className="flex flex-col gap-2">
        <h2 className={TITLE}>{task.title}</h2>
        <p className="text-muted-foreground md:text-lg">Takıldın. Nasıl devam edelim?</p>
      </div>
      {mode === "choose" ? (
        <div className="flex flex-wrap gap-2">
          <Button className={BIG} onClick={() => setMode("smaller")}>
            Adımı küçült
          </Button>
          <Button variant="outline" className={SECOND} onClick={() => setMode("wait")}>
            Birini bekliyorum
          </Button>
          <Button
            variant="outline"
            className={SECOND}
            onClick={() => {
              defer.mutate({ candidate: { type: "task", id: task.id, task } as Candidate, date });
              onDone();
            }}
          >
            Bugün değil
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <Input
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-label={mode === "smaller" ? "İlk küçük adım" : "Kimi ya da neyi bekliyorsun?"}
            placeholder={mode === "smaller" ? "İlk küçük adım" : "Kimi ya da neyi bekliyorsun?"}
            className="h-12 min-w-0 flex-1 basis-56 text-base"
          />
          <Button type="submit" className={BIG} disabled={mode === "smaller" && !text.trim()}>
            Kaydet
          </Button>
          <Button type="button" variant="ghost" className={SECOND} onClick={onDone}>
            Vazgeç
          </Button>
        </form>
      )}
    </Frame>
  );
}

function PromptState({
  prompt,
  modules,
}: {
  prompt: Extract<NowState, { kind: "prompt" }>["prompt"];
  modules: Map<string, KnownModule>;
}) {
  const answer = useAnswerPrompt();
  const snooze = useSnoozePrompt();
  const options = (prompt.options as { value: string; label: string }[] | null) ?? [];
  const mod = modules.get(prompt.module_id);
  return (
    <Frame>
      <section aria-label="Soru" className="flex flex-col gap-6">
        <h2 className="text-2xl leading-tight font-semibold tracking-tight md:text-4xl">
          {mod ? <span className="text-muted-foreground">{mod.row.name} · </span> : null}
          {prompt.question}
        </h2>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              className={SECOND}
              onClick={() => answer.mutate({ prompt, value: option.value })}
            >
              {option.label}
            </Button>
          ))}
          <Button variant="ghost" className={SECOND} onClick={() => snooze.mutate(prompt.id)}>
            Sonra
          </Button>
        </div>
      </section>
    </Frame>
  );
}

function Return({ top3 }: { top3: Candidate[]; modules: Map<string, KnownModule> }) {
  const start = useStartSession();
  const colors = useColors();
  return (
    <Frame>
      <div className="flex flex-col gap-3">
        <h2 className={TITLE}>Kaldığın yerden devam</h2>
        {top3.length > 0 ? (
          <ol className="flex flex-col gap-1 md:text-lg">
            {top3.map((candidate) => (
              <li key={candidate.id} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: colors.of(candidate.moduleId, candidate) }}
                />
                {candidate.title}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground md:text-lg">Bugün için planlanan bir şey yok.</p>
        )}
      </div>
      {top3.length > 0 ? (
        <div>
          <Button className={BIG} onClick={() => start.mutate(sessionTargetOf(top3[0]))}>
            Başla
          </Button>
        </div>
      ) : null}
    </Frame>
  );
}

function Empty() {
  const start = useStartSession();
  const [unplanned, setUnplanned] = useState(false);
  return (
    <Frame>
      <p className="text-muted-foreground text-lg md:text-2xl">Bugün için planlanan bir şey yok.</p>
      {unplanned ? (
        <UnplannedForm
          onCancel={() => setUnplanned(false)}
          onStart={(title) => {
            start.mutate({ title });
            setUnplanned(false);
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 md:h-9" onClick={() => setUnplanned(true)}>
            Başka bir şey yapıyorum
          </Button>
        </div>
      )}
    </Frame>
  );
}

/** "Başka bir şey yapıyorum": one line, and a session without a plan starts. */
function UnplannedForm({
  onStart,
  onCancel,
}: {
  onStart: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim()) onStart(title.trim());
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2">
      <Input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        aria-label="Ne yapıyorsun?"
        placeholder="Ne yapıyorsun?"
        className="h-12 min-w-0 flex-1 basis-56 text-base"
      />
      <Button type="submit" className={BIG} disabled={!title.trim()}>
        Başla
      </Button>
      <Button type="button" variant="ghost" className="h-12 px-4 text-base" onClick={onCancel}>
        Vazgeç
      </Button>
    </form>
  );
}
