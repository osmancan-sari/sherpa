import type {
  Block,
  Context,
  DayType,
  Energy,
  LifeMode,
  ModuleRow,
  Prompt,
  Rhythm,
  RhythmLog,
  Session,
  Task,
  WorkItem,
} from "@/core/types";

// The planner's input and output (docs/04-planlayici.md). Plain data in, a plan out: nothing
// here reads the database, the clock or the network. "Now" is a field of the input.

/** The settings row, read into the shape the planner works with (defaults filled in). */
export type PlannerSettings = {
  /** Wall-clock times in Istanbul, "HH:mm". */
  dayStart: string;
  finishLine: string;
  capacityFactors: Record<DayType, number>;
  slot: { deepMin: number; deepMax: number; lightMin: number; breakMin: number };
  defaultDayType: DayType;
  returnAfterDays: number;
};

/** A learned value (`planner_stats`): `est_multiplier:<module slug>:<task kind>`, `capacity:<day type>`. */
export type PlannerStat = { key: string; value: number; sample_size: number };

/** What the AI suggests for a day (`plan`, `replan`); the engine applies it within its rules. */
export type PlanAdvice = {
  top3?: string[];
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
  lifeMode: LifeMode;
  /** The day's first touch, or the default start. */
  dayStart: Date;
  finishLine: Date;
  /** The evening closing was done for this day: the screen is in its night state. */
  closed?: boolean;
  /** Fixed blocks of this day and the days after it (later days count for urgency). */
  blocks: Block[];
  /** Open tasks, and the ones finished recently (for the day's progress). */
  tasks: Task[];
  workItems: WorkItem[];
  rhythms: Rhythm[];
  rhythmLogs: RhythmLog[];
  /** Active modules only; work of other modules is not planned. */
  modules: ModuleRow[];
  /** The device's context: the second screen is `desk`; on the phone, what the user chose. */
  context: Context;
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
  /** The day's three, as fixed when the day was planned (days.top3). */
  top3?: string[];
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
};

export type MandatoryReason = "due_today" | "urgent" | "floor";

export type SlotKind = "deep" | "light" | "break";

export type Assignment = {
  candidate: Candidate;
  minutes: number;
  /** Short notes behind "neden?": the engine's and the AI's. */
  reasons: string[];
};

export type Slot = {
  start: Date;
  end: Date;
  minutes: number;
  kind: SlotKind;
  assignment: Assignment | null;
};

export type WarningKind = "deadline" | "floor" | "next_step" | "deferred_often" | "advice_rejected";

export type Warning = { kind: WarningKind; subjectId: string; text: string };

export type NowState =
  | { kind: "running"; session: Session; task: Task | null; rhythm: Rhythm | null }
  | { kind: "block"; block: Block }
  | { kind: "prompt"; prompt: Prompt }
  | { kind: "suggest"; assignment: Assignment }
  | { kind: "done"; finished: number; minutes: number }
  | { kind: "night" }
  | { kind: "return"; top3: Candidate[] }
  | { kind: "empty" };

export type Plan = {
  date: string;
  /** In time order; an assigned slot is cut to its work, the rest of it is a slot of its own. */
  slots: Slot[];
  /** The day's three (ids of tasks, work items or rhythms); mandatory ones come first. */
  top3: string[];
  /** How many of the three are finished. */
  top3Done: number;
  now: NowState;
  /** Candidates that did not fit: "vakit kalırsa". */
  overflow: Candidate[];
  warnings: Warning[];
  usableMinutes: number;
  plannedMinutes: number;
  /** Every candidate the day had, scored, best first. */
  candidates: Candidate[];
};
