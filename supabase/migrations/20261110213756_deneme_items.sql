-- Module "deneme" (src/modules/deneme): the small test module the core is tried against until
-- real modules arrive. Its one table follows the same rules as every table: user_id, RLS,
-- no access for the anonymous role. Only the module itself reads and writes it.

create table public.deneme_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  -- hedef: a goal with a deadline; aliskanlik: something repeated; etkinlik: a fixed time
  kind text not null default 'hedef' check (kind in ('hedef', 'aliskanlik', 'etkinlik')),
  due_on date,
  minutes int check (minutes is null or minutes > 0),
  done boolean not null default false,
  -- filled in when the core reports the outcome of the proposed work
  spent_minutes int,
  -- the answer to the module's question after the work is done
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.deneme_items
  for each row execute function public.set_updated_at();

alter table public.deneme_items enable row level security;
revoke all on table public.deneme_items from anon, authenticated;
grant select, insert, update, delete on table public.deneme_items to authenticated;
create policy "own rows" on public.deneme_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.deneme_items;
