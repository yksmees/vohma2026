-- Jooksu vaate väravate arvestus: 90 min + lisaaeg, penalteid ei loeta.
-- Need veerud EI mõjuta ennustusmängu punktiarvestust.
alter table public.matches
add column if not exists goals_home_120 int,
add column if not exists goals_away_120 int;

-- Kui migratsioon käivitatakse olemasoleva andmebaasi peal, täida vana teadaolev 90 minuti skoor algväärtuseks.
-- API sync uuendab lisaajaga mängud hiljem 120 minuti skooriks.
update public.matches
set goals_home_120 = final_home,
    goals_away_120 = final_away
where is_finished = true
  and final_home is not null
  and final_away is not null
  and goals_home_120 is null
  and goals_away_120 is null;
