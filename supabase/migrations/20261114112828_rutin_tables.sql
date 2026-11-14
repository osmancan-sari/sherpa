-- Module "rutin" (src/modules/rutin; design docs/moduller/rutin.md, section 3): the morning's and
-- the evening's care steps, run one by one on the scene, and the record of each run. Four tables,
-- all with user_id and RLS like every table; only the module reads and writes them. The steps are
-- data: the user adds, renames, orders and switches them off on the module page.

-- The three routines the module proposes its rhythms from: 'sabah' (on waking), 'hazirlik' (the
-- shower and getting ready, after the movements) and 'aksam' (before bed).
create table public.rutin_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  key text not null check (key in ('sabah', 'hazirlik', 'aksam')),
  title text not null check (length(btrim(title)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

-- A routine's steps, in order. A step with a parent is an add-on of that step (Dercos on the
-- shower): it has no screen of its own and shows as one more line on its parent's on the days it
-- is due. `parts` are the step's sub-steps: [{ title, note?, seconds?, timer?, hold? }].
create table public.rutin_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  routine_id uuid not null,
  parent_id uuid,
  position int not null default 0 check (position >= 0),
  title text not null check (length(btrim(title)) between 1 and 80),
  -- 'tap': a step of the scene; 'closing': the way into the core's evening closing (step 3)
  kind text not null default 'tap' check (kind in ('tap', 'closing')),
  -- the planned length; seconds_auto false: the user typed it, it is never learned over
  seconds int not null default 60 check (seconds between 0 and 10800),
  seconds_auto boolean not null default true,
  hint text check (hint is null or length(hint) <= 200),
  parts jsonb check (parts is null or jsonb_typeof(parts) = 'array'),
  -- a basic step ("temel adım"): the routine is done for the day when all the open ones are
  minimum boolean not null default false,
  active boolean not null default true,
  -- the research's phase and id, and its note on the evidence (information only)
  phase smallint check (phase is null or phase between 1 and 9),
  -- empty: every run; n: once n days have gone by since it was last done
  every_days int check (every_days is null or every_days between 1 and 365),
  evidence text,
  ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id),
  foreign key (routine_id, user_id) references public.rutin_routines (id, user_id) on delete cascade,
  -- an add-on goes with its step
  foreign key (parent_id, user_id) references public.rutin_steps (id, user_id) on delete cascade
);
create index rutin_steps_routine_idx on public.rutin_steps (routine_id, position);

-- One run of a routine on one day: where it stands (the same on both screens) and how it went.
-- `day` is the core's day (a bedtime after midnight belongs to the night before), never the date
-- of the clock. A routine runs once a day; starting it again goes on in the same row.
create table public.rutin_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  routine_id uuid not null,
  day date not null,
  session_id uuid,
  step_position int not null default 0 check (step_position >= 0),
  part_position int not null default 0 check (part_position >= 0),
  -- when the step came on the screen (its seconds are counted from here)
  step_started_at timestamptz,
  -- when the timed sub-step started; the timer is counted from it, so it survives a reload
  part_started_at timestamptz,
  -- the timer was stopped by a touch at this moment (null: it runs)
  part_paused_at timestamptz,
  minimum_done boolean not null default false,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, routine_id, day),
  foreign key (routine_id, user_id) references public.rutin_routines (id, user_id) on delete cascade,
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete set null (session_id)
);

-- What became of each step in a run. Deleting a step keeps its records (the step is forgotten).
create table public.rutin_run_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  run_id uuid not null,
  step_id uuid,
  result text not null check (result in ('done', 'skipped')),
  -- the time on the step, from when it came on the screen to "Sonraki" (for learning)
  seconds int check (seconds is null or seconds >= 0),
  -- closed by "Hepsini yaptım" or within a few seconds of the one before: not learned from
  bulk boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, step_id),
  foreign key (run_id, user_id) references public.rutin_runs (id, user_id) on delete cascade,
  foreign key (step_id, user_id) references public.rutin_steps (id, user_id) on delete set null (step_id)
);

do $$
declare
  t text;
begin
  foreach t in array array['rutin_routines', 'rutin_steps', 'rutin_runs', 'rutin_run_steps'] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end;
$$;
