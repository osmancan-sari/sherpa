import type { ComponentType, ReactNode } from "react";
import type { Extractor } from "@/core/ai/calls/extract";
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
};

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
};

/** The context of a quick action or a module screen: the data context plus what the shell can do. */
export type ModuleUiContext = ModuleContext & {
  /** Opens quick add on one of the module's intake types. */
  openIntake: (key: string) => void;
  /** Goes to a path under /m/<slug>/. */
  navigate: (path: string) => void;
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
};

export type ModuleDefinition = {
  slug: string;
  name: string;
  kind: ModuleKind;
  /** Slug of the area the module belongs to, if any. */
  area?: { slug: string; name: string };
  color: string;

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

  // Interface
  ui: ModuleUi;
};

export type ModuleRegistry = {
  list: readonly ModuleDefinition[];
  get: (slug: string) => ModuleDefinition | undefined;
};

export type { ReactNode };
