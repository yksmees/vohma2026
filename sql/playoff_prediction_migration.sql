-- Play-off ennustuse ja uue punktisüsteemi migratsioon.
-- Käivita Supabase SQL Editoris enne uue koodi deployd või kohe pärast deployd.

alter table public.matches
add column if not exists winner text;

alter table public.predictions
add column if not exists pred_winner text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_winner_check'
  ) then
    alter table public.matches
    add constraint matches_winner_check
    check (winner is null or winner in ('home', 'away'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'predictions_pred_winner_check'
  ) then
    alter table public.predictions
    add constraint predictions_pred_winner_check
    check (pred_winner is null or pred_winner in ('home', 'away'));
  end if;
end $$;
