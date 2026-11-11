-- A sitting (a task with work_item_id) is a copy of its work item at the moment "Başla" made
-- it: name, deadline, importance, energy, context and length. While the sitting is open it
-- stands for the item in the Today list, so it has to follow the item when the user edits it or
-- the module proposes it again; otherwise the list shows and sorts by the old values. Sittings
-- that are finished or dropped are history and keep what they had.
--
-- The function runs with the rights of whoever changed the item, so row level security applies
-- to the tasks it touches as well.

create function public.sync_open_sittings()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.tasks
     set title = new.title,
         due_at = new.due_at,
         importance = new.importance,
         energy = coalesce(new.energy, 'light'),
         context = coalesce(new.context, 'any'),
         -- An item with a session length has sittings of that length; without one the sitting
         -- keeps the length it has. (greatest and least skip nulls, hence the case.)
         est_minutes = case
           when new.session_minutes is null then est_minutes
           else least(90, greatest(5, new.session_minutes))
         end
   where work_item_id = new.id
     and user_id = new.user_id
     and status in ('todo', 'doing', 'waiting');
  return null;
end;
$$;

revoke all on function public.sync_open_sittings() from public, anon;

create trigger sync_open_sittings
  after update of title, due_at, importance, energy, context, session_minutes on public.work_items
  for each row
  when (
    old.title is distinct from new.title
    or old.due_at is distinct from new.due_at
    or old.importance is distinct from new.importance
    or old.energy is distinct from new.energy
    or old.context is distinct from new.context
    or old.session_minutes is distinct from new.session_minutes
  )
  execute function public.sync_open_sittings();
