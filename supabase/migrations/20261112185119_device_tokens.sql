-- Ç3d, step 1: device tokens (docs/03-veri-modeli.md "device_tokens", docs/02-mimari.md
-- "Cihaz anahtarları ve giriş ucu").
--
-- An outside source (the phone's automation, the collector on the computer) writes to the
-- ingest endpoint with a revocable token. The token itself is never stored: only its SHA-256
-- digest. The user reads, adds and revokes their own tokens; the digest, the hint and the scopes
-- never change after the insert, and a revoked token stays revoked.

-- Every scope is "<source>/<kind>" (lower-case letters, digits, dashes), one to fifty of them.
create function public.device_token_scopes_valid(p_scopes text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(p_scopes) between 1 and 50
     and not exists (
       select 1 from unnest(p_scopes) as s(scope)
        where s.scope is null or s.scope !~ '^[a-z0-9-]+/[a-z0-9-]+$'
     );
$$;

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique (id, user_id),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- The first eight characters of the token ("shp_AbCd"), to tell tokens apart in the list.
  hint text not null check (hint ~ '^shp_[A-Za-z0-9_-]{4}$'),
  -- The endpoints it may write to, written like the address: 'core/wake', 'deneme/kayit'.
  scopes text[] not null check (public.device_token_scopes_valid(scopes)),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index device_tokens_user_idx on public.device_tokens (user_id, created_at);

create trigger set_updated_at before update on public.device_tokens
  for each row execute function public.set_updated_at();

-- What may change after the insert: the name, and the revocation (once). The column grants below
-- already keep the user away from the other columns; this holds for every role.
create function public.device_tokens_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.token_hash is distinct from old.token_hash
     or new.hint is distinct from old.hint
     or new.scopes is distinct from old.scopes
     or new.user_id is distinct from old.user_id then
    raise exception 'a device token''s digest, hint, scopes and owner do not change'
      using errcode = 'check_violation';
  end if;
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'a revoked device token stays revoked' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger device_tokens_guard before update on public.device_tokens
  for each row execute function public.device_tokens_guard();

alter table public.device_tokens enable row level security;
revoke all on table public.device_tokens from anon, authenticated;
grant select on table public.device_tokens to authenticated;
-- A new token starts unused and active: the user gives only these four columns.
grant insert (name, token_hash, hint, scopes) on table public.device_tokens to authenticated;
grant update (name, revoked_at) on table public.device_tokens to authenticated;

create policy "own rows: read" on public.device_tokens for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own rows: add" on public.device_tokens for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own rows: change" on public.device_tokens for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Settings → Bağlantılar shows the last use as it happens.
alter publication supabase_realtime add table public.device_tokens;

-- Whose token is this? Called by the server with the secret key only (src/core/server/db.ts):
-- the digest of an active token gives its owner and scopes, and its last use is written. A
-- revoked or unknown digest gives nothing. Nobody signed in can call it: a token is proof of
-- nothing to the browser.
create function public.device_token_owner(p_hash text)
returns table (token_id uuid, user_id uuid, scopes text[])
language sql
security definer
set search_path = ''
as $$
  update public.device_tokens t
     set last_used_at = now()
   where t.token_hash = p_hash and t.revoked_at is null
  returning t.id, t.user_id, t.scopes;
$$;

revoke execute on function public.device_token_owner(text) from public, anon, authenticated;
grant execute on function public.device_token_owner(text) to service_role;
