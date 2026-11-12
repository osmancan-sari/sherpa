-- Ç3d, step 3: the requests the ingest endpoint took (docs/03-veri-modeli.md "ingest_requests",
-- docs/02-mimari.md "Cihaz anahtarları ve giriş ucu").
--
-- One row per request whose token was recognised: its kind, how it ended, the name of what was
-- wrong. Never the body, never the token. The rate limit is counted from here, and a repeated
-- `Idempotency-Key` of the same token finds its first request here (unique). The server writes
-- the rows in the token owner's name; the user may read them.

create type public.ingest_status as enum ('processing', 'done', 'rejected', 'failed');

create table public.ingest_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  token_id uuid not null,
  foreign key (token_id, user_id) references public.device_tokens (id, user_id) on delete cascade,
  source text not null check (source ~ '^[a-z0-9-]+$'),
  kind text not null check (kind ~ '^[a-z0-9-]+$'),
  -- The SHA-256 digest of the request's Idempotency-Key, never the key itself: a sender that
  -- puts something secret there by mistake leaves no trace of it.
  idempotency_key text check (idempotency_key ~ '^[0-9a-f]{64}$'),
  status public.ingest_status not null,
  http_status int not null check (http_status between 100 and 599),
  error text check (char_length(error) <= 300),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A key once per token. A failed request gives its key back (set to null) for a retry.
  unique (token_id, idempotency_key)
);

create index ingest_requests_rate_idx on public.ingest_requests (token_id, created_at);

create trigger set_updated_at before update on public.ingest_requests
  for each row execute function public.set_updated_at();

alter table public.ingest_requests enable row level security;
revoke all on table public.ingest_requests from anon, authenticated;
-- Kept, never removed: the record of what came in. The moment and the kind of a request are
-- fixed once written (the rate limit counts by them); only how it ended changes, and its key is
-- given back when it failed.
grant select on table public.ingest_requests to authenticated;
grant insert (token_id, source, kind, idempotency_key, status, http_status, error, finished_at)
  on table public.ingest_requests to authenticated;
grant update (status, http_status, error, finished_at, idempotency_key)
  on table public.ingest_requests to authenticated;

create policy "own rows: read" on public.ingest_requests for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own rows: add" on public.ingest_requests for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own rows: change" on public.ingest_requests for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
