-- Okul step 1, step audit 1 (finding 11): the module's session log points at the core's session
-- like every module table that names one (docs/03-veri-modeli.md; rutin_runs does the same). A
-- session removed with its account takes its line with it.
alter table public.okul_session_log
  add constraint okul_session_log_session_fk
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade;
