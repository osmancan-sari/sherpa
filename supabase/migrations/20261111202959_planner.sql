-- Ç3: the planner (docs/04-planlayici.md).

-- "Ertele" moves a task to tomorrow; put off three times, the planner asks to split, drop or
-- date it. The count lives on the task.
alter table public.tasks
  add column defer_count int not null default 0 check (defer_count >= 0);

-- The week's commitment remembers the life mode it was made in (a change of mode commits the
-- week again), each item's share of the week in minutes, and each remaining day's capacity
-- when it was made (lost capacity is measured against it day by day).
alter table public.week_plans
  add column life_mode public.life_mode,
  add column shares jsonb not null default '{}',
  add column day_capacity jsonb not null default '{}';

-- The week's sittings of an item have their places (1, 2, …). Two open sittings never share
-- one: when both screens commit the week at the same moment, the second write fails instead
-- of opening every sitting twice.
create unique index tasks_open_sitting_position
  on public.tasks (work_item_id, position)
  where work_item_id is not null and position is not null and status in ('todo', 'doing', 'waiting');

-- Both screens follow the week, the life mode and what the planner learned.
alter publication supabase_realtime add table
  public.week_plans, public.life_mode_periods, public.planner_stats, public.weekly_reviews,
  public.horizon_reviews;
