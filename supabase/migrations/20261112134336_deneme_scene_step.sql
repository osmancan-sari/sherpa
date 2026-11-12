-- Ç3c: the "deneme" module's step scene (src/modules/deneme/components/Scenes.tsx) keeps which
-- step the running workout is on in its own row: both screens follow it over the live
-- connection (docs/06-modul-sozlesmesi.md, "Sahne", rule 4). Null: not started.
alter table public.deneme_items
  add column scene_step int check (scene_step is null or scene_step >= 0);

-- A kind of its own for the free scene, "odak" (a focused sitting on a goal): the module's other
-- goals keep the standard card.
alter table public.deneme_items drop constraint deneme_items_kind_check;
alter table public.deneme_items
  add constraint deneme_items_kind_check
  check (kind in ('hedef', 'aliskanlik', 'etkinlik', 'antrenman', 'odak'));
