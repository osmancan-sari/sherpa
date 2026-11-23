import { describe, expect, it } from "vitest";
import {
  clockText,
  flow,
  flowView,
  pomodoro,
  type PomodoroPlan,
  pomodoroView,
} from "./sessionTimers";

// Okul çekirdek A: the scene layouts' timers, from moments only (a reload or the other device
// computes the same view from the same state).

const START = new Date("2026-11-23T11:00:00Z");
const at = (minutes: number, seconds = 0) =>
  new Date(START.getTime() + minutes * 60_000 + seconds * 1000);
const PLAN: PomodoroPlan = { focusMinutes: 25, breakMinutes: 5, rounds: 3 };

describe("the pomodoro", () => {
  it("starts at the session's start without a state; a focus that ran out is its break", () => {
    const first = pomodoroView(PLAN, null, START, at(12, 48));
    expect(first).toMatchObject({ phase: "focus", round: 1, timeUp: false, countedMinutes: 12 });
    expect(clockText(first.elapsedMs)).toBe("12:48");
    // 27 minutes in: the break began at 25, two minutes ago.
    const later = pomodoroView(PLAN, null, START, at(27));
    expect(later).toMatchObject({ phase: "break", round: 1, roundsDone: 1, countedMinutes: 25 });
    expect(clockText(later.elapsedMs)).toBe("02:00");
    // A break over waits for "Molayı bitir"; its time does not count.
    const waiting = pomodoroView(PLAN, null, START, at(40));
    expect(waiting).toMatchObject({ phase: "break", breakOver: true, countedMinutes: 25 });
  });

  it("Molayı bitir starts the next round; +5 dk lengthens the break", () => {
    const inBreak = pomodoroView(PLAN, null, START, at(27)).state;
    const longer = pomodoro.extend(PLAN, inBreak, at(28));
    expect(pomodoroView(PLAN, longer, START, at(33))).toMatchObject({
      phase: "break",
      breakOver: false,
    });
    const next = pomodoro.endBreak(PLAN, longer, at(34));
    const view = pomodoroView(PLAN, next, START, at(44));
    expect(view).toMatchObject({ phase: "focus", round: 2, countedMinutes: 35 });
  });

  it("Turu atla ends the focus now and counts what was done; in the last round the time is up", () => {
    const skipped = pomodoro.skipRound(PLAN, pomodoroView(PLAN, null, START, at(10)).state, at(10));
    expect(pomodoroView(PLAN, skipped, START, at(11))).toMatchObject({
      phase: "break",
      round: 1,
      countedMinutes: 10,
    });
    const round3 = {
      ...skipped,
      round: 3,
      phase: "focus" as const,
      since: at(20).toISOString(),
      extraMs: 0,
    };
    const last = pomodoro.skipRound(PLAN, round3, at(30));
    expect(pomodoroView(PLAN, last, START, at(30))).toMatchObject({
      timeUp: true,
      countedMinutes: 20,
    });
  });

  it("the last round's time up: Süre doldu; +5 dk gives five more minutes from now", () => {
    const round3 = {
      round: 3,
      phase: "focus" as const,
      since: START.toISOString(),
      pausedAt: null,
      pausedMs: 0,
      extraMs: 0,
      focusMs: 50 * 60_000,
    };
    const up = pomodoroView(PLAN, round3, START, at(27));
    expect(up).toMatchObject({ timeUp: true, roundsDone: 3, countedMinutes: 75 });
    const more = pomodoro.extend(PLAN, round3, at(27));
    expect(pomodoroView(PLAN, more, START, at(31))).toMatchObject({ timeUp: false });
    expect(pomodoroView(PLAN, more, START, at(32))).toMatchObject({
      timeUp: true,
      countedMinutes: 82,
    });
  });

  it("a pause holds the time, on every device, until it goes on", () => {
    const paused = pomodoro.pause(PLAN, pomodoroView(PLAN, null, START, at(10)).state, at(10));
    expect(pomodoroView(PLAN, paused, START, at(40))).toMatchObject({
      phase: "focus",
      paused: true,
      countedMinutes: 10,
    });
    const going = pomodoro.resume(PLAN, paused, at(40));
    expect(pomodoroView(PLAN, going, START, at(50))).toMatchObject({
      phase: "focus",
      countedMinutes: 20,
    });
  });
});

describe("a state belongs to its session", () => {
  it("another session's state is not used: the layout starts at this session's start", () => {
    const earlier = pomodoroView(PLAN, null, START, at(27), "s1").state;
    expect(earlier.session).toBe("s1");
    const next = at(60);
    expect(pomodoroView(PLAN, earlier, next, at(65), "s2")).toMatchObject({
      phase: "focus",
      round: 1,
      countedMinutes: 5,
    });
    expect(pomodoroView(PLAN, earlier, START, at(28), "s1").phase).toBe("break");
    const flowed = flowView({ plannedMinutes: 30 }, null, START, at(40), "s1").state;
    expect(flowView({ plannedMinutes: 30 }, flowed, next, at(70), "s2")).toMatchObject({
      timeUp: false,
      countedMinutes: 10,
    });
  });
});

describe("the flow", () => {
  it("counts up; a break counts up too and is no work", () => {
    const plan = { plannedMinutes: 90 };
    expect(flowView(plan, null, START, at(51)).countedMinutes).toBe(51);
    const onBreak = flow.startBreak(flowView(plan, null, START, at(51)).state, at(51));
    const view = flowView(plan, onBreak, START, at(55, 20));
    expect(view).toMatchObject({ onBreak: true, countedMinutes: 51 });
    expect(clockText(view.breakElapsedMs)).toBe("04:20");
    const back = flow.endBreak(onBreak, at(56));
    expect(flowView(plan, back, START, at(60)).countedMinutes).toBe(55);
  });

  it("the planned time up: Süre doldu; +5 dk five more minutes of work", () => {
    const plan = { plannedMinutes: 90 };
    const up = flowView(plan, null, START, at(90));
    expect(up).toMatchObject({ timeUp: true, countedMinutes: 90 });
    const more = flow.extend(plan, up.state, at(92));
    expect(flowView(plan, more, START, at(96)).timeUp).toBe(false);
    expect(flowView(plan, more, START, at(97)).timeUp).toBe(true);
  });
});
