"use client";

import { Check, FileText } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { StepLines } from "./Feedback";
import { PanelLabel } from "./Panel";
import {
  clockText,
  flow,
  type FlowPlan,
  type FlowState,
  flowView,
  pomodoro,
  type PomodoroPlan,
  type PomodoroState,
  pomodoroView,
} from "./sessionTimers";

// The scene layouts (Okul çekirdek A; docs/tasarim/parcalar.md, "Sahne yerleşimleri"; frames
// K1T2–K1T5, K3T2–K3T5, K4T2–K4T6, SahneAkisProje, SahneDokuman, SahneToplanti and their board
// pairs). A layout is a component, not a scene: the module's scene picks one and gives it its
// texts, its boxes and its actions; the method and its lengths are the layout's input (the
// module's settings) and are not changed in the scene. The state of a timer is the module's to
// keep (`onChange`), computed from moments (sessionTimers.ts), so a reload and the other device
// show the same. Values come from the tokens; the zemin is the scene's.

type Device = "pano" | "telefon";
type Action = { label: string; onClick: () => void };

// --- The core's card in a layout's place (the way out's note, `beforeExit`) ---------------------

/**
 * The core puts a card here while it holds the way out of a scene (the note `beforeExit` asks);
 * a layout on the board draws it in its counter's place and says so (`claim`). A scene that uses
 * no layout leaves it unclaimed and the core draws the card itself.
 */
export const SceneCardContext = createContext<{
  card: ReactNode | null;
  claim: () => () => void;
} | null>(null);

function useSceneCard(device: Device): ReactNode | null {
  const slot = useContext(SceneCardContext);
  useLayoutEffect(() => {
    if (!slot || device !== "pano") return;
    return slot.claim();
  }, [slot, device]);
  return device === "pano" ? (slot?.card ?? null) : null;
}

// --- A second's clock --------------------------------------------------------------------------

/** The time now, each second (the layouts' counters). */
export function useSecond(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// --- The frame every layout shares ------------------------------------------------------------

/**
 * The layout's frame (okul-sahneler.md, "Sahnenin düzeni"). Phone, top to bottom: title and line
 * under it, the middle, the one line under it, the boxes, then at the bottom the main and second
 * button and a quiet one. Board, two columns: title, middle, line and buttons on the left; the
 * boxes on the right. A card (`card`: "Süre doldu.", the way out's note) takes the middle's and
 * the buttons' place.
 */
export function SessionLayout({
  device,
  title,
  subtitle,
  middle,
  under,
  boxes,
  primary,
  secondary,
  quiet = [],
  card,
  testId,
}: {
  device: Device;
  title: string;
  subtitle?: string | null;
  middle?: ReactNode;
  under?: ReactNode;
  /** "Kaldığın yer", "Bu oturumda", the module's own boxes. */
  boxes?: ReactNode;
  primary?: Action | null;
  secondary?: Action | null;
  /** Quiet text buttons ("Oturumu bitir", "Sonra yap"). */
  quiet?: Action[];
  card?: ReactNode | null;
  testId?: string;
}) {
  const coreCard = useSceneCard(device);
  const shown = coreCard ?? card ?? null;
  const buttons = shown ? null : (
    <div
      className={cn(
        "flex flex-col gap-2",
        device === "pano" && "flex-row flex-wrap items-center gap-3",
      )}
    >
      <div className={cn("flex gap-2.5", device === "pano" ? "gap-3" : "w-full")}>
        {primary ? (
          <Button
            variant="primary"
            size="lg"
            className={cn(device === "telefon" && "flex-1")}
            onClick={primary.onClick}
          >
            {primary.label}
          </Button>
        ) : null}
        {secondary ? (
          <Button size="lg" onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        ) : null}
      </div>
      {quiet.length > 0 ? (
        <div
          className={cn("flex flex-wrap justify-center gap-x-4", device === "pano" && "gap-x-2")}
        >
          {quiet.map((action) => (
            <Button key={action.label} variant="quiet" onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
  const head = (
    <header className="flex flex-col gap-1">
      <h2 className="text-title md:text-scene tracking-title font-bold">{title}</h2>
      {subtitle ? <p className="text-ink-2 text-note md:text-base">{subtitle}</p> : null}
    </header>
  );
  if (device === "pano") {
    return (
      <div
        data-testid={testId}
        data-layout-device="pano"
        className="grid flex-1 grid-cols-[minmax(0,5fr)_minmax(0,4fr)] items-start gap-10"
      >
        <div className="flex flex-col gap-6">
          {head}
          {shown ?? (
            <>
              {middle ? <div className="flex flex-col items-center gap-5">{middle}</div> : null}
              {under ? <div className="flex justify-center">{under}</div> : null}
              <div className="flex justify-center">{buttons}</div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-4">{boxes}</div>
      </div>
    );
  }
  return (
    <div data-testid={testId} data-layout-device="telefon" className="flex flex-1 flex-col gap-4">
      {head}
      {shown ?? (
        <>
          {middle ? <div className="flex flex-col items-center">{middle}</div> : null}
          {under ? <div className="flex justify-center">{under}</div> : null}
        </>
      )}
      <div className="flex flex-col gap-3.5">{boxes}</div>
      <div className="flex-1" />
      {buttons}
    </div>
  );
}

// --- Pieces ------------------------------------------------------------------------------------

/** The ring of a pomodoro: the phase's share in the work's colour (a break in the sand of the sun). */
function Ring({
  device,
  share,
  color,
  children,
}: {
  device: Device;
  share: number;
  color: string;
  children: ReactNode;
}) {
  const size = device === "pano" ? 400 : 226;
  const width = device === "pano" ? 14 : 10;
  const radius = size / 2 - width / 2 - 1;
  const length = 2 * Math.PI * radius;
  const done = Math.min(1, Math.max(0, share)) * length;
  return (
    <div className={cn("relative", device === "pano" ? "size-100" : "size-56.5")}>
      <svg
        aria-hidden
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 size-full -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-fill-track)"
          strokeWidth={width}
        />
        {done > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={width}
            strokeLinecap="round"
            strokeDasharray={`${done} ${length}`}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
        {children}
      </div>
    </div>
  );
}

function Counter({
  device,
  label,
  time,
  size = "ring",
}: {
  device: Device;
  label: string;
  time: string;
  size?: "ring" | "flow";
}) {
  return (
    <>
      <span className="text-ink-2 tracking-label text-xs font-semibold uppercase">{label}</span>
      <span
        role="timer"
        aria-label={label}
        className={cn(
          "tracking-counter font-bold tabular-nums",
          device === "pano" ? "text-timer-board" : size === "ring" ? "text-6xl" : "text-7xl",
        )}
      >
        {time}
      </span>
    </>
  );
}

/** One quiet line under the counter: dots of the rounds and a few words. */
function Dots({
  total,
  done,
  current,
  text,
}: {
  total: number;
  done: number;
  current: number | null;
  text: string;
}) {
  return (
    <p className="text-ink-2 text-note flex items-center gap-2.5" data-testid="layout-line">
      <span aria-hidden className="flex gap-1.5">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn(
              "size-3 rounded-full border",
              index < done ? "bg-ink border-ink" : "border-ink-2",
              index === current && "ring-ink-2 ring-1 ring-offset-2 ring-offset-transparent",
            )}
          />
        ))}
      </span>
      <span aria-hidden className="bg-line h-3.5 w-px" />
      <span>{text}</span>
    </p>
  );
}

/**
 * "Süre doldu." (frames K1T5, K3T5, K4T5): in the counter's place, one sentence, "Bitti" and
 * "+5 dk" (as many times as wanted), and a third choice when the module gives one (the work's
 * last sitting: "Bugünlük yeter"; quiet text on the phone, a third button on the board).
 */
export function TimeUpCard({
  device,
  text,
  onDone,
  onMore,
  third,
  title = "Süre doldu.",
}: {
  device: Device;
  text: string;
  onDone: () => void;
  onMore: () => void;
  third?: Action | null;
  title?: string;
}) {
  return (
    <section
      aria-label={title}
      data-testid="time-up"
      className="glass-main rounded-panel flex flex-col gap-4 p-5 md:p-7"
    >
      <h3 className="md:text-section text-2xl font-bold">{title}</h3>
      <p className="text-ink-2 text-base">{text}</p>
      <div className="flex gap-3">
        <Button variant="primary" size="lg" className="flex-1" onClick={onDone}>
          Bitti
        </Button>
        <Button size="lg" className="flex-1" onClick={onMore}>
          +5 dk
        </Button>
        {third && device === "pano" ? (
          <Button size="lg" className="flex-1" onClick={third.onClick}>
            {third.label}
          </Button>
        ) : null}
      </div>
      {third && device === "telefon" ? (
        <Button variant="quiet" onClick={third.onClick}>
          {third.label}
        </Button>
      ) : null}
    </section>
  );
}

/**
 * "Kaldığın yer" (frames SahneKaldiginYerOdev, PanoKaldiginYerOdev): where the work stood, from the
 * start of the sitting on: on the phone a narrow box under the counter, on the board the first box
 * of the right column. A section's name and page with "Aç", or the sentence written on the way
 * out.
 */
export function ResumeNote({
  text,
  detail,
  open,
  label = "Kaldığın yer",
}: {
  text: string;
  detail?: string | null;
  open?: { label: string; href: string } | null;
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      data-testid="resume-note"
      className="glass-soft rounded-soft flex items-start gap-3 px-4 py-3"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <PanelLabel>{label}</PanelLabel>
        <p className="text-base font-semibold">{text}</p>
        {detail ? <p className="text-ink-2 text-sm">{detail}</p> : null}
      </div>
      {open ? (
        <a
          href={open.href}
          target="_blank"
          rel="noreferrer"
          className="text-note min-h-touch flex items-center font-semibold"
        >
          {open.label}
        </a>
      ) : null}
    </section>
  );
}

export type SessionSection = {
  key: string;
  title: string;
  /** "2 tur", "4 soru". */
  measure?: string | null;
  state: "done" | "current" | "next";
  /** The current section's document, in a new tab ("Aç"). */
  open?: { label: string; href: string } | null;
};

/** "Bu oturumda" (frame K1T2): the sitting's sections in order; the current one lit, with "Aç". */
export function SessionSections({
  sections,
  label = "Bu oturumda",
  color,
}: {
  sections: SessionSection[];
  label?: string;
  color: string;
}) {
  return (
    <section
      aria-label={label}
      data-testid="session-sections"
      className="glass-dense rounded-dense flex flex-col gap-1 p-2"
    >
      <PanelLabel className="px-2.5 pt-1.5 pb-1">{label}</PanelLabel>
      <ol className="flex flex-col">
        {sections.map((section, index) => (
          <li
            key={section.key}
            aria-current={section.state === "current" ? "step" : undefined}
            className={cn(
              "rounded-step min-h-row flex items-center gap-3 px-2.5",
              section.state === "current" && "bg-fill-selected",
              section.state === "done" && "text-ink-2",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                section.state === "current" ? "text-ink-dark border-transparent" : "border-ink-2",
              )}
              style={section.state === "current" ? { backgroundColor: color } : undefined}
            >
              {section.state === "done" ? <Check className="size-3" /> : index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-base font-semibold">{section.title}</span>
            {section.measure ? (
              <span className="text-ink-2 shrink-0 text-sm tabular-nums">{section.measure}</span>
            ) : null}
            {section.state === "current" && section.open ? (
              <a
                href={section.open.href}
                target="_blank"
                rel="noreferrer"
                className="text-note min-h-touch flex items-center font-semibold"
              >
                {section.open.label}
              </a>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A box of the work's files or text (frames K3T2, K1P2): an icon, a name, a line, "Aç". */
export function SessionFile({
  title,
  detail,
  open,
}: {
  title: string;
  detail?: string | null;
  open?: { label: string; href: string } | null;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <FileText aria-hidden className="text-ink-2 size-4.5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold">{title}</span>
        {detail ? <span className="text-ink-2 truncate text-sm">{detail}</span> : null}
      </div>
      {open ? (
        <a
          href={open.href}
          target="_blank"
          rel="noreferrer"
          className="glass-soft rounded-tabs text-note min-h-touch flex items-center px-3.5 font-semibold"
        >
          {open.label}
        </a>
      ) : null}
    </div>
  );
}

/** "Oturum bitti." (frames K1T7, K2T6): one line in the middle and nothing else. */
export function SessionEnd({ text = "Oturum bitti." }: { text?: string }) {
  return (
    <div
      data-testid="session-end"
      className="animate-fade-in flex flex-1 items-center justify-center motion-reduce:animate-none"
    >
      <p className="text-scene md:text-board-title tracking-title font-bold">{text}</p>
    </div>
  );
}

/**
 * The end of a sitting as one line: shows "Oturum bitti." for a moment, then does what ends it
 * (`controls.finish`). Returns whether the line is up and the way to start it.
 */
export function useSessionEnd(ms = 1600): [boolean, (then: () => void) => void] {
  const [ended, setEnded] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );
  return [
    ended,
    (then) => {
      setEnded(true);
      pending.current = setTimeout(then, ms);
    },
  ];
}

// --- Pomodoro ----------------------------------------------------------------------------------

/**
 * Pomodoro (frames K1T2–K1T4, K4T2–K4T4): the ring, the time in this round, ODAK or KISA MOLA,
 * the round's length; "Duraklat" and "Turu atla"; in a break "Molayı bitir" and "+5 dk". After the
 * last round "Süre doldu." with "Bitti" and "+5 dk". `onFinish` gets the focus minutes (breaks
 * out), what the scene tells the core.
 */
export function PomodoroLayout({
  device,
  plan,
  state,
  startedAt,
  sessionId,
  onChange,
  onFinish,
  color,
  breakColor = "var(--color-swatch-sun)",
  title,
  subtitle,
  boxes,
  breakBox,
  finishLabel = "Oturumu bitir",
  timeUpText = "Bölüm bittiyse geçilir. Bitmediyse tura 5 dakika eklenir; istediğin kadar ekleyebilirsin.",
  third,
  now: givenNow,
}: {
  device: Device;
  plan: PomodoroPlan;
  /**
   * The module's stored state; null, or another session's: the first round from this session's
   * start.
   */
  state: PomodoroState | null;
  startedAt: Date;
  /** The running session (`SceneProps.session.id`): the state is kept for it. */
  sessionId: string;
  onChange: (state: PomodoroState) => void;
  onFinish: (countedMinutes: number) => void;
  /** The work's colour (the ring in focus). */
  color: string;
  breakColor?: string;
  title: string;
  subtitle?: string | null;
  boxes?: ReactNode;
  /** In a break, on the phone: "Moladan sonra" instead of the boxes. */
  breakBox?: ReactNode;
  finishLabel?: string;
  timeUpText?: string;
  /** The time-up card's third choice ("Bugünlük yeter"). */
  third?: Action | null;
  now?: Date;
}) {
  const second = useSecond();
  const now = givenNow ?? second;
  const view = pomodoroView(plan, state, startedAt, now, sessionId);
  const act = (next: (current: PomodoroState) => PomodoroState) => onChange(next(view.state));
  const inBreak = view.phase === "break";
  const label = inBreak ? "Kısa mola" : "Odak";
  const lineText = inBreak
    ? `${view.roundsDone} / ${view.rounds} tur bitti`
    : `tur ${view.round} / ${view.rounds}${
        view.round < view.rounds ? ` · sonra ${plan.breakMinutes} dk mola` : " · son tur"
      }`;
  return (
    <SessionLayout
      device={device}
      testId="layout-pomodoro"
      title={title}
      subtitle={subtitle}
      middle={
        <div data-phase={view.phase} data-round={view.round} data-testid="pomodoro-ring">
          <Ring
            device={device}
            share={view.elapsedMs / view.targetMs}
            color={inBreak ? breakColor : color}
          >
            <Counter device={device} label={label} time={clockText(view.elapsedMs)} />
            <span className="text-ink-2 text-sm tabular-nums">
              {Math.round(view.targetMs / 60_000)} dk
            </span>
          </Ring>
        </div>
      }
      under={
        <Dots
          total={view.rounds}
          done={view.roundsDone}
          current={inBreak ? null : view.round - 1}
          text={view.paused ? `${lineText} · duraklatıldı` : lineText}
        />
      }
      boxes={inBreak && device === "telefon" && breakBox ? breakBox : boxes}
      card={
        view.timeUp ? (
          <TimeUpCard
            device={device}
            text={timeUpText}
            onDone={() => onFinish(view.countedMinutes)}
            onMore={() => act((current) => pomodoro.extend(plan, current, now))}
            third={third}
          />
        ) : null
      }
      primary={
        inBreak
          ? { label: "Molayı bitir", onClick: () => act((c) => pomodoro.endBreak(plan, c, now)) }
          : view.paused
            ? { label: "Sürdür", onClick: () => act((c) => pomodoro.resume(plan, c, now)) }
            : { label: "Duraklat", onClick: () => act((c) => pomodoro.pause(plan, c, now)) }
      }
      secondary={
        inBreak
          ? { label: "+5 dk", onClick: () => act((c) => pomodoro.extend(plan, c, now)) }
          : { label: "Turu atla", onClick: () => act((c) => pomodoro.skipRound(plan, c, now)) }
      }
      quiet={[{ label: finishLabel, onClick: () => onFinish(view.countedMinutes) }]}
    />
  );
}

// --- Flow --------------------------------------------------------------------------------------

/**
 * Akış (frames K3T2–K3T4, SahneAkisProje): a clock counting up, "AKIŞ", a bar that ends at the
 * planned time; "Mola ver" (a break counts up and is no work) and "Bitir"; on a break "Devam et"
 * and "Bitir". After the planned time "Süre doldu." `onFinish` gets the worked minutes.
 */
export function FlowLayout({
  device,
  plan,
  state,
  startedAt,
  sessionId,
  onChange,
  onFinish,
  color,
  title,
  subtitle,
  boxes,
  finishLabel = "Bitir",
  timeUpText = "Bitti dersen oturum kapanır. Bitmediyse 5 dakika eklenir; istediğin kadar ekleyebilirsin.",
  third,
  now: givenNow,
}: {
  device: Device;
  plan: FlowPlan;
  /** The module's stored state; null, or another session's: work from this session's start. */
  state: FlowState | null;
  startedAt: Date;
  /** The running session (`SceneProps.session.id`). */
  sessionId: string;
  onChange: (state: FlowState) => void;
  onFinish: (countedMinutes: number) => void;
  color: string;
  title: string;
  subtitle?: string | null;
  boxes?: ReactNode;
  finishLabel?: string;
  timeUpText?: string;
  third?: Action | null;
  now?: Date;
}) {
  const second = useSecond();
  const now = givenNow ?? second;
  const view = flowView(plan, state, startedAt, now, sessionId);
  const act = (next: (current: FlowState) => FlowState) => onChange(next(view.state));
  const worked = Math.floor(view.workedMs / 60_000);
  return (
    <SessionLayout
      device={device}
      testId="layout-flow"
      title={title}
      subtitle={subtitle}
      middle={
        <div
          data-testid="flow-clock"
          data-break={view.onBreak ? "" : undefined}
          className="flex w-full flex-col items-center gap-2"
        >
          <Counter
            device={device}
            size="flow"
            label={view.onBreak ? "Mola" : "Akış"}
            time={clockText(view.onBreak ? view.breakElapsedMs : view.workedMs)}
          />
          <span className="text-ink-2 text-note">
            {view.onBreak
              ? `çalışılan ${worked} dk · mola süreye sayılmaz`
              : view.state.breakMs > 0
                ? `çalışılan ${worked} dk`
                : "mola vermeden"}
          </span>
          {view.onBreak ? null : (
            <div className="mt-5 flex w-full max-w-md flex-col gap-1">
              <div className="bg-fill-track h-1.5 overflow-hidden rounded-xs">
                <div
                  className="h-full rounded-xs"
                  style={{
                    width: `${Math.min(100, (view.workedMs / view.targetMs) * 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <span className="text-ink-2 self-end text-sm tabular-nums">
                {Math.round(view.targetMs / 60_000)} dk
              </span>
            </div>
          )}
        </div>
      }
      boxes={boxes}
      card={
        view.timeUp ? (
          <TimeUpCard
            device={device}
            text={timeUpText}
            onDone={() => onFinish(view.countedMinutes)}
            onMore={() => act((current) => flow.extend(plan, current, now))}
            third={third}
          />
        ) : null
      }
      primary={
        view.onBreak
          ? { label: "Devam et", onClick: () => act((c) => flow.endBreak(c, now)) }
          : { label: "Mola ver", onClick: () => act((c) => flow.startBreak(c, now)) }
      }
      secondary={{ label: finishLabel, onClick: () => onFinish(view.countedMinutes) }}
    />
  );
}

// --- Checklist ---------------------------------------------------------------------------------

export type ChecklistStep = {
  key: string;
  title: string;
  detail?: string | null;
  /** A timed step counts down and is done by itself at zero (a workout's step). */
  seconds?: number;
  /** Or a number of repetitions ("10 tekrar"). */
  reps?: number;
  /** The main button while this step is the current one; without `onClick` it does the step. */
  action?: { label: string; onClick?: () => void } | null;
  /** A small action at the row's right once the step is done ("Değiştir"). */
  rowAction?: Action | null;
};

/**
 * Kontrol listesi (frames K4T6, SahneDokuman, SahneToplanti): no timer; the steps, the ones done
 * ticked, the current one lit; the main button is the current step's own ("Ninova'yı aç") or
 * "Sonraki"; quiet actions under it ("Yükledim", "Sonra yap"; by default "Atla"). A step with
 * seconds counts down in its row and is done at zero. Interface only: which step it is on is the
 * module's to keep (`current`, `onStep`). The kit's former StepRunner is this layout.
 */
export function Checklist({
  device = "telefon",
  steps,
  current,
  onStep,
  title,
  subtitle,
  color,
  boxes,
  quiet,
  label = "Adımlar",
  doneText = "Adımlar tamam.",
  stepSince = null,
}: {
  device?: Device;
  steps: ChecklistStep[];
  /** The step the module says it is on; steps.length or more: all done. */
  current: number;
  /** A step was done (its button, or its countdown ran out) or skipped. */
  onStep: (index: number, outcome: "done" | "skipped") => void;
  title?: string;
  subtitle?: string | null;
  color: string;
  boxes?: ReactNode;
  quiet?: Action[];
  label?: string;
  doneText?: string;
  /**
   * When the current step began, as the module keeps it: a timed step counts down from it, so a
   * reload and the other device show the same time. Without it, from when the step is first shown.
   */
  stepSince?: Date | null;
}) {
  const step = steps[current];
  const list = (
    <section
      aria-label={label}
      data-testid="checklist"
      className="glass-dense rounded-dense flex flex-col p-2"
    >
      <div className="flex items-center px-2.5 pt-1.5 pb-1">
        <PanelLabel className="flex-1">{label}</PanelLabel>
        <span className="text-ink-2 text-sm tabular-nums">
          {Math.min(current, steps.length)} / {steps.length}
        </span>
      </div>
      <ol className="flex flex-col gap-1">
        {steps.map((row, index) => {
          const done = index < current;
          const now = index === current;
          return (
            <li
              key={row.key}
              aria-current={now ? "step" : undefined}
              className={cn(
                "rounded-step min-h-row flex items-center gap-3 px-2.5 py-2",
                now && "bg-fill-selected",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-5.5 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  done && "bg-fill-step border-transparent",
                  now ? "text-ink-dark border-transparent" : "border-ink-2",
                )}
                style={now ? { backgroundColor: color } : undefined}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn("text-base font-semibold", done && "text-ink-2")}>
                  {row.title}
                </span>
                {row.detail ? <span className="text-ink-2 text-sm">{row.detail}</span> : null}
                {now && row.reps ? (
                  <span className="text-ink-2 text-sm tabular-nums">{row.reps} tekrar</span>
                ) : null}
                {now && row.seconds ? (
                  <Countdown
                    key={`${current}-${row.key}-${stepSince?.getTime() ?? "shown"}`}
                    since={stepSince}
                    seconds={row.seconds}
                    onZero={() => onStep(current, "done")}
                  />
                ) : null}
              </span>
              {done && row.rowAction ? (
                <Button variant="quiet" size="sm" onClick={row.rowAction.onClick}>
                  {row.rowAction.label}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
  const all = !step ? (
    <p data-testid="steps-done" className="text-2xl font-semibold">
      {doneText}
    </p>
  ) : null;
  return (
    <SessionLayout
      device={device}
      testId="layout-checklist"
      title={title ?? ""}
      subtitle={subtitle}
      middle={
        <div className="flex w-full flex-col gap-4">
          <StepLines total={steps.length} done={Math.min(current, steps.length)} color={color} />
          {list}
          {all}
        </div>
      }
      boxes={boxes}
      primary={
        step
          ? {
              label: step.action?.label ?? "Sonraki",
              onClick: step.action?.onClick ?? (() => onStep(current, "done")),
            }
          : null
      }
      quiet={step ? (quiet ?? [{ label: "Atla", onClick: () => onStep(current, "skipped") }]) : []}
    />
  );
}

/** Counts a step down from its start (else from when it was first shown); tells once at zero. */
function Countdown({
  seconds,
  onZero,
  since,
}: {
  seconds: number;
  onZero: () => void;
  since: Date | null;
}) {
  const [shownAt] = useState(() => Date.now());
  const startedAt = since ? since.getTime() : shownAt;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, seconds - Math.floor((now - startedAt) / 1000));
  const told = useRef(false);
  const latest = useRef(onZero);
  useEffect(() => {
    latest.current = onZero;
  });
  useEffect(() => {
    if (left === 0 && !told.current) {
      told.current = true;
      latest.current();
    }
  }, [left]);
  return (
    <span role="timer" aria-label="Kalan süre" className="text-lead font-semibold tabular-nums">
      {clockText(left * 1000)}
    </span>
  );
}
