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

-- A session that runs past twice its estimate asks "Devam ediyor musun?" (docs/04-planlayici.md,
-- "Oturum kuralları"). The answer "devam" is kept on the session, so every screen knows it.
alter table public.sessions add column confirmed_at timestamptz;

-- No answer: the session is closed as if it had taken its estimate, and it is not measured
-- (it does not teach the planner anything). The task goes back to the pool; the estimate
-- counts towards the work item's effort.
create function public.close_unanswered_session(p_session_id uuid)
returns public.sessions
language plpgsql
set search_path = ''
as $$
declare
  s public.sessions;
  v_task public.tasks;
  v_minutes int;
begin
  select * into s from public.sessions where id = p_session_id;
  if s.id is null then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  if s.ended_at is not null then
    return s;
  end if;

  if s.task_id is not null then
    select * into v_task from public.tasks where id = s.task_id;
    v_minutes := v_task.est_minutes;
  elsif s.rhythm_id is not null then
    select est_minutes into v_minutes from public.rhythms where id = s.rhythm_id;
  end if;
  v_minutes := coalesce(v_minutes, 45);

  update public.sessions
     set ended_at = started_at + make_interval(mins => v_minutes), measured = false
   where id = s.id and ended_at is null
   returning * into s;

  if v_task.id is not null then
    update public.tasks set status = 'todo' where id = v_task.id and status = 'doing';
    if v_task.work_item_id is not null then
      update public.work_items
         set effort_done_minutes = effort_done_minutes + v_minutes
       where id = v_task.work_item_id;
    end if;
  end if;
  return s;
end;
$$;

revoke all on function public.close_unanswered_session(uuid) from public, anon;
grant execute on function public.close_unanswered_session(uuid) to authenticated;
