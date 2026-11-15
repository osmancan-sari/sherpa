import type { FrameSettings } from "@/core/contract/frame";
import type { Timing } from "@/core/contract/timing";
import type {
  Block,
  Context,
  DayType,
  Energy,
  ModuleRow,
  Prompt,
  Rhythm,
  RhythmLog,
  Session,
  Task,
  WakeSource,
  WorkItem,
} from "@/core/types";

// The planner's input and output (docs/04-planlayici.md). Plain data in, a plan out: nothing
// here reads the database, the clock or the network. "Now" is a field of the input.

/** The settings row, read into the shape the planner works with (defaults filled in). */
export type PlannerSettings = {
  /** Wall-clock times in Istanbul, "HH:mm". */
  dayStart: string;
  /**
   * Ç4a: where a day's work runs to when nothing better is known: the start of the bedtime range
   * (the frame's, else the default frame's). Not a setting: the user sets no finish line.
   */
  bedtime: string;
  capacityFactors: Record<DayType, number>;
  slot: { deepMin: number; deepMax: number; lightMin: number; breakMin: number };
  defaultDayType: DayType;
  returnAfterDays: number;
  /** The day's frame (Ç3c); null: off, the planner works as in Ç3b. */
  frame: FrameSettings | null;
  /**
   * Where each day's work starts (instants in ms by day key), when the frame knows better than
   * `dayStart`: today from the waking, tomorrow from its expected waking, the days after from
   * their latest waking. Day capacities read it.
   */
  dayStarts?: Record<string, number>;
  /**
   * Ç4a: where each day's work ends (instants in ms by day key), when the frame knows: its
   * bedtime less its bed-bound work. Days without an entry end at `bedtime`.
   */
  dayEnds?: Record<string, number>;
};

/** A learned value (`planner_stats`): `est_multiplier:<module slug>:<task kind>`, `capacity:<day type>`. */
export type PlannerStat = { key: string; value: number; sample_size: number };

/**
 * What the AI suggests for a day (`plan`, `replan`); the engine applies it within its rules.
 * Ç4a: a `top3` in advice stored before is read past (the day's three are gone).
 */
export type PlanAdvice = {
  prefer?: string[];
  defer?: string[];
  /** Why, per id; shown behind "neden?". */
  reasons?: Record<string, string>;
};

export type PlanInput = {
  now: Date;
  /** The day being planned, `yyyy-MM-dd` in Istanbul. */
  date: string;
  dayType: DayType;
  /** The day's first touch, or the default start. */
  dayStart: Date;
  /**
   * Ç4a: tonight's expected bedtime: with the frame its `bed`, else the default bedtime range's
   * start. The working window runs to it, less the bed-bound work; there is no finish line.
   */
  bedtime: Date;
  /** The evening closing was done for this day: the screen is in its night state. */
  closed?: boolean;
  /** The day's frame (Ç3c): waking, bedtime, the sleep plans. Absent when the frame is off. */
  frame?: DayFrame;
  /** Fixed blocks of this day and the days after it (later days count for urgency). */
  blocks: Block[];
  /** Open tasks, and the ones finished recently (for the day's progress). */
  tasks: Task[];
  workItems: WorkItem[];
  rhythms: Rhythm[];
  rhythmLogs: RhythmLog[];
  /** Active modules only; work of other modules is not planned. */
  modules: ModuleRow[];
  /**
   * Where the device is (Ç4a): the second screen is `desk`; on the phone it is inferred
   * (`inferContext`). Null: unknown, the context filter is off and every work is a candidate.
   */
  context: Context | null;
  settings: PlannerSettings;
  stats: PlannerStat[];
  /** Minutes worked this week per module id (sessions), for the weekly floors. */
  spentThisWeek?: Record<string, number>;
  /** This week's committed work items; null when the week has no plan yet. */
  committed?: string[] | null;
  /**
   * Each committed item's share of the week and its done effort when it was committed: once
   * the share is worked, the item waits for next week (no warning, not offered).
   */
  shares?: Record<string, WeekShare>;
  /**
   * Ç4a: of `skipped`, what was put off on the day itself ("Ertele"), not what the evening
   * closing took out of it beforehand. Absent: all of `skipped` counts.
   */
  skippedToday?: string[];
  /** Put off for today with "Ertele" (work items and rhythms; tasks move to tomorrow instead). */
  skipped?: string[];
  openSession?: Session | null;
  /** The event question due now, if any. */
  prompt?: Prompt | null;
  /** The last touch before this day started; for the "return" state. */
  lastSeenAt?: Date | null;
  /** A session was started on this day already. */
  startedToday?: boolean;
  advice?: PlanAdvice;
};

export type WeekShare = { minutes: number; from: number };

/** Why a night's sleep is under its target (docs/04-planlayici.md, "Uyku planı"). */
export type ShortSleep = "obligation" | "late_bed" | "early_wake";

/** One night and the morning after it. */
export type SleepPlan = {
  /** The latest waking the morning's first obligation allows (or the range's end). */
  latestWake: Date;
  /** The planned waking: the user's own value, else the latest, pulled earlier by the load. */
  wake: Date;
  /** The planned bedtime: the waking minus the sleep target, inside the bedtime range. */
  bed: Date;
  /** The waking the day is planned with when none is recorded: a real bedtime moves it. */
  expectedWake: Date;
  /** Expected sleep: the expected waking minus the bedtime (real or planned). */
  sleepMinutes: number;
  short: ShortSleep | null;
};

/** The day's frame as the planner reads it (Ç3c). */
export type DayFrame = {
  /** Recorded waking, else the user's value for the day, else the sleep plan's. */
  wake: Date;
  /** A waking is recorded (by "Uyandım", or estimated from the first touch). */
  woke: boolean;
  estimated: boolean;
  /**
   * Ç3g: where the recorded waking came from: a screen ("Uyandım", "Biraz önce"), outside
   * (`core/wake`), or the first touch ('estimate'). Null without a waking. A waking written
   * before the source was kept reads as a screen's.
   */
  wokeFrom?: WakeSource | null;
  /** Recorded bedtime, else the user's value for the night, else the sleep plan's. */
  bed: Date;
  bedAt: Date | null;
  /** Ç3g: the start of tonight's bedtime range ("Yatıyorum" long before it asks first). */
  bedStart?: Date;
  /** The end of tonight's bedtime range: the night state comes then at the latest. */
  bedEnd: Date;
  /** The morning state lasts until then (an hour after the waking range). */
  morningUntil: Date;
  /** Last night and this morning. */
  lastNight: SleepPlan;
  /** Tonight and tomorrow morning. */
  tonight: SleepPlan;
};

export type CandidateType = "task" | "item" | "rhythm" | "follow_up";

export type Candidate = {
  type: CandidateType;
  /** The task, work item or rhythm; for a follow-up, the waiting task. */
  id: string;
  title: string;
  moduleId: string;
  /** Planned length: the estimate times the learned multiplier. */
  minutes: number;
  energy: Energy;
  context: Context;
  dueAt: string | null;
  importance: number;
  createdAt: string;
  score: number;
  /** Why it must be done today; null when it is not mandatory. */
  mandatory: MandatoryReason | null;
  /** Rhythms: "1/3". */
  progress?: string;
  task?: Task;
  item?: WorkItem;
  rhythm?: Rhythm;
  /** Its time constraints (a sitting's own, else its item's); absent when it has none. */
  timing?: Timing;
  /** Travel on this device, in minutes; absent without timing, 0 in the work's own context. */
  travelBefore?: number;
  travelAfter?: number;
};

export type MandatoryReason = "due_today" | "urgent" | "floor";

export type SlotKind = "deep" | "light" | "break";

export type Assignment = {
  candidate: Candidate;
  /** Minutes of work; the slot is the work, travel lies before and after it. */
  minutes: number;
  /** Travel around the work, when it has any (not counted against capacity, not measured). */
  travelBefore?: number;
  travelAfter?: number;
  /** Short notes behind "neden?": the engine's and the AI's. */
  reasons: string[];
};

export type Slot = {
  start: Date;
  end: Date;
  minutes: number;
  kind: SlotKind;
  assignment: Assignment | null;
  /** Outside the working window (Ç3c): wake-bound work, bed-bound work (Ç4a: no evening). */
  part?: "wake" | "bed";
};

export type WarningKind =
  | "deadline"
  | "no_time_today"
  | "no_time_week"
  | "floor"
  | "next_step"
  | "deferred_often"
  | "advice_rejected";

export type Warning = {
  kind: WarningKind;
  subjectId: string;
  text: string;
  /** The module of the work the warning is about. */
  moduleId?: string;
};

export type NowState =
  | { kind: "running"; session: Session; task: Task | null; rhythm: Rhythm | null }
  | { kind: "block"; block: Block }
  | { kind: "prompt"; prompt: Prompt }
  /** `at`: the work is bound to its time and its footprint starts later (the card says when). */
  | { kind: "suggest"; assignment: Assignment; at?: Date }
  | { kind: "done"; finished: number; minutes: number }
  | { kind: "night" }
  /** Ç3c: the day has begun and nobody said "Uyandım"; `first` is the first wake-bound work. */
  | { kind: "morning"; first: Assignment | null }
  /**
   * Ç3c: the evening: the working window is over (Ç4a: it ends where the bed-bound work begins,
   * else at the expected bedtime), or the day was closed; before bed. `next` is the bed-bound
   * work once it is due.
   */
  | {
      kind: "evening";
      next: Assignment | null;
      closed: boolean;
      /**
       * Ç3g: bed-bound work not offered yet (more than BED_LEAD minutes before its place) and when
       * it is planned; null when there is none, or when it is `next`.
       */
      later?: { assignment: Assignment; at: Date } | null;
    }
  /** Ç4a: back after days away: the day's next work and "Başla". */
  | { kind: "return"; next: Assignment | null }
  | { kind: "empty" };

export type Plan = {
  date: string;
  /**
   * In time order; an assigned slot is cut to its work, the rest of it is a slot of its own.
   * Ç4a: the plan is the day's rest ("Sıradakiler"); work that does not fit is not kept aside.
   */
  slots: Slot[];
  now: NowState;
  warnings: Warning[];
  usableMinutes: number;
  plannedMinutes: number;
  /** Every candidate the day had, scored, best first. */
  candidates: Candidate[];
  /** The day's frame (Ç3c): where its parts begin and end. Absent when the frame is off. */
  frame?: {
    wake: Date;
    /** Where the working window begins: the waking plus the wake-bound work. */
    workStart: Date;
    /** Ç4a: where the working window ends: the bedtime minus the bed-bound work. */
    workEnd: Date;
    bed: Date;
  };
};
