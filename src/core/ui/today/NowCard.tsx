"use client";

import Link from "next/link";
import { type ComponentProps, type FormEvent, type ReactNode, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { Tag } from "../kit/Choice";
import { ProgressBar } from "../kit/Feedback";
import { PanelLabel } from "../kit/Panel";
import { token } from "../tokens";
import { EveningCard, MorningCard } from "./FrameCards";
import type { DayFrame, TodayBriefLine } from "./frame-text";

// The "now" card: the largest thing on the Today screen, drawn from the planner's `plan.now`
// (docs/05-arayuz.md, "NowCard durumları"; its look docs/tasarim/ekranlar/bugun.md, BT*, BP*).

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
  /**
   * Ç4c: no active module holds the evening closing in its scene: the evening card offers
   * "Kapanış", which opens it in the standard scene shell.
   */
  closingHere?: () => void;
};

/**
 * The card (BT01, BP01): the main glass; the state's label at the top ("ŞİMDİ", "SORU"), unless
 * the state has its own title ("Günaydın", "Bugün tamam").
 */
export function CardFrame({
  label = "Şimdi",
  children,
  className,
}: {
  label?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label="Şimdi"
      data-testid="now-card"
      className={cn(
        "glass-main rounded-panel flex flex-col gap-2.5 p-5 md:gap-3 md:p-8",
        className,
      )}
    >
      {label ? <PanelLabel>{label}</PanelLabel> : null}
      {children}
    </section>
  );
}

/** The work's title: 30 px on the phone, the board's "Şimdi" size there. */
export const TITLE = "text-4xl md:text-now tracking-title leading-tight font-bold";
/** The line under the title: minutes, progress. */
export const DETAIL = "text-ink-2 text-base md:text-lg tabular-nums";

/**
 * The card's buttons (bugun.md, "Kartın kuralları"): at most one primary; the others secondary
 * glass; "Başka bir şey yapıyorum", "Durdur", "Sonra" quiet text under them. On the phone the
 * primary takes the room left in its row and the quiet ones stand centred under it; on the board
 * all sit in one row and the quiet ones at the left.
 */
export function CardActions({
  children,
  quiet,
  className,
}: {
  children?: ReactNode;
  quiet?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-1.5 flex flex-col gap-2.5", className)}>
      {children ? (
        <div className="flex flex-wrap gap-2.5 max-md:[&>[data-primary]]:flex-1">{children}</div>
      ) : null}
      {quiet ? (
        <div className="flex flex-wrap justify-center gap-x-4 md:justify-start">{quiet}</div>
      ) : null}
    </div>
  );
}

/** The card's one primary button. */
function Primary(props: ComponentProps<typeof Button>) {
  return <Button variant="primary" size="lg" data-primary="" {...props} />;
}

function Secondary(props: ComponentProps<typeof Button>) {
  return <Button variant="secondary" size="lg" {...props} />;
}

function Quiet({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "text-note min-h-touch focus-visible:shadow-focus rounded-full px-1.5 font-semibold outline-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

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
  onStuck,
  onReturnToScene,
  frame,
  startOnWake,
  brief,
  chainLine,
  nextOf,
  closingHere,
}: Props & { onStuck: (task: Task) => void }) {
  if (state.kind === "morning") {
    return (
      <MorningCard
        date={date}
        now={now}
        first={state.first}
        startOnWake={startOnWake ?? false}
        brief={brief ?? { firstBlock: null }}
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
        onClosing={closingHere}
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
      <CardFrame label="Sabit blok">
        <h2 className={TITLE}>{state.block.title}</h2>
        <p className={DETAIL}>
          {formatTime(new Date(state.block.ends_at))} bitiyor
          {state.block.location ? ` · ${state.block.location}` : ""}
        </p>
      </CardFrame>
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
      <CardFrame label={null}>
        <h2 className={TITLE}>Bugün tamam</h2>
        <p className={DETAIL}>
          {state.finished} iş · {formatMinutes(state.minutes)}
        </p>
      </CardFrame>
    );
  }
  if (state.kind === "night") {
    // The night (BT26, BP24): only the hour on the sky, no panel.
    return (
      <section
        aria-label="Şimdi"
        data-testid="now-card"
        className="text-ink-2 flex flex-col items-center gap-1.5 pb-[14vh] text-center"
      >
        <h2 className="text-clock md:text-clock-board tracking-counter text-ink-2 font-medium tabular-nums">
          {formatTime(now)}
        </h2>
        {frame ? (
          <p className="text-lead md:text-section mt-3 tabular-nums">
            Yarın uyanış {formatTime(frame.tonight.expectedWake)}
          </p>
        ) : null}
        <p className="text-lead md:text-section">
          {tomorrowFirst
            ? `Yarın ilk iş: ${tomorrowFirst.title}`
            : "Yarın için planlanan bir şey yok."}
        </p>
        {/* Ç3g: a bedtime written by mistake is set right there. */}
        {frame?.bedAt ? (
          <Link
            href="/ayarlar/kayitlar"
            className="text-note text-ink-link min-h-touch link-quiet mt-1 flex items-center md:text-base"
          >
            Yatışı düzelt
          </Link>
        ) : null}
      </section>
    );
  }
  if (state.kind === "return") return <Return next={state.next} modules={modules} />;
  return <Empty />;
}

/** The work's module, and its facet when it has one (Ç3e), in the work's colour. */
export function ModuleLine({
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
    <p className="text-ink-2 text-note flex items-center gap-2 md:text-base">
      <span
        aria-hidden
        data-testid="work-dot"
        className="size-2.25 shrink-0 rounded-full"
        style={{ backgroundColor: colors.of(mod.row.id, work) }}
      />
      {facet ? `${mod.row.name} · ${facet.name}` : mod.row.name}
    </p>
  );
}

/** Ç3f: the work's place in its anchored chain, as a small label over the title. */
export function ChainLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <span data-testid="chain-line" className="w-fit">
      <Tag className="text-sm tabular-nums">{text}</Tag>
    </span>
  );
}

/** "Neden?": why this work, why now; the engine's notes and the AI's. */
function Why({ reasons }: { reasons: string[] }) {
  const [open, setOpen] = useState(false);
  if (reasons.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        className="text-note min-h-touch link-quiet flex w-fit items-center font-medium"
        onClick={() => setOpen(!open)}
      >
        Neden?
      </button>
      {open ? (
        <ul
          role="note"
          aria-label="Neden bu iş"
          className="text-ink-2 text-note flex flex-col gap-1 md:text-base"
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
      <CardFrame>
        <UnplannedForm
          onCancel={() => setUnplanned(false)}
          onStart={(title) => {
            start.mutate({ title });
            setUnplanned(false);
          }}
        />
      </CardFrame>
    );
  }

  // Waiting work whose follow-up day has come: did the answer come?
  if (candidate.type === "follow_up") {
    const task = candidate.task!;
    return (
      <CardFrame>
        <ModuleLine mod={mod} work={candidate} />
        <h2 className={TITLE}>{candidate.title}</h2>
        <p className={DETAIL}>
          {task.waiting_on ? `${task.waiting_on} bekleniyor. ` : "Bekleniyor. "}Takip et.
        </p>
        <CardActions>
          <Primary onClick={() => followUp.mutate({ task, came: true, date })}>Cevap geldi</Primary>
          <Secondary onClick={() => followUp.mutate({ task, came: false, date })}>
            Hâlâ bekliyor
          </Secondary>
        </CardActions>
      </CardFrame>
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
      <CardFrame>
        <ModuleLine mod={mod} work={candidate} />
        <h2 className={TITLE}>{candidate.title}</h2>
        <p className={DETAIL}>
          Ayrılan {formatMinutes(item.effort_total_minutes)} doldu. Bitti mi?
        </p>
        <CardActions
          quiet={<Quiet onClick={() => setUnplanned(true)}>Başka bir şey yapıyorum</Quiet>}
        >
          <Primary onClick={() => closeItem.mutate({ itemId: candidate.id, result: "done" })}>
            Bitti
          </Primary>
          <Secondary onClick={() => start.mutate(sessionTargetOf(candidate))}>Devam et</Secondary>
        </CardActions>
      </CardFrame>
    );
  }

  return (
    <CardFrame>
      <ModuleLine mod={mod} work={candidate} />
      <ChainLine text={chainLine} />
      <h2 className={TITLE}>{candidate.title}</h2>
      <p className={DETAIL}>
        {[
          formatMinutes(assignment.minutes),
          travelText(assignment.travelBefore, assignment.travelAfter),
          candidate.progress,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {at ? (
        <p className="text-base tabular-nums md:text-lg" data-testid="suggest-at">
          {assignment.travelBefore ? "Yola çıkış" : "Başlangıç"} {formatTime(at)}
        </p>
      ) : null}
      <Why reasons={assignment.reasons} />
      <CardActions
        quiet={<Quiet onClick={() => setUnplanned(true)}>Başka bir şey yapıyorum</Quiet>}
      >
        <Primary onClick={() => start.mutate(sessionTargetOf(candidate))}>Başla</Primary>
        <Secondary onClick={() => defer.mutate({ candidate, date })}>Ertele</Secondary>
      </CardActions>
    </CardFrame>
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
  const colors = useColors();
  const mod = session.module_id ? modules.get(session.module_id) : undefined;
  const title = task?.title ?? rhythm?.title ?? session.title ?? "Oturum";
  const estimate = task?.est_minutes ?? rhythm?.est_minutes ?? null;
  const elapsed = elapsedMinutes(session.started_at, now);
  const extra: NowCardContent | null = task ? (mod?.definition?.nowCard?.(task) ?? null) : null;
  // A session that has not reached the server yet has no id to end.
  const pending = session.id === "pending";
  const asking = overrun(session, estimate, now) !== "none" && !pending;
  const color = mod ? colors.of(mod.row.id, { task, rhythm }) : token("color-ink-2");

  const asCandidate: Candidate | null = task
    ? ({ type: "task", id: task.id, task } as Candidate)
    : rhythm
      ? ({ type: "rhythm", id: rhythm.id } as Candidate)
      : null;

  return (
    <CardFrame>
      <ModuleLine mod={mod} work={{ task, rhythm }} />
      <ChainLine text={chainLine} />
      <h2 className={TITLE}>{title}</h2>
      {extra?.detail ? <p className={DETAIL}>{extra.detail}</p> : null}
      <p className={DETAIL}>
        {formatMinutes(elapsed)} geçti
        {estimate ? ` · tahmin ${formatMinutes(estimate)}` : ""}
      </p>
      {estimate ? (
        <ProgressBar label="Geçen süre" value={elapsed / estimate} color={color} className="my-1" />
      ) : null}
      {asking ? (
        <p role="status" className="text-base md:text-lg">
          Devam ediyor musun?
        </p>
      ) : null}
      <CardActions
        quiet={
          <Quiet disabled={pending} onClick={() => end.mutate({ session, outcome: "stopped" })}>
            Durdur
          </Quiet>
        }
      >
        <Primary
          disabled={pending}
          onClick={() => end.mutate({ session, outcome: "done", next: next() })}
        >
          Bitti
        </Primary>
        {asking ? (
          <Secondary onClick={() => confirm.mutate(session)}>Devam ediyorum</Secondary>
        ) : null}
        {asCandidate ? (
          <Secondary
            disabled={pending}
            onClick={() => defer.mutate({ candidate: asCandidate, date, session, next: next() })}
          >
            Ertele
          </Secondary>
        ) : null}
        {task ? (
          <Secondary
            disabled={pending}
            onClick={() => {
              stop.mutate(session);
              onStuck(task);
            }}
          >
            Takıldım
          </Secondary>
        ) : null}
        {onReturnToScene ? <Secondary onClick={onReturnToScene}>Sahneye dön</Secondary> : null}
        {(extra?.links ?? []).map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            {link.label}
          </Link>
        ))}
      </CardActions>
    </CardFrame>
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
    <CardFrame>
      <h2 className={TITLE}>{task.title}</h2>
      <p className="text-note md:text-lg">Takıldın. Nasıl devam edelim?</p>
      {mode === "choose" ? (
        <div className="mt-1.5 flex flex-wrap gap-2.5">
          <Primary className="max-md:w-full" onClick={() => setMode("smaller")}>
            Adımı küçült
          </Primary>
          <Secondary className="max-md:flex-1" onClick={() => setMode("wait")}>
            Birini bekliyorum
          </Secondary>
          <Secondary
            className="max-md:flex-1"
            onClick={() => {
              defer.mutate({ candidate: { type: "task", id: task.id, task } as Candidate, date });
              onDone();
            }}
          >
            Bugün değil
          </Secondary>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-1.5 flex flex-wrap gap-2.5">
          <Input
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-label={mode === "smaller" ? "İlk küçük adım" : "Kimi ya da neyi bekliyorsun?"}
            placeholder={mode === "smaller" ? "İlk küçük adım" : "Kimi ya da neyi bekliyorsun?"}
            className="min-w-0 flex-1 basis-56"
          />
          <Primary type="submit" disabled={mode === "smaller" && !text.trim()}>
            Kaydet
          </Primary>
          <Quiet onClick={onDone}>Vazgeç</Quiet>
        </form>
      )}
    </CardFrame>
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
    <CardFrame label="Soru">
      <section aria-label="Soru" className="flex flex-col gap-2.5 md:gap-3">
        {mod ? <ModuleLine mod={mod} work={{}} /> : null}
        <h2 className={TITLE}>{prompt.question}</h2>
        <CardActions quiet={<Quiet onClick={() => snooze.mutate(prompt.id)}>Sonra</Quiet>}>
          {options.map((option) => (
            <Secondary
              key={option.value}
              className="max-md:flex-1"
              onClick={() => answer.mutate({ prompt, value: option.value })}
            >
              {option.label}
            </Secondary>
          ))}
        </CardActions>
      </section>
    </CardFrame>
  );
}

/** Back after days away (Ç4a): the day's next work and "Başla", no list of three (BT18). */
function Return({ next, modules }: { next: Assignment | null; modules: Map<string, KnownModule> }) {
  const start = useStartSession();
  const colors = useColors();
  const candidate = next?.candidate ?? null;
  const mod = candidate ? modules.get(candidate.moduleId) : undefined;
  return (
    <CardFrame label={null}>
      <h2 className={TITLE}>Kaldığın yerden devam</h2>
      {candidate ? (
        <div className="mt-1 flex items-center gap-3">
          <span
            aria-hidden
            data-testid="work-dot"
            className="size-2.25 shrink-0 rounded-full"
            style={{ backgroundColor: colors.of(candidate.moduleId, candidate) }}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-heading truncate font-semibold">{candidate.title}</p>
            <p className="text-ink-2 text-base tabular-nums">
              {[mod?.row.name, formatMinutes(next!.minutes)].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button variant="primary" onClick={() => start.mutate(sessionTargetOf(candidate))}>
            Başla
          </Button>
        </div>
      ) : (
        <p className={DETAIL}>Bugün için planlanan bir şey yok.</p>
      )}
    </CardFrame>
  );
}

/** The empty day (BT19): one sentence and "Başka bir şey yapıyorum". */
function Empty() {
  const start = useStartSession();
  const [unplanned, setUnplanned] = useState(false);
  return (
    <CardFrame>
      <p className="text-xl font-semibold md:text-2xl">Bugün için planlanan bir şey yok.</p>
      {unplanned ? (
        <UnplannedForm
          onCancel={() => setUnplanned(false)}
          onStart={(title) => {
            start.mutate({ title });
            setUnplanned(false);
          }}
        />
      ) : (
        <CardActions>
          <Secondary onClick={() => setUnplanned(true)}>Başka bir şey yapıyorum</Secondary>
        </CardActions>
      )}
    </CardFrame>
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
    <form onSubmit={submit} className="mt-1.5 flex flex-wrap items-center gap-2.5">
      <Input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        aria-label="Ne yapıyorsun?"
        placeholder="Ne yapıyorsun?"
        className="min-w-0 flex-1 basis-56"
      />
      <Primary type="submit" disabled={!title.trim()}>
        Başla
      </Primary>
      <Quiet onClick={onCancel}>Vazgeç</Quiet>
    </form>
  );
}
