-- Ç3g: where the day's waking came from (docs/03-veri-modeli.md, `days`; docs/06, `TodayBrief.wokeFrom`).
-- 'screen': "Uyandım" or "Biraz önce" on a screen; 'outside': the waking endpoint (`core/wake`,
-- the phone's alarm automation); 'estimate': taken from the day's first touch. Null: no waking,
-- or one written before this column (read as from a screen). Adding only.

alter table public.days
  add column woke_source text
    check (woke_source is null or woke_source in ('screen', 'outside', 'estimate'));

update public.days set woke_source = 'estimate' where woke_at is not null and woke_estimated;
