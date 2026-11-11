-- Ç2: the spending functions refuse instead of answering 0.
--
-- `ai_spend_since` is the budget check of the AI gateway. Called without a signed-in user (for
-- example with the secret key) or without a start, the first version summed no rows and said
-- "nothing spent", so a wrongly wired gateway would have passed the budget silently.

create or replace function public.ai_spend_since(p_since timestamptz)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_total numeric;
begin
  if v_user is null then
    raise exception 'ai_spend_since needs a signed-in user' using errcode = '42501';
  end if;
  if p_since is null then
    raise exception 'ai_spend_since needs a start' using errcode = '22004';
  end if;
  select coalesce(sum(cost_usd), 0)
    into v_total
    from public.ai_calls
   where user_id = v_user and created_at >= p_since;
  return v_total;
end;
$$;

create or replace function public.ai_usage_since(p_since timestamptz)
returns table (
  kind text,
  model text,
  calls bigint,
  failed bigint,
  input_tokens bigint,
  output_tokens bigint,
  cost_usd numeric
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'ai_usage_since needs a signed-in user' using errcode = '42501';
  end if;
  if p_since is null then
    raise exception 'ai_usage_since needs a start' using errcode = '22004';
  end if;
  return query
    select c.kind,
           c.model,
           count(*),
           count(*) filter (where not c.ok),
           coalesce(sum(c.input_tokens), 0)::bigint,
           coalesce(sum(c.output_tokens), 0)::bigint,
           coalesce(sum(c.cost_usd), 0)
      from public.ai_calls c
     where c.user_id = v_user and c.created_at >= p_since
     group by c.kind, c.model
     order by c.kind, c.model;
end;
$$;

-- `create or replace` keeps the grants of the first version; restated so the file reads alone.
revoke all on function public.ai_spend_since(timestamptz) from public, anon;
revoke all on function public.ai_usage_since(timestamptz) from public, anon;
grant execute on function public.ai_spend_since(timestamptz) to authenticated;
grant execute on function public.ai_usage_since(timestamptz) to authenticated;
