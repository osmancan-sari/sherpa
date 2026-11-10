-- Ç1: core tables (docs/03-veri-modeli.md). The AI tables (ai_calls, ai_feedback) arrive in Ç2.
--
-- Common rules, applied to every table at the end of this file:
--   id, user_id (default auth.uid()), created_at, updated_at (trigger)
--   row level security: user_id = auth.uid()
--   no access for the anonymous role
-- A row may only point at rows of the same account: references between tables are written as
-- (id, user_id) pairs, because a plain foreign key is checked without row level security.

-- ---------------------------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------------------------

create type public.module_kind as enum ('lifelong', 'term', 'until_goal');
create type public.module_status as enum ('active', 'paused', 'archived');
create type public.work_item_status as enum ('proposed', 'active', 'waiting', 'done', 'dropped');
create type public.task_kind as enum ('task', 'prep', 'deadline', 'admin');
create type public.task_status as enum ('todo', 'doing', 'waiting', 'done', 'dropped');
create type public.energy_kind as enum ('deep', 'light', 'physical');
create type public.context_kind as enum ('any', 'desk', 'home', 'campus', 'office', 'out', 'commute');
create type public.period_kind as enum ('day', 'week', 'month');
create type public.block_kind as enum ('work', 'class', 'appointment', 'protected');
create type public.block_status as enum ('planned', 'cancelled', 'done');
create type public.day_type as enum ('home', 'office', 'campus');
create type public.life_mode as enum ('normal', 'busy', 'minimum', 'holiday');
create type public.plan_source as enum ('closing', 'ai', 'auto');
create type public.horizon_scope as enum ('month', 'term');
create type public.inbox_status as enum ('new', 'needs_confirm', 'routed', 'dismissed');
create type public.prompt_status as enum ('pending', 'answered', 'expired');

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- "Today" as the app sees it: the calendar day in Istanbul.
create function public.istanbul_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Istanbul')::date;
$$;

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  slug text not null,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  slug text not null,
  name text not null,
  kind public.module_kind not null default 'lifelong',
  status public.module_status not null default 'active',
  area_id uuid,
  weight numeric not null default 1,
  weekly_floor_minutes int not null default 0 check (weekly_floor_minutes >= 0),
  color text not null default '#737373',
  starts_on date,
  ends_on date,
  end_condition text,
  mode_behavior jsonb not null default '{}',
  settings jsonb not null default '{}',
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug),
  foreign key (area_id, user_id) references public.areas (id, user_id) on delete set null (area_id)
);

create table public.work_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  module_id uuid not null,
  parent_id uuid,
  key text,
  title text not null check (length(btrim(title)) > 0),
  status public.work_item_status not null default 'active',
  due_at timestamptz,
  due_is_hard boolean not null default false,
  earliest_at timestamptz,
  effort_total_minutes int check (effort_total_minutes is null or effort_total_minutes > 0),
  effort_done_minutes int not null default 0 check (effort_done_minutes >= 0),
  session_minutes int check (session_minutes is null or session_minutes between 5 and 90),
  importance smallint not null default 2 check (importance between 1 and 4),
  energy public.energy_kind,
  context public.context_kind,
  depends_on uuid[] not null default '{}',
  -- The envelope's dependency keys as proposed; depends_on holds the ones resolved to rows.
  depends_on_keys text[] not null default '{}',
  splittable boolean not null default true,
  droppable boolean not null default false,
  artifact_url text,
  provenance jsonb not null default '{}',
  ai jsonb,
  source_type text,
  source_id uuid,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, key),
  foreign key (module_id, user_id) references public.modules (id, user_id) on delete cascade,
  foreign key (parent_id, user_id) references public.work_items (id, user_id) on delete cascade
);
create index work_items_user_status_idx on public.work_items (user_id, status);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  module_id uuid not null,
  work_item_id uuid,
  title text not null check (length(btrim(title)) > 0),
  kind public.task_kind not null default 'task',
  -- A task is one sitting. Anything longer is a work item (total effort + sessions).
  est_minutes int not null default 30 check (est_minutes between 5 and 90),
  due_at timestamptz,
  planned_date date,
  energy public.energy_kind not null default 'light',
  context public.context_kind not null default 'any',
  importance smallint not null default 2 check (importance between 1 and 4),
  status public.task_status not null default 'todo',
  waiting_on text,
  follow_up_on date,
  position int,
  source_type text,
  source_id uuid,
  meta jsonb not null default '{}',
  ai jsonb,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (module_id, user_id) references public.modules (id, user_id) on delete cascade,
  foreign key (work_item_id, user_id) references public.work_items (id, user_id) on delete cascade
);
create index tasks_user_status_idx on public.tasks (user_id, status);
create index tasks_work_item_idx on public.tasks (work_item_id);

create table public.rhythms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  module_id uuid not null,
  key text,
  title text not null check (length(btrim(title)) > 0),
  target_count int not null check (target_count > 0),
  period public.period_kind not null,
  floor_count int not null default 0 check (floor_count >= 0),
  est_minutes int not null default 15 check (est_minutes between 1 and 90),
  energy public.energy_kind not null default 'light',
  context public.context_kind not null default 'any',
  active boolean not null default true,
  mode_targets jsonb,
  provenance jsonb not null default '{}',
  source_type text,
  source_id uuid,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, key),
  foreign key (module_id, user_id) references public.modules (id, user_id) on delete cascade
);

create table public.block_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  module_id uuid,
  title text not null check (length(btrim(title)) > 0),
  kind public.block_kind not null default 'work',
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  location text,
  travel_before_min int not null default 0 check (travel_before_min >= 0),
  travel_after_min int not null default 0 check (travel_after_min >= 0),
  day_type public.day_type,
  valid_from date not null default public.istanbul_today(),
  valid_to date,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  foreign key (module_id, user_id) references public.modules (id, user_id) on delete set null (module_id)
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  series_id uuid,
  -- The day of the series this block was generated for. It stays put when the block is moved,
  -- so regenerating the series never brings the original time back.
  occurrence_on date,
  module_id uuid,
  key text,
  title text not null check (length(btrim(title)) > 0),
  kind public.block_kind not null default 'appointment',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  travel_before_min int not null default 0 check (travel_before_min >= 0),
  travel_after_min int not null default 0 check (travel_after_min >= 0),
  day_type public.day_type,
  status public.block_status not null default 'planned',
  provenance jsonb not null default '{}',
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((series_id is null) = (occurrence_on is null)),
  unique (series_id, occurrence_on),
  unique (module_id, key),
  foreign key (series_id, user_id) references public.block_series (id, user_id) on delete cascade,
  foreign key (module_id, user_id) references public.modules (id, user_id) on delete set null (module_id)
);
create index blocks_user_starts_idx on public.blocks (user_id, starts_at);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  task_id uuid,
  rhythm_id uuid,
  module_id uuid,
  title text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  measured boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id),
  foreign key (rhythm_id, user_id) references public.rhythms (id, user_id) on delete set null (rhythm_id),
  foreign key (module_id, user_id) references public.modules (id, user_id) on delete set null (module_id)
);
-- At most one open session at a time.
create unique index sessions_one_open_idx on public.sessions (user_id) where ended_at is null;
create index sessions_user_started_idx on public.sessions (user_id, started_at);
create index sessions_task_idx on public.sessions (task_id);

create table public.rhythm_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rhythm_id uuid not null,
  done_on date not null default public.istanbul_today(),
  session_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (rhythm_id, user_id) references public.rhythms (id, user_id) on delete cascade,
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete set null (session_id)
);
create index rhythm_logs_rhythm_idx on public.rhythm_logs (rhythm_id, done_on);

create table public.days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  day_type public.day_type,
  life_mode public.life_mode not null default 'normal',
  started_at timestamptz,
  finish_line time,
  top3 uuid[] not null default '{}',
  plan jsonb,
  plan_source public.plan_source,
  plan_reasons jsonb,
  closed_at timestamptz,
  closing_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.week_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  committed uuid[] not null default '{}',
  module_budgets jsonb not null default '{}',
  capacity_minutes int,
  plan_source public.plan_source,
  reasons jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.horizon_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope public.horizon_scope not null,
  period_start date not null,
  load jsonb not null default '[]',
  proposals jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scope, period_start)
);

create table public.life_mode_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode public.life_mode not null,
  starts_on date not null,
  ends_on date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table public.inbox_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  raw_text text not null check (length(btrim(raw_text)) > 0),
  status public.inbox_status not null default 'new',
  suggestion jsonb,
  routed jsonb,
  routed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inbox_entries_user_status_idx on public.inbox_entries (user_id, status);

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  module_id uuid not null,
  kind text not null,
  question text not null,
  options jsonb not null default '[]',
  subject_type text,
  subject_id uuid,
  ask_after timestamptz not null default now(),
  status public.prompt_status not null default 'pending',
  answer jsonb,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (module_id, user_id) references public.modules (id, user_id) on delete cascade
);
create index prompts_user_status_idx on public.prompts (user_id, status, ask_after);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null,
  module_slug text,
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_user_occurred_idx on public.events (user_id, occurred_at);

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.planner_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  value numeric not null,
  sample_size int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

-- One row per user; a missing row means "all defaults".
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  finish_line_default time not null default '19:00',
  day_start_default time not null default '08:00',
  capacity_factors jsonb not null default '{"home": 0.7, "office": 0.4, "campus": 0.5}',
  slot jsonb not null default '{"deep_min": 45, "deep_max": 90, "light_min": 15, "break_min": 15}',
  default_day_type public.day_type not null default 'home',
  return_after_days int not null default 3,
  ai_enabled boolean not null default true,
  ai_monthly_budget_usd numeric not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ---------------------------------------------------------------------------------------------
-- Common rules: updated_at trigger, RLS, grants
-- ---------------------------------------------------------------------------------------------

do $$
declare
  t text;
  all_tables text[] := array[
    'areas', 'modules', 'work_items', 'tasks', 'rhythms', 'rhythm_logs', 'block_series', 'blocks',
    'sessions', 'days', 'week_plans', 'horizon_reviews', 'life_mode_periods', 'inbox_entries',
    'prompts', 'events', 'weekly_reviews', 'planner_stats', 'settings'
  ];
begin
  foreach t in array all_tables loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);

    if t = 'events' then
      -- Append-only: rows are added and read, never changed or removed.
      execute format('grant select, insert on table public.%I to authenticated', t);
      execute format(
        'create policy "own rows: read" on public.%I for select to authenticated
           using (user_id = (select auth.uid()))', t);
      execute format(
        'create policy "own rows: add" on public.%I for insert to authenticated
           with check (user_id = (select auth.uid()))', t);
    elsif t = 'inbox_entries' then
      -- Raw entries are never deleted; their status changes.
      execute format('grant select, insert, update on table public.%I to authenticated', t);
      execute format(
        'create policy "own rows: read" on public.%I for select to authenticated
           using (user_id = (select auth.uid()))', t);
      execute format(
        'create policy "own rows: add" on public.%I for insert to authenticated
           with check (user_id = (select auth.uid()))', t);
      execute format(
        'create policy "own rows: change" on public.%I for update to authenticated
           using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    else
      execute format(
        'grant select, insert, update, delete on table public.%I to authenticated', t);
      execute format(
        'create policy "own rows" on public.%I for all to authenticated
           using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Sessions: Başla, Bitti, plansız iş. Atomic, and run with the caller's rights (RLS applies).
-- ---------------------------------------------------------------------------------------------

-- Ends the session. p_outcome: 'done' finishes the task or logs the rhythm; 'stopped' only stops
-- the clock. Either way the minutes count towards the work item.
create function public.end_session(p_session_id uuid, p_outcome text default 'done')
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

  update public.sessions
     set ended_at = now()
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

  v_minutes := greatest(0, round(extract(epoch from (s.ended_at - s.started_at)) / 60.0))::int;

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

-- Starts a session on a task, on a work item (its next sitting is created on the spot),
-- on a rhythm, or on nothing at all (unplanned work: only a title). A session that is still
-- open is stopped first, so two can never run at once.
create function public.start_session(
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
    select * into v_item from public.work_items where id = p_work_item_id;
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
      -- The item's own session length; else what is left of the effort, 45 minutes at most.
      -- With no effort known, or none left, a plain 45.
      v_minutes := v_item.effort_total_minutes - v_item.effort_done_minutes;
      if v_minutes is null or v_minutes <= 0 then
        v_minutes := 45;
      end if;
      v_minutes := coalesce(v_item.session_minutes, least(45, greatest(5, v_minutes)));
      insert into public.tasks (module_id, work_item_id, title, est_minutes, due_at, energy, context, importance)
      values (
        v_item.module_id, v_item.id, v_item.title, least(90, greatest(5, v_minutes)), v_item.due_at,
        coalesce(v_item.energy, 'light'), coalesce(v_item.context, 'any'), v_item.importance
      )
      returning * into v_task;
    end if;
  elsif p_task_id is not null then
    select * into v_task from public.tasks where id = p_task_id;
    if v_task.id is null then
      raise exception 'task not found' using errcode = 'P0002';
    end if;
    if v_task.status in ('done', 'dropped') then
      raise exception 'this task is closed' using errcode = '22023';
    end if;
  end if;

  if v_task.id is not null then
    -- Starting a task that was waiting on something means the wait is over.
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

-- Marks a task done in one tap. A session running on it is closed as done.
create function public.complete_task(p_task_id uuid)
returns public.tasks
language plpgsql
set search_path = ''
as $$
declare
  t public.tasks;
  v_open uuid;
begin
  select id into v_open from public.sessions where task_id = p_task_id and ended_at is null;
  if v_open is not null then
    perform public.end_session(v_open, 'done');
  end if;

  update public.tasks
     set status = 'done', done_at = coalesce(done_at, now())
   where id = p_task_id and status in ('todo', 'doing', 'waiting');

  select * into t from public.tasks where id = p_task_id;
  if t.id is null then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  return t;
end;
$$;

-- Archiving a module (docs/06-modul-sozlesmesi.md): its open work is dropped, its series close,
-- its rhythms go quiet, its coming blocks are cancelled. Nothing is deleted.
create function public.archive_module(p_module_id uuid)
returns public.modules
language plpgsql
set search_path = ''
as $$
declare
  m public.modules;
  v_today date := public.istanbul_today();
  v_open uuid;
begin
  update public.modules set status = 'archived' where id = p_module_id returning * into m;
  if m.id is null then
    raise exception 'module not found' using errcode = 'P0002';
  end if;

  select s.id into v_open
    from public.sessions s
   where s.ended_at is null and s.module_id = p_module_id;
  if v_open is not null then
    perform public.end_session(v_open, 'stopped');
  end if;

  update public.tasks set status = 'dropped'
   where module_id = p_module_id and status in ('todo', 'doing', 'waiting');
  update public.work_items set status = 'dropped'
   where module_id = p_module_id and status in ('proposed', 'active', 'waiting');
  update public.rhythms set active = false where module_id = p_module_id and active;
  update public.prompts set status = 'expired' where module_id = p_module_id and status = 'pending';

  update public.block_series set valid_to = v_today - 1
   where module_id = p_module_id and (valid_to is null or valid_to >= v_today);
  update public.blocks b set status = 'cancelled'
    from public.block_series bs
   where b.series_id = bs.id and bs.module_id = p_module_id
     and b.status = 'planned' and b.ends_at > now();
  update public.blocks set status = 'cancelled'
   where module_id = p_module_id and series_id is null and status = 'planned' and ends_at > now();

  return m;
end;
$$;

revoke all on function public.istanbul_today() from public, anon;
grant execute on function public.istanbul_today() to authenticated, service_role;
revoke all on function public.end_session(uuid, text) from public, anon;
revoke all on function public.start_session(uuid, uuid, uuid, uuid, text) from public, anon;
revoke all on function public.complete_task(uuid) from public, anon;
revoke all on function public.archive_module(uuid) from public, anon;
grant execute on function public.end_session(uuid, text) to authenticated;
grant execute on function public.start_session(uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.complete_task(uuid) to authenticated;
grant execute on function public.archive_module(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Realtime: the tables both screens watch (docs/02-mimari.md, "Canlı güncelleme").
-- ---------------------------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.modules, public.work_items, public.tasks, public.rhythms, public.rhythm_logs,
  public.block_series, public.blocks, public.sessions, public.days, public.inbox_entries,
  public.prompts, public.events, public.settings;
