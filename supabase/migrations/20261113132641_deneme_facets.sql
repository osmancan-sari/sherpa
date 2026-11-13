-- Ç3e: the "deneme" module tries facets (docs/06-modul-sozlesmesi.md, "Bölümler").
--
-- Two fixed facets ("sabah", "aksam") a record can be in, and facets from the module's data:
-- every open record of the new kind "konu" (a topic, as a course is in the school module) is a
-- facet of its own. A topic proposes no work.
-- Only additions: the column may be empty, the kind list grows.

alter table public.deneme_items
  add column facet text check (facet is null or public.is_facet_key(facet));

alter table public.deneme_items drop constraint deneme_items_kind_check;
alter table public.deneme_items
  add constraint deneme_items_kind_check
  check (kind in ('hedef', 'aliskanlik', 'etkinlik', 'antrenman', 'odak', 'konu'));
