-- UEFA U17 testmängud lehe testimiseks.
-- Match no on negatiivne, et need ilmuksid ennustusvaate alguses.
-- Hiljem eemaldamiseks käivita sql/remove_u17_test_games.sql

insert into public.matches (stage, match_no, kickoff_utc, home, away, location)
values
  ('UEFA U17 TEST', -3, '2026-06-04T11:30:00Z', 'Belgium U17', 'France U17', 'Kadriorg Stadium'),
  ('UEFA U17 TEST', -2, '2026-06-04T17:00:00Z', 'Italy U17', 'Spain U17', 'Lilleküla Stadium'),
  ('UEFA U17 TEST', -1, '2026-06-07T17:00:00Z', 'Belgium/France U17', 'Italy/Spain U17', 'Lilleküla Stadium')
on conflict (match_no) do update set
  stage = excluded.stage,
  kickoff_utc = excluded.kickoff_utc,
  home = excluded.home,
  away = excluded.away,
  location = excluded.location;
