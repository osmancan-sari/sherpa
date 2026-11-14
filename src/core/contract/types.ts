import type { ComponentType, ReactNode } from "react";
import type { ZodType } from "zod";
import type { Extractor } from "@/core/ai/calls/extract";
import type { Timing } from "./timing";
import type {
  AppEvent,
  Context,
  Db,
  Energy,
  LifeMode,
  ModuleKind,
  ModuleRow,
  Period,
  Rhythm,
  RhythmLog,
  Task,
  WorkItem,
} from "@/core/types";

// The module contract (docs/06-modul-sozlesmesi.md). Everything a module gives the core, and
// everything the core gives a module, is typed here. The core never imports a module; it only
// walks the definitions it is handed.

// ---------------------------------------------------------------------------------------------
// Work envelope
// ---------------------------------------------------------------------------------------------

export type ProposalWhen = {
  /** Deadline form: becomes a work item. */
  due?: string | null;
  hard?: boolean | null;
  earliest?: string | null;
  /** Recurrence form: becomes a rhythm. */
  recurrence?: { count: number; period: Period; floor?: number } | null;
  /** Fixed-time form: becomes a block. */
  fixed?: { starts_at: string; ends_at: string; location?: string | null } | null;
};

export type WorkProposal = {
  schema: 1;
  /** Unique and stable inside the module: the same key never opens a second record. */
  key: string;
  /** The module's own record this work comes from. */
  source: { type: string; id: string };
  title: string;
  when?: ProposalWhen;
  effort?: {
    total_minutes?: number | null;
    session_minutes?: number | null;
    bounds?: { min: number; max: number } | null;
  };
  fit?: { energy?: Energy | null; context?: Context | null };
  importance?: 1 | 2 | 3 | 4 | null;
  /** Keys of other proposals of the same module that must be finished first. */
  depends_on?: string[];
  flex?: { splittable?: boolean | null; droppable?: boolean | null };
  artifact?: string | null;
  /** Module-specific; the core carries it and hands it to the AI as context, nothing more. */
  meta?: Record<string, unknown>;
  /** When the work can be done (Ç3b): windows, preferred and avoided hours, travel, rest days. */
  timing?: Timing | null;
  /**
   * Ç3e: the key of the module's facet the work is in. Only a module with facets gives one, and
   * it must be in the module's list when proposed. A fact: an empty one clears it.
   */
  facet?: string | null;
};

export type { Timing, TimeWindow } from "./timing";

export type ProposalTarget = "work_item" | "rhythm" | "block";

export type ProposalResult = {
  target: ProposalTarget;
  id: string;
  /** True when this key had no record before. */
  created: boolean;
  /** Fields this proposal changed. */
  changed: string[];
  /** Fields the proposal wanted to change but the user owns. */
  kept: string[];
};

/** What happened to a proposed work item, told to the module that proposed it. */
export type Outcome = {
  key: string;
  source: { type: string | null; id: string | null };
  result: "done" | "dropped";
  estimatedMinutes: number | null;
  spentMinutes: number;
  sessionCount: number;
  /** How many times it was put off. Always 0 until "Ertele" exists (Ç3). */
  postponedCount: number;
};

// ---------------------------------------------------------------------------------------------
// Context: what the core hands a module
// ---------------------------------------------------------------------------------------------

export type PromptRequest = {
  kind: string;
  question: string;
  options: { value: string; label: string }[];
  subject?: { type: string; id: string };
  /** Show from this moment on; default: now. */
  askAfter?: Date;
};

export type RhythmProgress = { rhythm: Rhythm; done: number; target: number; debt: number };

/** A day's waking and bedtime as a module reads them (Ç3c, `ctx.days`). */
export type DayFrameRecord = {
  date: string;
  wokeAt: string | null;
  /** "Uyandım" was not said: the first touch of the day stands for it. */
  wokeEstimated: boolean;
  bedAt: string | null;
  /** What the sleep plan chose ("HH:mm"). */
  plannedWake: string | null;
  plannedBed: string | null;
};

export type ModuleContext = {
  /** The module's row: id, status, its saved settings. */
  module: ModuleRow;
  /** Database access for the module's own tables. Core tables are written through `propose`. */
  db: Db;
  now: () => Date;
  /** Creates the work, or updates it when the key already exists. */
  propose: (proposal: WorkProposal) => Promise<ProposalResult>;
  /** Takes the work back when its source record is gone. */
  withdraw: (key: string) => Promise<void>;
  /** Publishes one of the events the module declares in `emits`. */
  emit: (type: string, payload?: Record<string, unknown>) => Promise<void>;
  /** Asks the user one question after an event; the answer arrives as `core.prompt_answered`. */
  ask: (prompt: PromptRequest) => Promise<void>;
  /** The module's own work as the core holds it (read only). */
  work: {
    items: () => Promise<WorkItem[]>;
    tasks: () => Promise<Task[]>;
    rhythms: () => Promise<RhythmProgress[]>;
    rhythmLogs: (sinceDay: string) => Promise<RhythmLog[]>;
  };
  /** Saves the module's settings (modules.settings). */
  saveSettings: (settings: Record<string, unknown>) => Promise<void>;
  /** Ç3c: the days' waking and bedtime from this day on (read only). */
  days: (sinceDay: string) => Promise<DayFrameRecord[]>;
};

/** What one of the module's extractors made of a text (docs/10-yapay-zeka.md, `extract`). */
export type ExtractResult<T> =
  | { status: "ok"; suggestions: T[]; note: string | null }
  /**
   * No suggestions: the AI is off or used up ("skipped"), it failed or the server could not be
   * reached ("failed"), or the module has no active extractor of that key ("unknown").
   */
  | { status: "skipped" | "failed" | "unknown"; reason?: string };

/** The context of a quick action or a module screen: the data context plus what the shell can do. */
export type ModuleUiContext = ModuleContext & {
  /** Opens quick add on one of the module's intake types. */
  openIntake: (key: string) => void;
  /**
   * Reads pasted text with one of the module's `extractors`. Nothing is written; the module
   * decides what the suggestions become. Without the AI the answer is "skipped".
   */
  extract: <T>(
    extractor: string,
    text: string,
    options?: { publishedAt?: string | null; context?: Record<string, unknown> },
  ) => Promise<ExtractResult<T>>;
  /** Goes to a path under /m/<slug>/. */
  navigate: (path: string) => void;
  /** Ç3c: speaks on this device (silent when the voice is off); everything said is also shown. */
  say: Say;
};

// ---------------------------------------------------------------------------------------------
// Scene (Ç3c): the module's face on the Today screen while its work runs
// ---------------------------------------------------------------------------------------------

/** Ç3c: the voice (docs/06-modul-sozlesmesi.md, "Sesli anlatım"). Never throws. */
export type Say = (text: string, options?: { interrupt?: boolean }) => void;

/** The day in short, for a scene or a narration (read only). */
export type TodayBrief = {
  /** The day's three. */
  top: { title: string; module: string; reason: string | null }[];
  /** Today's fixed blocks. */
  blocks: { title: string; startsAt: Date; endsAt: Date }[];
  finishLine: Date;
  wokeAt: Date | null;
  /** Ç3f: today's evening closing was done. */
  closed: boolean;
};

/**
 * Ç3f: the day's wake-bound or bed-bound work as one list (docs/06-modul-sozlesmesi.md,
 * "Diziler"). Another module's row carries only these fields: no source, no meta.
 */
export type SceneChain = {
  anchor: "wake" | "bed";
  items: {
    /** The task or the rhythm. */
    id: string;
    title: string;
    module: { slug: string; name: string };
    facet: { key: string; name: string } | null;
    /** The resolved colour (docs/06, "Bölümler" rule 4). */
    color: string;
    minutes: number;
    /** Done today, running, still to do, passed today (put off, or its time went by). */
    state: "done" | "running" | "next" | "passed";
    /** The work of this scene's module. */
    mine: boolean;
  }[];
};

/** The running work a scene is for. */
export type SceneSubject =
  { kind: "task"; task: Task; workItem: WorkItem | null } | { kind: "rhythm"; rhythm: Rhythm };

export type SceneProps = {
  subject: SceneSubject;
  /** From the session's stored start: the same on every device. */
  session: { id: string; startedAt: Date; elapsedSeconds: number };
  device: "pano" | "telefon";
  /** The core's session, the only way a scene acts on it. */
  controls: {
    finish: () => Promise<void>;
    stop: () => Promise<void>;
    /** Opens "Takıldım" on the standard card (leaves the scene). */
    stuck: () => void;
    /** Leaves the scene; the session goes on. */
    exit: () => void;
    /** Ç3f: opens the evening closing inside the scene; back to the scene when it is done. */
    closing: () => void;
    /** Ç3f: "Yatıyorum": tonight's bedtime is now; the session ends as done. */
    bed: () => Promise<void>;
  };
  say: Say;
  today: TodayBrief;
  ctx: ModuleUiContext;
  /** Ç3e: the running work's facet (its colour resolved); null when it has none. */
  facet: { key: string; name: string; color: string } | null;
  /** Ç3f: the chain the running work is part of; null when it is in none. */
  chain: SceneChain | null;
  /**
   * Rutin 1: tonight's bedtime this scene's `controls.bed()` wrote, while it can still be taken
   * back (10 minutes). Meanwhile the scene stays on the night screen, on every screen and after a
   * reload, with no strip (nothing runs). `undo` takes it back ("Geri al"): the bedtime is gone,
   * the session runs again and the scene goes on where it stood. "expired" and "changed" (the
   * bedtime was written another way, or another work started since) change nothing. Meanwhile
   * there is no running work: `finish`, `stop`, `stuck`, `exit` and `closing` do nothing (the
   * session is closed; a second `bed()` writes the bedtime again). Null otherwise.
   */
  bedtime: { at: Date; until: Date; undo: () => Promise<BedUndo> } | null;
};

/** Rutin 1: what taking back a scene's bedtime did. */
export type BedUndo = "undone" | "expired" | "changed";

/** Ç3e: a part of a module with its own colour and scene on the main screen (docs/06, "Bölümler"). */
export type ModuleFacet = {
  /** Unique in the module; lower-case letters, digits and dashes, at most 40: 'sabah', 'yzv406e'. */
  key: string;
  /** 'Sabah', 'YZV406E Derin Öğrenme' */
  name: string;
  /** #rrggbb; the facet's default colour, the user may change it. */
  color: string;
  /** Key of a scene in `ui.scenes`. */
  scene?: string;
  /** The scene frame's tone; without it, the scene's own. */
  tone?: "calm" | "focus" | "energy";
};

export type ModuleScene = {
  /** Whether this work has a scene (by its kind, source or meta). An error means no scene. */
  when: (subject: SceneSubject) => boolean;
  component: ComponentType<SceneProps>;
  /** The tone of the core's transition and background. */
  look?: { tone: "calm" | "focus" | "energy" };
};

// ---------------------------------------------------------------------------------------------
// Definition
// ---------------------------------------------------------------------------------------------

export type Health = "ok" | "attention" | "behind";

export type ChipData = {
  /** 'teslim Cuma', 'süpürme 1/2' */
  text: string;
  health: Health;
};

export type Alert = {
  key: string;
  text: string;
  /** One action per alert: a label and where it leads (a path under the app). */
  action?: { label: string; href: string };
};

export type NowCardContent = {
  /** A line under the title: what exactly to work on. */
  detail?: string;
  /** Extra actions next to the core's own (links into the module). */
  links?: { label: string; href: string }[];
};

export type FieldSpec = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  required?: boolean;
  default?: string | number;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
};

export type IntakeType = {
  /** 'assessment', 'grade', 'weigh_in' */
  key: string;
  /** Name shown in quick add. */
  label: string;
  /** The first text field also receives what was typed into the quick add box. */
  fields: FieldSpec[];
  /** Example sentences for the router (Ç2). */
  examples: string[];
  handle: (values: Record<string, unknown>, ctx: ModuleContext) => Promise<void>;
};

/**
 * Hook for structured blocks pasted into quick add (for example the fenced `sherpa` block a
 * Claude project prints). The first module whose `match` accepts the payload handles it;
 * no AI call is involved.
 */
export type StructuredBlockHandler = {
  key: string;
  match: (payload: unknown) => boolean;
  handle: (payload: unknown, ctx: ModuleContext) => Promise<void>;
};

/**
 * Ç3d: data from outside (the phone's automation, a collector on the computer), posted to
 * /api/ingest/<slug>/<kind> with a device token whose scopes hold "<slug>/<kind>". It runs on the
 * server with the server context: the token owner's rows only (docs/06-modul-sozlesmesi.md,
 * "Sunucu zemini").
 */
export type IngestType = {
  /** Lower-case letters, digits and dashes; unique in the module. */
  kind: string;
  /** The name shown when a token's scopes are chosen. */
  label?: string;
  /** The body; one that does not pass is refused with 400 and the field's name. */
  schema: ZodType;
  /** Gets the body as the schema parsed it. Should be idempotent: the same body may come twice. */
  handle: (payload: unknown, ctx: ModuleContext) => Promise<void>;
};

/** Ç3d: work the module does on its own, also while the app is closed. */
export type ModuleJob = {
  /** Lower-case letters, digits and dashes; unique in the module. */
  key: string;
  every: "hour" | "day" | "week";
  /** "HH:mm", Istanbul; for "day" and "week" only ("week": Monday). Default 00:00. */
  at?: string;
  /** Runs once per period; may be retried, so it must be idempotent. */
  run: (ctx: ModuleContext) => Promise<void>;
};

export type ModeBehavior = {
  /** Multiplier on the module's weight in the planner. */
  weightMultiplier: number;
  /** How much of the weekly floor is kept (0 to 1). */
  floorMultiplier: number;
  /** What the module does in this mode (shown to the user). */
  note?: string;
};

export type DateRange = { from: string; to: string };

export type ModuleReport = {
  metrics: { label: string; value: string }[];
  /** At most 2. */
  suggestions: string[];
};

/** Props every module screen receives. */
export type ModuleViewProps = {
  /** Path segments after the matched part of /m/<slug>/…; route params for sub pages. */
  params: Record<string, string>;
};

export type ModuleTab = { key: string; label: string; component: ComponentType<ModuleViewProps> };

export type ModuleRoute = {
  /** Path under /m/<slug>/, with `:name` segments: 'kayit/:id'. */
  path: string;
  title?: string;
  component: ComponentType<ModuleViewProps>;
};

export type ModuleFullscreen = {
  key: string;
  label: string;
  component: ComponentType<ModuleViewProps>;
};

export type ModuleAction = {
  key: string;
  label: string;
  run: (ctx: ModuleUiContext) => void | Promise<void>;
};

export type ModuleUi = {
  /** Body of the module page; the first tab is the default. At least one. */
  tabs: ModuleTab[];
  /** Sub pages under /m/<slug>/. */
  routes?: ModuleRoute[];
  /** Views that hide the app shell: /m/<slug>/tam/<key>. */
  fullscreen?: ModuleFullscreen[];
  /** Quick actions in the bar at the top of the module page. */
  actions?: ModuleAction[];
  /** The module's own settings form: /ayarlar/moduller/<slug>. */
  settings?: ComponentType;
  /** Region 4 of the page, "history and trend". Without it the core shows time spent per week. */
  history?: ComponentType;
  /** Ç3c: takes over the Today screen while the module's work runs. */
  scene?: ModuleScene;
  /** Ç3e: named scenes the module's facets choose from (`ModuleFacet.scene`). */
  scenes?: Record<string, ModuleScene>;
};

export type ModuleDefinition = {
  slug: string;
  name: string;
  kind: ModuleKind;
  /** Slug of the area the module belongs to, if any. */
  area?: { slug: string; name: string };
  /** #rrggbb; the default. Copied into the module's row when it is set up; the user's after that. */
  color: string;
  /**
   * Ç3e: the module's facets, fixed or from its data (one per course). Computed with the module's
   * context and refreshed when data changes, like the chip. Absent: the module has no facets.
   */
  facets?: (ctx: ModuleContext) => Promise<ModuleFacet[]>;

  // 1. What it gives the main screen
  chip: (ctx: ModuleContext) => Promise<ChipData>;
  nowCard?: (task: Task) => NowCardContent | null;
  alerts?: (ctx: ModuleContext) => Promise<Alert[]>;

  // 2. Which entries it accepts
  intake: IntakeType[];
  blocks?: StructuredBlockHandler[];

  // 3. Events
  emits: string[];
  on?: Record<string, (event: AppEvent, ctx: ModuleContext) => Promise<void>>;

  // 4. Reaction to the life mode
  modeBehavior: Record<LifeMode, ModeBehavior>;

  // 5. Weekly report
  weeklyReport: (ctx: ModuleContext, week: DateRange) => Promise<ModuleReport>;

  // 6. Life cycle
  onActivate?: (ctx: ModuleContext) => Promise<void>;
  onArchive?: (ctx: ModuleContext) => Promise<void>;

  // Work envelope
  /** Short text with the module's own effort hints, given to the AI (Ç2). */
  sizingHints?: string;
  /**
   * Readers of pasted free text (an announcement, an e-mail): what to look for and the shape of
   * one suggestion. The core runs the `extract` call; the module decides what the suggestions
   * become.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each reader has its own item
  extractors?: Extractor<any>[];
  onOutcome?: (outcome: Outcome, ctx: ModuleContext) => Promise<void>;

  /** The module's own tables; "export everything" includes them. */
  tables?: string[];

  // While the app is closed (Ç3d)
  /** Data from outside: POST /api/ingest/<slug>/<kind>. */
  ingest?: IngestType[];
  /** Scheduled work, run by the core's scheduler. */
  jobs?: ModuleJob[];

  // Interface
  ui: ModuleUi;
};

export type ModuleRegistry = {
  list: readonly ModuleDefinition[];
  get: (slug: string) => ModuleDefinition | undefined;
};

export type { ReactNode };
