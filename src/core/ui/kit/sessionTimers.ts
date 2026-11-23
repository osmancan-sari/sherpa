// The state of the scene layouts' timers (Okul çekirdek A; docs/tasarim/parcalar.md, "Sahne
// yerleşimleri"; docs/06-modul-sozlesmesi.md, "Sahne yerleşimleri"). Pure: no React, no clock.
//
// A layout's state is a few moments and sums, never a running counter: what the screen shows is
// computed from the state and the time now. The module keeps the state in its own table (the core
// does not know rounds or breaks), so a reload and the other device show the same; a tab whose
// timers slept still shows the right time. Without a stored state, the layout starts at the
// session's stored start.

const MINUTE = 60_000;

const ms = (iso: string) => Date.parse(iso);
const iso = (time: number) => new Date(time).toISOString();

// --- Pomodoro --------------------------------------------------------------------------------

/** The method, an input of the layout (the module's settings; not changed in the scene). */
export type PomodoroPlan = { focusMinutes: number; breakMinutes: number; rounds: number };

export type PomodoroState = {
  /** 1-based round. */
  round: number;
  phase: "focus" | "break";
  /** When this phase began (ISO). */
  since: string;
  /** Paused since then (ISO), or not paused. */
  pausedAt: string | null;
  /** Paused time inside this phase, already over. */
  pausedMs: number;
  /** "+5 dk": time added to this phase (a break, or the last round's focus). */
  extraMs: number;
  /** Focus counted in the rounds already over. */
  focusMs: number;
};

export type PomodoroView = {
  /** The state brought up to now (a focus that ran out is a break). */
  state: PomodoroState;
  phase: "focus" | "break";
  round: number;
  rounds: number;
  /** Time in this phase, pauses out. */
  elapsedMs: number;
  /** This phase's length ("25 dk"), "+5 dk" in. */
  targetMs: number;
  paused: boolean;
  /** The last round's focus is over: "Süre doldu." */
  timeUp: boolean;
  /** The break is over and waits for "Molayı bitir". */
  breakOver: boolean;
  /** Rounds whose focus is over. */
  roundsDone: number;
  /** Focus minutes so far: what the scene tells the core (`controls.finish(counted)`). */
  countedMinutes: number;
};

export function pomodoroStart(at: Date): PomodoroState {
  return {
    round: 1,
    phase: "focus",
    since: at.toISOString(),
    pausedAt: null,
    pausedMs: 0,
    extraMs: 0,
    focusMs: 0,
  };
}

const phaseTarget = (plan: PomodoroPlan, state: PomodoroState) =>
  (state.phase === "focus" ? plan.focusMinutes : plan.breakMinutes) * MINUTE + state.extraMs;

const phaseElapsed = (state: PomodoroState, now: number) =>
  Math.max(0, (state.pausedAt ? ms(state.pausedAt) : now) - ms(state.since) - state.pausedMs);

/**
 * Brings the state up to `now`: a round's focus that ran out became its break at the moment it
 * ran out (before the last round). Breaks wait for the user once over.
 */
export function pomodoroNow(plan: PomodoroPlan, stored: PomodoroState, now: Date): PomodoroState {
  let state = stored;
  const time = now.getTime();
  // At most one step per round: a focus over → its break.
  for (let guard = 0; guard < plan.rounds + 1; guard++) {
    if (state.phase !== "focus" || state.pausedAt || state.round >= plan.rounds) break;
    const target = phaseTarget(plan, state);
    if (phaseElapsed(state, time) < target) break;
    const ended = ms(state.since) + state.pausedMs + target;
    state = {
      ...state,
      phase: "break",
      since: iso(ended),
      pausedAt: null,
      pausedMs: 0,
      extraMs: 0,
      focusMs: state.focusMs + target,
    };
  }
  return state;
}

export function pomodoroView(
  plan: PomodoroPlan,
  stored: PomodoroState | null,
  startedAt: Date,
  now: Date,
): PomodoroView {
  const state = pomodoroNow(plan, stored ?? pomodoroStart(startedAt), now);
  const elapsedMs = phaseElapsed(state, now.getTime());
  const targetMs = phaseTarget(plan, state);
  const focusNow = state.phase === "focus" ? Math.min(elapsedMs, targetMs) : 0;
  const lastFocus = state.phase === "focus" && state.round >= plan.rounds;
  return {
    state,
    phase: state.phase,
    round: state.round,
    rounds: plan.rounds,
    elapsedMs,
    targetMs,
    paused: state.pausedAt !== null,
    timeUp: lastFocus && elapsedMs >= targetMs,
    breakOver: state.phase === "break" && elapsedMs >= targetMs,
    roundsDone:
      state.round - 1 + (state.phase === "break" || (lastFocus && elapsedMs >= targetMs) ? 1 : 0),
    countedMinutes: Math.floor((state.focusMs + focusNow) / MINUTE),
  };
}

/** What the pomodoro's buttons do; each brings the state up to `now` first. */
export const pomodoro = {
  /** "Duraklat". */
  pause(plan: PomodoroPlan, state: PomodoroState, now: Date): PomodoroState {
    const current = pomodoroNow(plan, state, now);
    return current.pausedAt ? current : { ...current, pausedAt: now.toISOString() };
  },
  /** "Sürdür". */
  resume(plan: PomodoroPlan, state: PomodoroState, now: Date): PomodoroState {
    const current = pomodoroNow(plan, state, now);
    if (!current.pausedAt) return current;
    return {
      ...current,
      pausedAt: null,
      pausedMs: current.pausedMs + Math.max(0, now.getTime() - ms(current.pausedAt)),
    };
  },
  /**
   * "Turu atla": this round's focus ends now (what was done counts); its break begins, or, in the
   * last round, the time is up.
   */
  skipRound(plan: PomodoroPlan, state: PomodoroState, now: Date): PomodoroState {
    const current = pomodoro.resume(plan, state, now);
    if (current.phase !== "focus") return current;
    const done = Math.min(phaseElapsed(current, now.getTime()), phaseTarget(plan, current));
    if (current.round >= plan.rounds) {
      // The last round: the time is up now (its length becomes what was done).
      return { ...current, extraMs: done - plan.focusMinutes * MINUTE };
    }
    return {
      ...current,
      phase: "break",
      since: now.toISOString(),
      pausedAt: null,
      pausedMs: 0,
      extraMs: 0,
      focusMs: current.focusMs + done,
    };
  },
  /** "Molayı bitir": the next round's focus begins now. */
  endBreak(plan: PomodoroPlan, state: PomodoroState, now: Date): PomodoroState {
    const current = pomodoro.resume(plan, state, now);
    if (current.phase !== "break") return current;
    return {
      ...current,
      round: Math.min(plan.rounds, current.round + 1),
      phase: "focus",
      since: now.toISOString(),
      pausedAt: null,
      pausedMs: 0,
      extraMs: 0,
    };
  },
  /** "+5 dk": more time for this phase (a break, or the last round's focus once the time is up). */
  extend(plan: PomodoroPlan, state: PomodoroState, now: Date, minutes = 5): PomodoroState {
    const current = pomodoroNow(plan, state, now);
    // A time that is up grows from now: the added minutes are all still to come.
    const over = Math.max(0, phaseElapsed(current, now.getTime()) - phaseTarget(plan, current));
    return { ...current, extraMs: current.extraMs + over + minutes * MINUTE };
  },
};

// --- Flow ------------------------------------------------------------------------------------

/** The flow's plan: how long the sitting is planned to work (its bar ends there). */
export type FlowPlan = { plannedMinutes: number };

export type FlowState = {
  /** When the work began (ISO). */
  since: string;
  /** On a break since then (ISO), or working. */
  breakSince: string | null;
  /** Breaks already over. */
  breakMs: number;
  /** "+5 dk" after the planned time ran out. */
  extraMs: number;
};

export type FlowView = {
  state: FlowState;
  onBreak: boolean;
  /** Work time: breaks out. */
  workedMs: number;
  /** This break's time, counting up. */
  breakElapsedMs: number;
  /** The planned time, "+5 dk" in. */
  targetMs: number;
  timeUp: boolean;
  /** Worked minutes: what the scene tells the core. */
  countedMinutes: number;
};

export function flowStart(at: Date): FlowState {
  return { since: at.toISOString(), breakSince: null, breakMs: 0, extraMs: 0 };
}

export function flowView(
  plan: FlowPlan,
  stored: FlowState | null,
  startedAt: Date,
  now: Date,
): FlowView {
  const state = stored ?? flowStart(startedAt);
  const time = now.getTime();
  const breakNow = state.breakSince ? Math.max(0, time - ms(state.breakSince)) : 0;
  const workedMs = Math.max(0, time - ms(state.since) - state.breakMs - breakNow);
  const targetMs = plan.plannedMinutes * MINUTE + state.extraMs;
  return {
    state,
    onBreak: state.breakSince !== null,
    workedMs,
    breakElapsedMs: breakNow,
    targetMs,
    timeUp: !state.breakSince && workedMs >= targetMs,
    countedMinutes: Math.floor(workedMs / MINUTE),
  };
}

export const flow = {
  /** "Mola ver": the break counts up and is no work. */
  startBreak(state: FlowState, now: Date): FlowState {
    return state.breakSince ? state : { ...state, breakSince: now.toISOString() };
  },
  /** "Devam et". */
  endBreak(state: FlowState, now: Date): FlowState {
    if (!state.breakSince) return state;
    return {
      ...state,
      breakSince: null,
      breakMs: state.breakMs + Math.max(0, now.getTime() - ms(state.breakSince)),
    };
  },
  /** "+5 dk" once the planned time is up: five more minutes of work from now. */
  extend(plan: FlowPlan, state: FlowState, now: Date, minutes = 5): FlowState {
    const view = flowView(plan, state, new Date(ms(state.since)), now);
    const over = Math.max(0, view.workedMs - view.targetMs);
    return { ...state, extraMs: state.extraMs + over + minutes * MINUTE };
  },
};

/** "12:48": minutes and seconds of a time (hours fold into the minutes past an hour). */
export function clockText(totalMs: number): string {
  const seconds = Math.max(0, Math.floor(totalMs / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
