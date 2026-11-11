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

-- Both screens follow the week, the life mode and what the planner learned.
alter publication supabase_realtime add table
  public.week_plans, public.life_mode_periods, public.planner_stats, public.weekly_reviews,
  public.horizon_reviews;
