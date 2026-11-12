-- Ç3d, step 4: scheduled jobs (docs/02-mimari.md "Zamanlanmış işler", docs/03-veri-modeli.md
-- "job_runs").
--
-- One endpoint, /api/jobs/tick, runs the jobs whose period has come, for every account, in that
-- account's name. Each run is kept here; (account, job, period) is unique, so two ticks at once
-- run a job once. The trigger is the database's own scheduler: every 15 minutes pg_cron calls
-- public.sherpa_tick(), which posts to the app with pg_net. The app's address and the shared
-- secret live in Vault; without them the tick does nothing (local stacks, a project not yet set
-- up). The free plan of the host allows its own cron only once a day (November 2026); that one
-- is kept as a daily fallback (vercel.json).

create type public.job_status as enum ('running', 'done', 'failed');

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  -- '<source>/<key>': 'core/week', 'deneme/ozet'.
  job text not null check (job ~ '^[a-z0-9-]+/[a-z0-9-]+$'),
  -- The period: '2026-11-12T10' (hour), '2026-11-12' (day), the week's Monday (week).
  slot text not null check (slot ~ '^\d{4}-\d{2}-\d{2}(T\d{2})?$'),
  status public.job_status not null default 'running',
  attempts int not null default 1 check (attempts between 1 and 3),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text check (char_length(error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job, slot)
);

create index job_runs_recent_idx on public.job_runs (user_id, started_at);

create trigger set_updated_at before update on public.job_runs
  for each row execute function public.set_updated_at();

alter table public.job_runs enable row level security;
revoke all on table public.job_runs from anon, authenticated;
-- Kept, never removed. Which job and period a run is never changes; how it went does.
grant select on table public.job_runs to authenticated;
grant insert (job, slot, status, attempts, finished_at, error)
  on table public.job_runs to authenticated;
grant update (status, attempts, started_at, finished_at, error)
  on table public.job_runs to authenticated;

create policy "own rows: read" on public.job_runs for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own rows: add" on public.job_runs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own rows: change" on public.job_runs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Which accounts the jobs run for. Asked by the server with the secret key only
-- (src/core/server/db.ts); it reads no one's data, only who there is.
create function public.job_users()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users order by created_at;
$$;

revoke execute on function public.job_users() from public, anon, authenticated;
grant execute on function public.job_users() to service_role;

-- ---------------------------------------------------------------------------------------------
-- The trigger: pg_cron every 15 minutes → pg_net → POST <sherpa_tick_url> with the secret.
-- ---------------------------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Posts the tick when the project is set up: the app's tick address and the shared secret are
-- in Vault (`sherpa_tick_url`, `sherpa_cron_secret`; steps in docs/ILERLEME.md). Without them,
-- nothing happens. Returns the pg_net request id, or null.
create function public.sherpa_tick()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'sherpa_tick_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'sherpa_cron_secret';
  if v_url is null or v_secret is null or v_url = '' or v_secret = '' then
    return null;
  end if;
  return net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function public.sherpa_tick() from public, anon, authenticated;

-- Every 15 minutes. Scheduling the same name again replaces the job, so this is safe to rerun.
select cron.schedule('sherpa-tick', '*/15 * * * *', 'select public.sherpa_tick()');
