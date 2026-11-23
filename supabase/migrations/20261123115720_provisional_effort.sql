-- Okul çekirdek A (docs/03-veri-modeli.md, work_items; docs/06-modul-sozlesmesi.md, "İş zarfı"):
-- a work item's effort may be a placeholder until the module knows better (an exam's preparation
-- before its documents exist), with one sentence of why. The planner counts it like any effort;
-- the screens mark it "yaklaşık"; "Neden?" shows the sentence. Only additions.

alter table public.work_items
  add column effort_provisional boolean not null default false,
  add column effort_basis text
    check (effort_basis is null or (char_length(effort_basis) between 1 and 200 and effort_basis !~ '[\n\r]'));

comment on column public.work_items.effort_provisional is
  'The effort is a placeholder (the module will give the real one); never true for the user''s own effort.';
comment on column public.work_items.effort_basis is
  'One sentence of why the effort is what it is (shown under "Neden?"); at most 200 characters.';
