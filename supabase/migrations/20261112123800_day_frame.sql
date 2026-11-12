-- Ç3c: the day's frame (docs/03-veri-modeli.md, `days` and `settings.day_frame`;
-- docs/04-planlayici.md, "Günün çerçevesi"), and the race left from Ç3b: an item's sitting is
-- opened only with the item's row locked.

-- The day is tied to two real events: waking and going to bed.
alter table public.days
  add column woke_at timestamptz,
  -- "Uyandım" was not said: the first touch of the day stands for it.
  add column woke_estimated boolean not null default false,
  add column bed_at timestamptz,
  -- What the sleep plan chose for this day's waking and this night's bed (a record; the
  -- planner works them out again whenever it plans).
  add column planned_wake time,
  add column planned_bed time,
  -- The user's own value for this day only ("yarın erken kalkacağım", "bu gece geç yatacağım").
  add column expected_wake time,
  add column expected_bed time;

-- The ranges and the sleep target. Empty: the frame is off and the planner works as in Ç3b.
-- The default is what the user said (12 Nov 2026); the app checks the shape.
alter table public.settings
  add column day_frame jsonb
    default '{"wake": ["06:00", "09:00"], "bed": ["22:00", "01:00"], "sleep_minutes": 480}'
    check (day_frame is null or jsonb_typeof(day_frame) = 'object');

-- ---------------------------------------------------------------------------------------------
-- Sittings: one writer at a time per item.
-- ---------------------------------------------------------------------------------------------

-- Starting a work item opens its next sitting when it has none. The item's row is locked first,
-- so the week keeper (save_week_sittings) cannot open the item's sittings at the same moment.
create or replace function public.start_session(
  p_task_id uuid default null,
  p_work_item_id uuid default null,
  p_rhythm_id uuid default null,
  p_module_id uuid default null,
  p_title text default null
)
returns public.sessions
language plpgsql
set search_path = ''
as $$
declare
  s public.sessions;
  v_open uuid;
  v_task public.tasks;
  v_item public.work_items;
  v_module uuid := p_module_id;
  v_minutes int;
begin
  if (p_task_id is not null)::int + (p_work_item_id is not null)::int + (p_rhythm_id is not null)::int > 1 then
    raise exception 'start a session on one thing at a time' using errcode = '22023';
  end if;
  if p_task_id is null and p_work_item_id is null and p_rhythm_id is null
     and coalesce(btrim(p_title), '') = '' then
    raise exception 'unplanned work needs a title' using errcode = '22023';
  end if;

  select id into v_open from public.sessions
   where user_id = (select auth.uid()) and ended_at is null;
  if v_open is not null then
    perform public.end_session(v_open, 'stopped');
  end if;

  if p_work_item_id is not null then
    -- Locked until this transaction ends: the keeper waits, then sees the sitting made here.
    select * into v_item from public.work_items where id = p_work_item_id for update;
    if v_item.id is null then
      raise exception 'work item not found' using errcode = 'P0002';
    end if;
    if v_item.status in ('done', 'dropped') then
      raise exception 'this work item is closed' using errcode = '22023';
    end if;
    -- Reuse an open sitting of this item if there is one; otherwise create the next.
    select * into v_task from public.tasks
     where work_item_id = v_item.id and status in ('todo', 'doing')
     order by position nulls last, created_at
     limit 1;
    if v_task.id is null then
      v_minutes := v_item.effort_total_minutes - v_item.effort_done_minutes;
      if v_minutes is null or v_minutes <= 0 then
        v_minutes := 45;
      end if;
      v_minutes := coalesce(v_item.session_minutes, least(45, greatest(5, v_minutes)));
      insert into public.tasks (
        module_id, work_item_id, title, est_minutes, due_at, energy, context, importance,
        source_type, source_id
      )
      values (
        v_item.module_id, v_item.id, v_item.title, least(90, greatest(5, v_minutes)), v_item.due_at,
        coalesce(v_item.energy, 'light'), coalesce(v_item.context, 'any'), v_item.importance,
        v_item.source_type, v_item.source_id
      )
      returning * into v_task;
    end if;
  elsif p_task_id is not null then
    select * into v_task from public.tasks where id = p_task_id;
    if v_task.id is null then
      raise exception 'task not found' using errcode = 'P0002';
    end if;
    -- A sitting: its item is locked too, and the sitting read again under the lock, so the
    -- keeper never drops it while it is being started.
    if v_task.work_item_id is not null then
      perform 1 from public.work_items where id = v_task.work_item_id for update;
      select * into v_task from public.tasks where id = p_task_id;
    end if;
    if v_task.status in ('done', 'dropped') then
      raise exception 'this task is closed' using errcode = '22023';
    end if;
  end if;

  if v_task.id is not null then
    update public.tasks set status = 'doing', waiting_on = null, follow_up_on = null
     where id = v_task.id and status in ('todo', 'waiting');
    v_module := v_task.module_id;
  elsif p_rhythm_id is not null then
    select module_id into v_module from public.rhythms where id = p_rhythm_id;
    if v_module is null then
      raise exception 'rhythm not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.sessions (task_id, rhythm_id, module_id, title)
  values (v_task.id, p_rhythm_id, v_module, nullif(btrim(p_title), ''))
  returning * into s;

  return s;
end;
$$;

-- The week's sittings (src/core/planner/week.ts, `sittingChanges`, is the same rule in
-- TypeScript): each committed item gets as many open sittings as its share needs, counting the
-- running and waiting ones; extra unstarted ones are dropped, missing ones are opened after
-- every place the item has had. Unstarted sittings of items that left the week are dropped.
-- Each item's row is locked while its sittings are looked at (in id order), so a "Başla" on the
-- item waits or is waited for: an item never gets two open sittings from the two of them.
--
-- p_committed: [{ "item_id": uuid, "sittings": [minutes, …] }]. p_only: only these items.
create function public.save_week_sittings(p_committed jsonb, p_only uuid[] default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_id uuid;
  v_item public.work_items;
  v_sittings jsonb;
  v_busy int;
  v_todo_ids uuid[];
  v_todos int;
  v_wanted int;
  v_last int;
  v_index int;
begin
  if jsonb_typeof(p_committed) <> 'array' then
    raise exception 'p_committed must be an array' using errcode = '22023';
  end if;

  select array_agg(id order by id) into v_ids
    from (
      select (entry ->> 'item_id')::uuid as id from jsonb_array_elements(p_committed) entry
      union
      select work_item_id from public.tasks
       where user_id = (select auth.uid()) and work_item_id is not null and status = 'todo'
    ) ids
   where id is not null and (p_only is null or id = any (p_only));
  if v_ids is null then
    return;
  end if;

  foreach v_id in array v_ids loop
    select * into v_item from public.work_items where id = v_id for update;
    continue when v_item.id is null;

    select entry -> 'sittings' into v_sittings
      from jsonb_array_elements(p_committed) entry
     where (entry ->> 'item_id')::uuid = v_id
     limit 1;

    if v_sittings is null then
      -- Not in the week: its unstarted sittings go.
      update public.tasks set status = 'dropped' where work_item_id = v_id and status = 'todo';
      continue;
    end if;

    select count(*) into v_busy
      from public.tasks where work_item_id = v_id and status in ('doing', 'waiting');
    select coalesce(array_agg(id order by coalesce(position, 0), created_at), '{}') into v_todo_ids
      from public.tasks where work_item_id = v_id and status = 'todo';
    v_todos := coalesce(array_length(v_todo_ids, 1), 0);
    v_wanted := greatest(0, jsonb_array_length(v_sittings) - v_busy);
    if v_todos > v_wanted then
      -- Still unstarted only: a sitting started meanwhile is never dropped.
      update public.tasks set status = 'dropped'
       where id = any (v_todo_ids[v_wanted + 1 : v_todos]) and status = 'todo';
    end if;

    -- New sittings go after every place the item has had, so two never share one.
    select coalesce(max(position), 0) into v_last from public.tasks where work_item_id = v_id;
    for v_index in (v_busy + v_todos) .. (jsonb_array_length(v_sittings) - 1) loop
      v_last := v_last + 1;
      insert into public.tasks (
        module_id, work_item_id, title, est_minutes, due_at, energy, context, importance,
        position, source_type, source_id
      )
      values (
        v_item.module_id, v_item.id, v_item.title,
        least(90, greatest(5, (v_sittings ->> v_index)::int)), v_item.due_at,
        coalesce(v_item.energy, 'light'), coalesce(v_item.context, 'any'), v_item.importance,
        v_last, v_item.source_type, v_item.source_id
      );
    end loop;
  end loop;
end;
$$;

revoke all on function public.save_week_sittings(jsonb, uuid[]) from public, anon;
grant execute on function public.save_week_sittings(jsonb, uuid[]) to authenticated;
