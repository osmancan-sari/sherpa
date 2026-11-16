-- Sabah açılışı (16 Nov 2026; docs/03-veri-modeli.md, `days`; docs/06, "Sahne" rule 7): when
-- "Şimdi değil" was said on the morning's welcome. The day's row holds it, so it reaches every
-- device of the account live: the welcome does not come by itself again that day on any screen.
-- Adding only; the row's own RLS covers it.

alter table public.days
  add column welcome_later_at timestamptz;
