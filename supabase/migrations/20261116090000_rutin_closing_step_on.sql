-- Ç4c (docs/moduller/rutin.md, "Yarının listesi"; the user's decision, 15 Nov 2026): the evening
-- closing is part of the evening routine. Rutin's closing step ("Yarının listesi", kind
-- 'closing') comes switched on, between "Yüz" and "Telefonu salona bırak"; for a user who has
-- the routine already it is switched on once here (it can be switched off on the module page).
-- Only steps the start list wrote and nobody switched on yet are touched: phase 2, off. Its
-- planned length is the closing's few minutes unless the user typed one; the evening's rhythm
-- (Rutin proposes it from its open steps, `proposeAll`) gets those minutes too, so the planner
-- counts the evening's chain as the module would propose it (rounded and at most 90, as
-- `proposalMinutes`).

with switched as (
  update public.rutin_steps
  set
    active = true,
    phase = 1,
    seconds = case when seconds_auto and seconds = 0 then 240 else seconds end,
    hint = case
      when hint = 'Çekirdeğin kapanışına geçer.' then 'Yarının planına bak; aklında kalanları yaz.'
      else hint
    end
  where kind = 'closing'
    and active = false
    and phase = 2
    and parent_id is null
  returning user_id, routine_id, seconds
)
update public.rhythms as rhythm
set est_minutes = least(90, rhythm.est_minutes + round(switched.seconds / 60.0)::int)
from switched
join public.rutin_routines as routine on routine.id = switched.routine_id
where rhythm.user_id = switched.user_id
  and rhythm.source_type = 'rutin.routine'
  and rhythm.source_id = routine.id
  and routine.key = 'aksam'
  and switched.seconds > 0
  -- A length the user typed is theirs (the core keeps it from the module's proposals too).
  and coalesce(rhythm.provenance ->> 'est_minutes', '') <> 'user';
