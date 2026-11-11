import { type Plan, type PlanInput, wholeDaySlotMinutes } from "@/core/planner";
import { type StoredDayPlan, storedPlan } from "@/core/planner/input";
import { sittingChanges, type WeekPlan } from "@/core/planner/week";
import {
  check,
  type DayRow,
  type Db,
  type LifeMode,
  type LifeModePeriod,
  type PlannerStatRow,
  type Task,
  toJson,
  unwrap,
  type WeekPlanRow,
  type WorkItem,
} from "@/core/types";
import { shiftDay } from "@/lib/date";

// What the planner keeps: the day's record (its first touch, plan, three, closing), the week's
// commitment and its sittings, life mode periods and learned values. The planner itself is pure
// (src/core/planner/); these functions only write what it decided.

// --- Days ------------------------------------------------------------------------------------

/** Day records from the given day on. */
export async function listDays(db: Db, sinceDay: string): Promise<DayRow[]> {
  return unwrap(await db.from("days").select("*").gte("date", sinceDay).order("date"));
}

async function getDay(db: Db, date: string): Promise<DayRow | null> {
  const { data, error } = await db.from("days").select("*").eq("date", date).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

type PlanSource = "closing" | "ai" | "auto";

/** What a day is planned in: the input's day, its type and mode (docs/03, `days`). */
export type PlannedDay = Pick<
  PlanInput,
  "date" | "dayType" | "lifeMode" | "dayStart" | "finishLine" | "blocks" | "settings"
>;

/**
 * The record's columns for a plan: its three, the day's type and mode, and what the day held.
 * The day's slot minutes are the whole day's (start to finish line), kept from the first
 * record: the capacity learning divides the day's work by them.
 */
function planColumns(
  plan: Plan,
  day: PlannedDay,
  previous: DayRow | null,
  extra: Partial<StoredDayPlan>,
) {
  const stored = storedPlan(previous);
  const kept: StoredDayPlan = {
    ...stored,
    ...extra,
    version: 1,
    slotMinutes: stored.slotMinutes ?? wholeDaySlotMinutes(day),
  };
  return {
    date: day.date,
    top3: plan.top3,
    day_type: day.dayType,
    life_mode: day.lifeMode,
    plan: toJson(kept),
  };
}

/**
 * Today's plan when the day has none yet (no closing, no AI): the engine's (`plan_source =
 * auto`). The record is read again first, so a plan written meanwhile (on the other screen)
 * is never replaced. The first touch is not written here: the screen may be on all night.
 */
export async function planDay(db: Db, input: { plan: Plan; day: PlannedDay }): Promise<DayRow> {
  const current = await getDay(db, input.day.date);
  if (current?.plan_source) return current;
  return unwrap(
    await db
      .from("days")
      .upsert(
        { ...planColumns(input.plan, input.day, current, {}), plan_source: "auto" },
        { onConflict: "user_id,date" },
      )
      .select()
      .single(),
  );
}

/**
 * The day's first touch (docs/04-planlayici.md, `dayStart`): the moment the user first did
 * something on a screen that day. Written once.
 */
export async function touchDay(db: Db, date: string, now: Date): Promise<void> {
  const current = await getDay(db, date);
  if (current?.started_at) return;
  if (current) {
    check(
      await db
        .from("days")
        .update({ started_at: now.toISOString() })
        .eq("id", current.id)
        .is("started_at", null),
    );
    return;
  }
  check(
    await db
      .from("days")
      .upsert(
        { date, started_at: now.toISOString() },
        { onConflict: "user_id,date", ignoreDuplicates: true },
      ),
  );
}

/** A new plan for a day: "Yeniden planla", the AI's plan, the evening closing. */
export async function saveDayPlan(
  db: Db,
  input: {
    plan: Plan;
    day: PlannedDay;
    source: PlanSource;
    stored?: Partial<StoredDayPlan>;
    reasons?: Record<string, string> | null;
  },
): Promise<DayRow> {
  const previous = await getDay(db, input.day.date);
  return unwrap(
    await db
      .from("days")
      .upsert(
        {
          ...planColumns(input.plan, input.day, previous, input.stored ?? {}),
          plan_source: input.source,
          ...(input.reasons === undefined ? {} : { plan_reasons: toJson(input.reasons) }),
        },
        { onConflict: "user_id,date" },
      )
      .select()
      .single(),
  );
}

/** "Ertele" on a work item or a rhythm: off today's list (tasks move to tomorrow instead). */
export async function skipToday(db: Db, date: string, id: string): Promise<void> {
  const stored = storedPlan(await getDay(db, date));
  const skipped = [...new Set([...(stored.skipped ?? []), id])];
  check(
    await db
      .from("days")
      .upsert({ date, plan: toJson({ ...stored, skipped }) }, { onConflict: "user_id,date" }),
  );
}

/** The evening closing: tomorrow's plan is confirmed and today is closed (night state). */
export async function closeDay(
  db: Db,
  input: {
    today: string;
    now: Date;
    /** Tomorrow's plan as confirmed; `stored` keeps what was taken out and the AI's advice. */
    tomorrow: { plan: Plan; day: PlannedDay; stored?: Partial<StoredDayPlan> };
    note: string | null;
    reasons?: Record<string, string> | null;
  },
): Promise<void> {
  await saveDayPlan(db, {
    plan: input.tomorrow.plan,
    day: input.tomorrow.day,
    source: "closing",
    stored: input.tomorrow.stored ?? {},
    reasons: input.reasons,
  });
  check(
    await db
      .from("days")
      .upsert(
        { date: input.today, closed_at: input.now.toISOString(), closing_note: input.note },
        { onConflict: "user_id,date" },
      ),
  );
}

/**
 * Back after days away (docs/04-planlayici.md, "Geri dönüş"): the days planned for the time
 * missed are forgotten, and the usual rules spread the work again.
 */
export async function clearPastPlannedDays(db: Db, today: string): Promise<void> {
  check(
    await db
      .from("tasks")
      .update({ planned_date: null })
      .lt("planned_date", today)
      .in("status", ["todo", "waiting"]),
  );
}

// --- Tasks: put off, waiting -----------------------------------------------------------------

/**
 * "Ertele": tomorrow, and one more time put off. A sitting takes its work item off today's list
 * with it: the item's other sittings wait too.
 */
export async function deferTask(
  db: Db,
  task: Pick<Task, "id" | "defer_count" | "work_item_id">,
  today: string,
): Promise<Task> {
  const deferred = unwrap(
    await db
      .from("tasks")
      .update({ planned_date: shiftDay(today, 1), defer_count: task.defer_count + 1 })
      .eq("id", task.id)
      .select()
      .single(),
  );
  if (task.work_item_id) await skipToday(db, today, task.work_item_id);
  return deferred;
}

/** Days until a waiting task asks to be followed up. */
export const FOLLOW_UP_DAYS = 3;

/**
 * "Birini bekliyorum": the task waits; a short reminder comes on its follow-up day. A sitting
 * puts its whole work item on hold: the item cannot go on while its step waits.
 */
export async function waitOnTask(
  db: Db,
  task: Pick<Task, "id" | "work_item_id">,
  waitingOn: string | null,
  today: string,
): Promise<Task> {
  const waiting = unwrap(
    await db
      .from("tasks")
      .update({
        status: "waiting",
        waiting_on: waitingOn,
        follow_up_on: shiftDay(today, FOLLOW_UP_DAYS),
      })
      .eq("id", task.id)
      .select()
      .single(),
  );
  if (task.work_item_id) {
    check(
      await db
        .from("work_items")
        .update({ status: "waiting" })
        .eq("id", task.work_item_id)
        .eq("status", "active"),
    );
  }
  return waiting;
}

/** The follow-up: the answer came (the task, and its item, are back), or still waiting. */
export async function answerFollowUp(
  db: Db,
  task: Pick<Task, "id" | "work_item_id">,
  came: boolean,
  today: string,
): Promise<Task> {
  const patch = came
    ? { status: "todo" as const, waiting_on: null, follow_up_on: null }
    : { follow_up_on: shiftDay(today, FOLLOW_UP_DAYS) };
  const row = unwrap(await db.from("tasks").update(patch).eq("id", task.id).select().single());
  if (came && task.work_item_id) {
    check(
      await db
        .from("work_items")
        .update({ status: "active" })
        .eq("id", task.work_item_id)
        .eq("status", "waiting"),
    );
  }
  return row;
}

// --- The week --------------------------------------------------------------------------------

export async function listWeekPlans(db: Db, sinceWeek: string): Promise<WeekPlanRow[]> {
  return unwrap(
    await db.from("week_plans").select("*").gte("week_start", sinceWeek).order("week_start"),
  );
}

/**
 * Writes a week's commitment and makes its sittings real: missing ones are opened, the ones the
 * week no longer needs are dropped (running and waiting ones are never touched). With `only`,
 * the sittings of those items alone are looked at (new items joining the week).
 */
export async function saveWeekPlan(
  db: Db,
  plan: WeekPlan,
  context: { tasks: Task[]; items: WorkItem[]; only?: string[] },
): Promise<WeekPlanRow> {
  const row = unwrap(
    await db
      .from("week_plans")
      .upsert(
        {
          week_start: plan.weekStart,
          committed: plan.committed.map((entry) => entry.itemId),
          shares: toJson(
            Object.fromEntries(
              plan.committed.map((entry) => [
                entry.itemId,
                { minutes: entry.minutes, from: entry.from },
              ]),
            ),
          ),
          day_capacity: toJson(plan.capacityByDay),
          module_budgets: toJson(plan.moduleBudgets),
          capacity_minutes: plan.capacityMinutes,
          life_mode: plan.lifeMode,
          plan_source: plan.source,
          reasons: toJson(plan.reasons),
        },
        { onConflict: "user_id,week_start" },
      )
      .select()
      .single(),
  );
  const only = context.only ? new Set(context.only) : null;
  const scope = only
    ? { committed: plan.committed.filter((entry) => only.has(entry.itemId)) }
    : plan;
  const tasks = only
    ? context.tasks.filter((task) => task.work_item_id !== null && only.has(task.work_item_id))
    : context.tasks;
  const changes = sittingChanges(scope, tasks);
  if (changes.drop.length > 0) {
    check(
      await db
        .from("tasks")
        .update({ status: "dropped" })
        .in("id", changes.drop)
        .eq("status", "todo"),
    );
  }
  const inserts = changes.create.flatMap(({ itemId, minutes, position }) => {
    const item = context.items.find((entry) => entry.id === itemId);
    if (!item) return [];
    return [
      {
        module_id: item.module_id,
        work_item_id: item.id,
        title: item.title,
        est_minutes: Math.min(90, Math.max(5, minutes)),
        due_at: item.due_at,
        energy: item.energy ?? ("light" as const),
        context: item.context ?? ("any" as const),
        importance: item.importance,
        position,
        source_type: item.source_type,
        source_id: item.source_id,
      },
    ];
  });
  if (inserts.length > 0) check(await db.from("tasks").insert(inserts));
  return row;
}

// --- Life modes ------------------------------------------------------------------------------

export async function listLifeModes(db: Db): Promise<LifeModePeriod[]> {
  return unwrap(await db.from("life_mode_periods").select("*").order("starts_on"));
}

/**
 * A life mode for a range of days. Periods it overlaps are cut back (or removed) so that one
 * day has one mode; `normal` only clears the range.
 */
export async function setLifeMode(
  db: Db,
  input: { mode: LifeMode; from: string; to: string; note?: string | null },
  existing: LifeModePeriod[],
): Promise<void> {
  for (const period of existing) {
    if (period.ends_on < input.from || period.starts_on > input.to) continue;
    const before = period.starts_on < input.from;
    const after = period.ends_on > input.to;
    if (before) {
      check(
        await db
          .from("life_mode_periods")
          .update({ ends_on: shiftDay(input.from, -1) })
          .eq("id", period.id),
      );
    }
    if (after) {
      const rest = { starts_on: shiftDay(input.to, 1), ends_on: period.ends_on };
      check(
        before
          ? await db
              .from("life_mode_periods")
              .insert({ mode: period.mode, note: period.note, ...rest })
          : await db.from("life_mode_periods").update(rest).eq("id", period.id),
      );
    }
    if (!before && !after) {
      check(await db.from("life_mode_periods").delete().eq("id", period.id));
    }
  }
  if (input.mode !== "normal") {
    check(
      await db.from("life_mode_periods").insert({
        mode: input.mode,
        starts_on: input.from,
        ends_on: input.to,
        note: input.note ?? null,
      }),
    );
  }
}

// --- Learned values --------------------------------------------------------------------------

export async function listStats(db: Db): Promise<PlannerStatRow[]> {
  return unwrap(await db.from("planner_stats").select("*").order("key"));
}

export async function saveStats(
  db: Db,
  stats: { key: string; value: number; sample_size: number }[],
): Promise<void> {
  if (stats.length === 0) return;
  check(await db.from("planner_stats").upsert(stats, { onConflict: "user_id,key" }));
}
