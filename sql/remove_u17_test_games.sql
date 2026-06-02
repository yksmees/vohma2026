-- Eemalda UEFA U17 testmängud ja nende ennustused.

delete from public.predictions
where match_id in (
  select id from public.matches where stage = 'UEFA U17 TEST'
);

delete from public.matches
where stage = 'UEFA U17 TEST';
