-- Ç3d, step 2: the server works in the user's name (docs/02-mimari.md, "Sunucuda kullanıcı
-- adına erişim").
--
-- The ingest endpoint and the scheduled jobs have no browser session. The server knows whose
-- work it is doing (the token's owner, the job's account) and goes to the database as that user:
-- with the secret key and the header `x-sherpa-user: <user id>`. Before every Data API request
-- PostgREST runs the function below (db_pre_request); for a request made with the secret key
-- and carrying the header it switches the request to the `authenticated` role with that user's
-- claims. Row level security, `default auth.uid()` and every function that reads auth.uid() then
-- work exactly as they do for the signed-in browser: another account's rows are not there.
--
-- The header means nothing on any other request: the browser's publishable key and a user's
-- session keep their own role and claims. A malformed header fails the request instead of
-- leaving it with the secret key's full rights.

create function public.sherpa_pre_request()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user text := nullif(current_setting('request.headers', true), '')::json ->> 'x-sherpa-user';
begin
  if v_user is null or current_user <> 'service_role' then
    return;
  end if;
  if v_user !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'x-sherpa-user must be a user id' using errcode = '22023';
  end if;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated', 'aud', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', v_user, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Execute stays open to every role on purpose (unlike the other functions here): PostgREST runs
-- it as the request's own role (anon, authenticated, service_role) before every request, and
-- revoking it would break the whole Data API. Called directly it does nothing for those roles.

alter role authenticator set pgrst.db_pre_request = 'public.sherpa_pre_request';
notify pgrst, 'reload config';

-- Who this request runs as: the user's id once the switch above took place, else null. The
-- server's helper asks this before it hands out a client, so a database without the switch
-- (the function missing) never serves a request with the secret key's full rights.
create function public.sherpa_acting_user()
returns uuid
language sql
stable
set search_path = ''
as $$
  select case when current_user = 'authenticated' then auth.uid() end;
$$;

revoke execute on function public.sherpa_acting_user() from public, anon;
grant execute on function public.sherpa_acting_user() to authenticated, service_role;
