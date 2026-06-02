-- Puhasta kasutajad uue Võhma Lihakombinaadi ennustusvõistluse lehe jaoks.
-- See jätab alles kõik admin kasutajad.
-- Kustutab mitte-admin kasutajate ennustused ja seejärel mitte-admin kasutajad.

delete from public.predictions
where player_id in (
  select id from public.players where coalesce(is_admin, false) = false
);

delete from public.players
where coalesce(is_admin, false) = false;
