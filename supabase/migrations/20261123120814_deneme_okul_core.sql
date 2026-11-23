-- Okul çekirdek A: the "deneme" module's examples of the core's new abilities
-- (prompts/okul-cekirdek-a.md, "deneme modülünde örnekler"). Only its own table changes.
--
-- - placeholder: the record's work is proposed with a placeholder effort and a reason
--   (`effort.provisional`, `effort.basis`) until its minutes are given.
-- - two kinds of focused sittings with the kit's scene layouts: "pomodoro" (rounds and breaks;
--   it tells the counted minutes) and "akis" (a flow with breaks of its own; it asks "Nerede
--   kaldın?" on the way out, `beforeExit`). "antrenman" keeps its steps on the checklist.
-- - layout_state: the layout's state (which round, since when, paused), so a reload and the other
--   device show the same; exit_note: the sentence written on the way out of a flow, and when.
-- - block_note: the one-line note written in a fixed block's view (`ui.blockView`).

alter table public.deneme_items drop constraint deneme_items_kind_check;
alter table public.deneme_items
  add constraint deneme_items_kind_check
  check (kind in ('hedef', 'aliskanlik', 'etkinlik', 'antrenman', 'odak', 'konu', 'rutin',
                  'pomodoro', 'akis'));

alter table public.deneme_items
  add column placeholder boolean not null default false,
  add column layout_state jsonb,
  add column exit_note text check (exit_note is null or char_length(exit_note) <= 300),
  add column exit_noted_at timestamptz,
  add column block_note text check (block_note is null or char_length(block_note) <= 300);
