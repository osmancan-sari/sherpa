-- Taking back a bedtime written from a scene (Rutin 1; docs/06-modul-sozlesmesi.md, "Diziler"
-- rule 6; Rutin's core note 15). A scene's "Yatıyorum" (`controls.bed()`) closes the running
-- session as done and writes tonight's bedtime; the day remembers which session did it. For a
-- short while (10 minutes) that bedtime can be taken back: it is as if it was never written
-- (the sleep plan and tomorrow's expected waking come back with it), and the session runs again,
-- so the scene opens where it stood. Any other way of writing the bedtime clears the link.

alter table public.days add column bed_session_id uuid;
alter table public.days
  add constraint days_bed_session_fk foreign key (bed_session_id, user_id)
  references public.sessions (id, user_id) on delete set null (bed_session_id);

-- 'undone': the bedtime is gone and the session runs again (also when another screen did it a
-- moment ago); 'expired': more than 10 minutes went by; 'changed': the bedtime was written another
-- way since, or another session started: nothing is changed. Two screens at once: one result.
create function public.undo_scene_bed(p_session_id uuid)
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

  if d.bed_at is null or now() - d.bed_at > interval '10 minutes' then
    return 'expired';
  end if;

  select * into s from public.sessions where id = p_session_id for update;
  if s.id is null or s.ended_at is null then
    return 'changed';
  end if;
  if exists (select 1 from public.sessions where ended_at is null) then
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
    v_minutes := greatest(0, round(extract(epoch from (s.ended_at - s.started_at)) / 60.0))::int;
    if v_item is not null and s.measured and v_minutes > 0 then
      update public.work_items
         set effort_done_minutes = greatest(0, effort_done_minutes - v_minutes)
       where id = v_item;
    end if;
  end if;

  -- The session runs again from its own start; "Devam ediyor musun?" counts from now.
  update public.sessions set ended_at = null, confirmed_at = now() where id = s.id;
  return 'undone';
end;
$$;

revoke all on function public.undo_scene_bed(uuid) from public, anon;
grant execute on function public.undo_scene_bed(uuid) to authenticated;
