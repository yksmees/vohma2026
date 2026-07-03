-- Käivita alles siis, kui /api/admin/audit/worldcup-integrity ei näita vigu
-- ja oled finished tulemused üle vaadanud.
-- See ei muuda skoore ega punkte. Paneb ainult verified finished mängudele manual_result_override=true,
-- et API sync ei saaks neid tulemusi hiljem kõigutada.

-- 1) PREVIEW: mis read lukustataks?
select
  match_no,
  home,
  away,
  final_home,
  final_away,
  winner,
  went_extra,
  is_finished,
  manual_result_override
from matches
where match_no between 1 and 104
  and is_finished = true
  and final_home is not null
  and final_away is not null
  and coalesce(manual_result_override, false) = false
order by match_no;

-- 2) UPDATE: lukusta ainult samad finished read.
-- Kui preview tundub õige, eemalda alloleva update kommentaar ja käivita.

-- update matches
-- set
--   manual_result_override = true,
--   updated_at = now()
-- where match_no between 1 and 104
--   and is_finished = true
--   and final_home is not null
--   and final_away is not null
--   and coalesce(manual_result_override, false) = false;

-- 3) KONTROLL: pärast update'it peaks sama päring andma 0 rida.
select count(*) as still_unlocked_finished_results
from matches
where match_no between 1 and 104
  and is_finished = true
  and final_home is not null
  and final_away is not null
  and coalesce(manual_result_override, false) = false;
