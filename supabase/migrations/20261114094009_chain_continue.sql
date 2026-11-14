-- Ç3f: the anchored chains (docs/06-modul-sozlesmesi.md, "Diziler"). When a chain's work ends
-- with "Bitti" or "Ertele", the device that ended it starts the next one; after a waking told
-- from outside (core/wake), the device that comes to the front first starts the first one.
-- Two devices may do either at the same moment. This starts a session only if no session is
-- open and none has started since `p_since` (the end of the work that came before, or the
-- waking): the second caller gets nothing back, and one session runs.
--
-- The start itself is start_session's (the one path every start goes through). The callers of
-- one user wait for each other on a lock of that user, so the second one sees the first one's
-- session once it may look. Only an addition: no table changes.

create function public.start_session_if_idle(
  p_since timestamptz,
  p_task_id uuid default null,
  p_work_item_id uuid default null,
  p_rhythm_id uuid default null
)
returns public.sessions
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_since is null then
    raise exception 'p_since is required' using errcode = '22023';
  end if;
  if p_task_id is null and p_work_item_id is null and p_rhythm_id is null then
    raise exception 'start a session on a task, a work item or a rhythm' using errcode = '22023';
  end if;

  -- One caller of this user at a time, until the transaction ends.
  perform pg_advisory_xact_lock(hashtextextended('sherpa.start_session_if_idle:' || v_user::text, 0));

  if exists (
    select 1 from public.sessions
     where user_id = v_user and (ended_at is null or started_at >= p_since)
  ) then
    return null;
  end if;

  return public.start_session(p_task_id, p_work_item_id, p_rhythm_id, null, null);
end;
$$;

revoke all on function public.start_session_if_idle(timestamptz, uuid, uuid, uuid) from public, anon;
grant execute on function public.start_session_if_idle(timestamptz, uuid, uuid, uuid) to authenticated;
