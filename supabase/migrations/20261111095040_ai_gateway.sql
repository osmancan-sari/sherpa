-- Ç2: the AI gateway's tables (docs/10-yapay-zeka.md).
--
-- Same rules as every table: id, user_id (default auth.uid()), created_at, updated_at,
-- row level security on user_id, no access for the anonymous role.

-- ---------------------------------------------------------------------------------------------
-- ai_calls: one row per call that reached the provider, with what it cost.
-- ---------------------------------------------------------------------------------------------

create table public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- enrich, size, decompose, extract; plan, replan, week, month, review from Ç3 on
  kind text not null check (length(btrim(kind)) > 0),
  model text not null check (length(btrim(model)) > 0),
  input_tokens int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  cost_usd numeric not null default 0 check (cost_usd >= 0),
  ok boolean not null,
  error text,
  duration_ms int not null default 0 check (duration_ms >= 0),
  subject_type text,
  subject_id uuid,
  -- A short hash of what the call was asked. The same question is not asked twice: the gateway
  -- answers it from the last successful row that carries the same kind and fingerprint.
  fingerprint text,
  -- The validated output of a successful call; null for a failed one.
  output jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ok or output is null)
);
create index ai_calls_user_created_idx on public.ai_calls (user_id, created_at);
create index ai_calls_fingerprint_idx on public.ai_calls (user_id, kind, fingerprint, created_at desc)
  where ok and fingerprint is not null;
create index ai_calls_subject_idx on public.ai_calls (user_id, subject_id, created_at desc)
  where subject_id is not null;

-- ---------------------------------------------------------------------------------------------
-- ai_feedback: a value the AI set and the user changed. The last ones travel with later calls
-- as examples; no model is trained on them.
-- ---------------------------------------------------------------------------------------------

create table public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  module_slug text not null check (length(btrim(module_slug)) > 0),
  -- which call's output was corrected
  kind text not null check (length(btrim(kind)) > 0),
  -- the short input the call saw, to be shown as an example
  input_summary text not null,
  ai_value jsonb not null,
  user_value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_feedback_lookup_idx
  on public.ai_feedback (user_id, kind, module_slug, created_at desc);

-- Both tables are append-only, like `events`: rows are added and read, never changed or
-- removed. A month's spending cannot be made smaller by editing the log.
do $$
declare
  t text;
begin
  foreach t in array array['ai_calls', 'ai_feedback'] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert on table public.%I to authenticated', t);
    execute format(
      'create policy "own rows: read" on public.%I for select to authenticated
         using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows: add" on public.%I for insert to authenticated
         with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Spending. Summed in the database: a month can hold more rows than one API page returns.
-- Both functions run with the caller's rights, so row level security still applies.
-- ---------------------------------------------------------------------------------------------

-- What the AI has cost since the given moment (the gateway passes the start of the month).
create function public.ai_spend_since(p_since timestamptz)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(cost_usd), 0)
    from public.ai_calls
   where user_id = (select auth.uid()) and created_at >= p_since;
$$;

-- The same period broken down by call and model, for the usage view in the settings.
create function public.ai_usage_since(p_since timestamptz)
returns table (
  kind text,
  model text,
  calls bigint,
  failed bigint,
  input_tokens bigint,
  output_tokens bigint,
  cost_usd numeric
)
language sql
stable
set search_path = ''
as $$
  select c.kind,
         c.model,
         count(*),
         count(*) filter (where not c.ok),
         coalesce(sum(c.input_tokens), 0),
         coalesce(sum(c.output_tokens), 0),
         coalesce(sum(c.cost_usd), 0)
    from public.ai_calls c
   where c.user_id = (select auth.uid()) and c.created_at >= p_since
   group by c.kind, c.model
   order by c.kind, c.model;
$$;

revoke all on function public.ai_spend_since(timestamptz) from public, anon;
revoke all on function public.ai_usage_since(timestamptz) from public, anon;
grant execute on function public.ai_spend_since(timestamptz) to authenticated;
grant execute on function public.ai_usage_since(timestamptz) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Work items keep the effort bounds their module proposed (the envelope's `effort.bounds`).
-- The `size` call runs on the server after the proposal has been stored; it reads the bounds
-- from here and keeps its estimate inside them.
-- ---------------------------------------------------------------------------------------------

alter table public.work_items
  add column effort_min_minutes int check (effort_min_minutes is null or effort_min_minutes > 0),
  add column effort_max_minutes int check (effort_max_minutes is null or effort_max_minutes > 0),
  add constraint work_items_effort_bounds_check check (
    (effort_min_minutes is null) = (effort_max_minutes is null)
    and (effort_min_minutes is null or effort_min_minutes <= effort_max_minutes)
  );

-- A budget below zero means nothing; zero switches the AI off for the month.
alter table public.settings
  add constraint settings_ai_budget_check check (ai_monthly_budget_usd >= 0);
