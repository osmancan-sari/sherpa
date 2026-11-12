import type {
  Block,
  BlockSeries,
  DayRow,
  LifeModePeriod,
  ModuleRow,
  Prompt,
  Rhythm,
  RhythmLog,
  Session,
  Task,
  WorkItem,
} from "@/core/types";

// Row factories for unit tests: a complete row with sensible values, overridden where the test
// cares. Not used by the app.

let counter = 0;
/** A stable, readable, valid uuid per call. */
export function testId(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
}

const STAMP = "2026-11-10T09:00:00+00:00";
export const USER_ID = "11111111-1111-4111-8111-111111111111";
export const MODULE_ID = "22222222-2222-4222-8222-222222222222";

export function moduleRow(overrides: Partial<ModuleRow> = {}): ModuleRow {
  return {
    id: MODULE_ID,
    user_id: USER_ID,
    slug: "deneme",
    name: "Deneme",
    kind: "lifelong",
    status: "active",
    area_id: null,
    weight: 1,
    weekly_floor_minutes: 0,
    color: "#737373",
    starts_on: null,
    ends_on: null,
    end_condition: null,
    mode_behavior: {},
    settings: {},
    sort: 0,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export function task(overrides: Partial<Task> = {}): Task {
  return {
    id: testId(),
    user_id: USER_ID,
    module_id: MODULE_ID,
    work_item_id: null,
    title: "İş",
    kind: "task",
    est_minutes: 30,
    due_at: null,
    planned_date: null,
    energy: "light",
    context: "any",
    importance: 2,
    status: "todo",
    waiting_on: null,
    follow_up_on: null,
    position: null,
    source_type: null,
    source_id: null,
    meta: {},
    ai: null,
    done_at: null,
    defer_count: 0,
    timing: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: testId(),
    user_id: USER_ID,
    module_id: MODULE_ID,
    parent_id: null,
    key: null,
    title: "Kalem",
    status: "active",
    due_at: null,
    due_is_hard: false,
    earliest_at: null,
    effort_total_minutes: null,
    effort_done_minutes: 0,
    effort_min_minutes: null,
    effort_max_minutes: null,
    session_minutes: null,
    importance: 2,
    energy: null,
    context: null,
    depends_on: [],
    depends_on_keys: [],
    splittable: true,
    droppable: false,
    artifact_url: null,
    timing: null,
    provenance: {},
    ai: null,
    source_type: null,
    source_id: null,
    meta: {},
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export function rhythm(overrides: Partial<Rhythm> = {}): Rhythm {
  return {
    id: testId(),
    user_id: USER_ID,
    module_id: MODULE_ID,
    key: null,
    title: "Ritim",
    target_count: 2,
    period: "week",
    floor_count: 0,
    est_minutes: 15,
    energy: "light",
    context: "any",
    active: true,
    mode_targets: null,
    timing: null,
    provenance: {},
    source_type: null,
    source_id: null,
    meta: {},
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export function rhythmLog(rhythmId: string, doneOn: string): RhythmLog {
  return {
    id: testId(),
    user_id: USER_ID,
    rhythm_id: rhythmId,
    done_on: doneOn,
    session_id: null,
    created_at: STAMP,
    updated_at: STAMP,
  };
}

export function block(overrides: Partial<Block> = {}): Block {
  return {
    id: testId(),
    user_id: USER_ID,
    series_id: null,
    occurrence_on: null,
    module_id: null,
    key: null,
    title: "Blok",
    kind: "appointment",
    starts_at: "2026-11-12T06:00:00+00:00",
    ends_at: "2026-11-12T07:00:00+00:00",
    location: null,
    travel_before_min: 0,
    travel_after_min: 0,
    day_type: null,
    status: "planned",
    provenance: {},
    source_type: null,
    source_id: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export function blockSeries(overrides: Partial<BlockSeries> = {}): BlockSeries {
  return {
    id: testId(),
    user_id: USER_ID,
    module_id: null,
    title: "Ders",
    kind: "class",
    weekday: 1,
    start_time: "09:00:00",
    end_time: "11:00:00",
    location: null,
    travel_before_min: 0,
    travel_after_min: 0,
    day_type: null,
    valid_from: "2026-11-01",
    valid_to: null,
    source_type: null,
    source_id: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export function session(overrides: Partial<Session> = {}): Session {
  return {
    id: testId(),
    user_id: USER_ID,
    task_id: null,
    rhythm_id: null,
    module_id: null,
    title: null,
    started_at: "2026-11-12T07:00:00+00:00",
    ended_at: null,
    measured: true,
    confirmed_at: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export function prompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: testId(),
    user_id: USER_ID,
    module_id: MODULE_ID,
    kind: "attendance",
    question: "Derse girdin mi?",
    options: [
      { value: "yes", label: "Evet" },
      { value: "no", label: "Hayır" },
    ],
    subject_type: null,
    subject_id: null,
    ask_after: STAMP,
    status: "pending",
    answer: null,
    answered_at: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export function dayRow(overrides: Partial<DayRow> = {}): DayRow {
  return {
    id: testId(),
    user_id: USER_ID,
    date: "2026-11-12",
    day_type: null,
    life_mode: "normal",
    started_at: null,
    finish_line: null,
    top3: [],
    plan: null,
    plan_source: null,
    plan_reasons: null,
    closed_at: null,
    closing_note: null,
    woke_at: null,
    woke_estimated: false,
    bed_at: null,
    planned_wake: null,
    planned_bed: null,
    expected_wake: null,
    expected_bed: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export function lifeModePeriod(overrides: Partial<LifeModePeriod> = {}): LifeModePeriod {
  return {
    id: testId(),
    user_id: USER_ID,
    mode: "busy",
    starts_on: "2026-11-09",
    ends_on: "2026-11-15",
    note: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}
