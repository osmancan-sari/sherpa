-- Ç3b: the "deneme" module gets a kind of record that uses every time constraint of the work
-- envelope (src/modules/deneme/rules.ts): antrenman, a workout at a gym. Only widens the check.

alter table public.deneme_items drop constraint deneme_items_kind_check;
alter table public.deneme_items
  add constraint deneme_items_kind_check
  check (kind in ('hedef', 'aliskanlik', 'etkinlik', 'antrenman'));
