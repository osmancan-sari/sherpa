-- Ç3f: the "deneme" module tries the anchored chains (docs/06-modul-sozlesmesi.md, "Diziler").
--
-- A record of the new kind "rutin" is a daily routine bound to the waking (in the "sabah"
-- facet, or without one) or to the bedtime (in the "aksam" facet), at its place in the chain:
-- `chain_order`, on the order axis the modules share (1–99; spaced 10, 20, 30).
-- Only additions: the column may be empty, the kind list grows.

alter table public.deneme_items
  add column chain_order smallint check (chain_order is null or chain_order between 1 and 99);

alter table public.deneme_items drop constraint deneme_items_kind_check;
alter table public.deneme_items
  add constraint deneme_items_kind_check
  check (kind in ('hedef', 'aliskanlik', 'etkinlik', 'antrenman', 'odak', 'konu', 'rutin'));
