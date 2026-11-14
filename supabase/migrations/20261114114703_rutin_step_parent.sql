-- Rutin: an add-on hangs on a step of its own routine, and on a step only (no add-on of an
-- add-on). The module page offers nothing else; the database holds to it as well.

create function public.rutin_check_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p public.rutin_steps;
begin
  if new.parent_id is null then
    -- A step that has add-ons cannot become one.
    return new;
  end if;
  select * into p from public.rutin_steps where id = new.parent_id;
  if p.id is null then
    return new; -- the foreign key answers this one
  end if;
  if p.routine_id <> new.routine_id then
    raise exception 'an add-on belongs to its step''s routine' using errcode = '23514';
  end if;
  if p.parent_id is not null then
    raise exception 'an add-on hangs on a step, not on another add-on' using errcode = '23514';
  end if;
  if exists (select 1 from public.rutin_steps where parent_id = new.id) then
    raise exception 'a step with add-ons cannot become an add-on' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger rutin_check_parent before insert or update of parent_id, routine_id
  on public.rutin_steps for each row execute function public.rutin_check_parent();
