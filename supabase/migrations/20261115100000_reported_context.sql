-- Ç4a: where the phone was last reported to be (docs/03-veri-modeli.md, `settings`; docs/04,
-- "Bağlam tahmini"). The context endpoint (`core/context`, the phone's automation, later its
-- location) writes it; the phone's screens infer their context from it for three hours. Nobody
-- picks a context by hand any more. Adding only.

alter table public.settings
  add column reported_context public.context_kind,
  add column reported_context_at timestamptz,
  add constraint settings_reported_context_pair
    check ((reported_context is null) = (reported_context_at is null));
