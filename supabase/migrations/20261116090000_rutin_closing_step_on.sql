-- Ç4c (docs/moduller/rutin.md, "Yarının listesi"; the user's decision, 15 Nov 2026): the evening
-- closing is part of the evening routine. Rutin's closing step ("Yarının listesi", kind
-- 'closing') comes switched on, between "Yüz" and "Telefonu salona bırak"; for a user who has
-- the routine already it is switched on once here (it can be switched off on the module page).
-- Only steps the start list wrote and nobody switched on yet are touched: phase 2, off. Its
-- planned length is the closing's few minutes unless the user typed one.

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
  and parent_id is null;
