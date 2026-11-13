-- Ç3e: a module's facets (docs/06-modul-sozlesmesi.md, "Bölümler"; docs/03-veri-modeli.md).
--
-- A module may split itself into facets (morning and evening of a routine, the courses of a
-- school term): the same data and page, a colour and a scene of their own on the main screen.
-- Work carries the key of its facet; the module's facet list lives in code (computed with the
-- module's context), so the database only checks the key's spelling. The user owns the module's
-- colour and the facets' colours (Settings → Modules).
-- Only additions: the columns may be empty, so this can go out before the code that uses it.

-- The spelling of a facet key: lower-case letters, digits and dashes, at most 40.
create function public.is_facet_key(p_key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_key ~ '^[a-z0-9][a-z0-9-]{0,39}$'
$$;

alter table public.work_items
  add column facet text check (facet is null or public.is_facet_key(facet));

alter table public.tasks
  add column facet text check (facet is null or public.is_facet_key(facet));

alter table public.rhythms
  add column facet text check (facet is null or public.is_facet_key(facet));

alter table public.blocks
  add column facet text check (facet is null or public.is_facet_key(facet));

-- The user's colours of the module's facets: { "sabah": "#d97706" }. Keys are facet keys,
-- values #rrggbb; a facet without a key here has the module's default for it.
create function public.valid_facet_colors(p_colors jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_colors) = 'object'
    and coalesce(
      (select bool_and(
                public.is_facet_key(c.key)
                and jsonb_typeof(c.value) = 'string'
                and (c.value #>> '{}') ~ '^#[0-9a-fA-F]{6}$')
         from jsonb_each(p_colors) as c),
      true)
$$;

alter table public.modules
  add column facet_colors jsonb not null default '{}'::jsonb
    check (public.valid_facet_colors(facet_colors));

-- The module's colour is the user's now: whatever is written must still be a colour. `not valid`:
-- rows made before this are not checked now (every one came from a definition, which the
-- registry checks, or the sample data), but any later update of such a row must pass it.
alter table public.modules
  add constraint modules_color_hex check (color ~ '^#[0-9a-fA-F]{6}$') not valid;

revoke all on function public.is_facet_key(text) from public, anon;
revoke all on function public.valid_facet_colors(jsonb) from public, anon;
grant execute on function public.is_facet_key(text) to authenticated, service_role;
grant execute on function public.valid_facet_colors(jsonb) to authenticated, service_role;
