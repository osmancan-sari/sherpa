-- Okul çekirdek A (docs/06-modul-sozlesmesi.md, "Sahne", controls; docs/03-veri-modeli.md,
-- sessions): a scene may tell, as the session closes, how many of its minutes counted (focus
-- without breaks). The session keeps its wall-clock range (started_at, ended_at) unchanged; the
-- counted minutes stand beside it. The remaining effort (`effort_done_minutes`) and the learning
-- use them; a value outside 0 .. the elapsed minutes is not kept (the elapsed time counts then).
-- Only additions and the two functions that turn a session's minutes into effort.

alter table public.sessions
  add column counted_minutes int check (counted_minutes is null or counted_minutes >= 0);

comment on column public.sessions.counted_minutes is
  'Minutes the scene counted when the session closed (breaks left out); null: the wall-clock time counts.';

-- The old two-argument function goes; the new one keeps its defaults, so the calls inside the
-- other functions (`end_session(v_open, ''stopped'')`) still resolve to it.
drop function public.end_session(uuid, text);

create function public.end_session(
  p_session_id uuid,
  p_outcome text default 'done',
  p_counted int default null
)
returns public.sessions
language plpgsql
set search_path = ''
as $$
declare
  s public.sessions;
  v_minutes int;
  v_work_item uuid;
begin
  if p_outcome not in ('done', 'stopped') then
    raise exception 'unknown outcome: %', p_outcome using errcode = '22023';
  end if;

  -- The counted minutes are kept only between 0 and the elapsed minutes (rounded up: a scene
  -- counting whole minutes may round its last one up).
  update public.sessions
     set ended_at = now(),
         counted_minutes = case
           when p_counted is not null
            and p_counted >= 0
            and p_counted <= ceil(extract(epoch from (now() - started_at)) / 60.0)
           then p_counted
         end
   where id = p_session_id and ended_at is null
   returning * into s;

  if s.id is null then
    -- Already closed (for example from the other device): nothing left to do.
    select * into s from public.sessions where id = p_session_id;
    if s.id is null then
      raise exception 'session not found' using errcode = 'P0002';
    end if;
    return s;
  end if;

  v_minutes := coalesce(
    s.counted_minutes,
    greatest(0, round(extract(epoch from (s.ended_at - s.started_at)) / 60.0))::int
  );

  if s.task_id is not null then
    if p_outcome = 'done' then
      update public.tasks
         set status = 'done', done_at = s.ended_at
       where id = s.task_id and status in ('todo', 'doing', 'waiting')
       returning work_item_id into v_work_item;
    else
      update public.tasks set status = 'todo' where id = s.task_id and status = 'doing';
    end if;

    if v_work_item is null then
      select work_item_id into v_work_item from public.tasks where id = s.task_id;
    end if;
    if v_work_item is not null and s.measured and v_minutes > 0 then
      update public.work_items
         set effort_done_minutes = effort_done_minutes + v_minutes
       where id = v_work_item;
    end if;
  end if;

  if s.rhythm_id is not null and p_outcome = 'done' then
    insert into public.rhythm_logs (rhythm_id, done_on, session_id)
    values (s.rhythm_id, (s.ended_at at time zone 'Europe/Istanbul')::date, s.id);
  end if;

  return s;
end;
$$;

revoke all on function public.end_session(uuid, text, int) from public, anon;
grant execute on function public.end_session(uuid, text, int) to authenticated;

-- Taking back a scene's bedtime (Rutin 1) undoes the minutes its "Bitti" added: the counted ones
-- when there were, and the session runs again without them.
create or replace function public.undo_scene_bed(p_session_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  d public.days;
  s public.sessions;
  v_minutes int;
  v_item uuid;
begin
  select * into d from public.days where bed_session_id = p_session_id for update;
  if d.id is null then
    select * into s from public.sessions where id = p_session_id;
    if s.id is not null and s.ended_at is null then
      return 'undone';
    end if;
    return 'changed';
  end if;

  if d.bed_at is null then
    return 'changed';
  end if;
  if now() - d.bed_at > interval '10 minutes' then
    return 'expired';
  end if;

  select * into s from public.sessions where id = p_session_id for update;
  if s.id is null or s.ended_at is null then
    return 'changed';
  end if;
  -- Another work running now, or started (and maybe ended) since the bedtime's session ended:
  -- reopening it would lay two sessions over each other.
  if exists (
    select 1 from public.sessions
     where id <> s.id and (ended_at is null or started_at >= s.ended_at)
  ) then
    return 'changed';
  end if;

  update public.days set bed_at = null, bed_session_id = null where id = d.id;

  -- What the session's "Bitti" did is undone: the rhythm's log, the task's done and its minutes.
  delete from public.rhythm_logs where session_id = s.id;
  if s.task_id is not null then
    update public.tasks
       set status = 'doing', done_at = null
     where id = s.task_id and status = 'done'
     returning work_item_id into v_item;
    if v_item is null then
      select work_item_id into v_item from public.tasks where id = s.task_id;
    end if;
    v_minutes := coalesce(
      s.counted_minutes,
      greatest(0, round(extract(epoch from (s.ended_at - s.started_at)) / 60.0))::int
    );
    if v_item is not null and s.measured and v_minutes > 0 then
      update public.work_items
         set effort_done_minutes = greatest(0, effort_done_minutes - v_minutes)
       where id = v_item;
    end if;
  end if;

  -- The session runs again from its own start; "Devam ediyor musun?" counts from now.
  update public.sessions
     set ended_at = null, counted_minutes = null, confirmed_at = now()
   where id = s.id;
  return 'undone';
end;
$$;
