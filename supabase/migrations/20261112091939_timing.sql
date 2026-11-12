-- Ç3b: time constraints (docs/03-veri-modeli.md, "Zaman kısıtları").
--
-- When work can be done: hard windows, preferred and avoided hours, travel time, rest days
-- between two doings of a rhythm. Empty means no constraint. The database only checks that a
-- value is an object; its shape is checked by the app with the same schema as the work
-- envelope (src/core/contract/timing.ts), for module proposals and the user's form alike.
-- Only additions: the columns may be empty, so this can go out before the code that uses it.

alter table public.work_items
  add column timing jsonb check (timing is null or jsonb_typeof(timing) = 'object');

alter table public.tasks
  add column timing jsonb check (timing is null or jsonb_typeof(timing) = 'object');

alter table public.rhythms
  add column timing jsonb check (timing is null or jsonb_typeof(timing) = 'object');
