-- Jooksu challenge tabel.
-- Täiesti eraldi ennustusmängu punktidest ja ennustustest.
-- Käivita Supabase SQL Editoris enne Jooks vaate kasutamist.

create table if not exists public.running_entries (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  run_date date not null,
  kilometers numeric(6,2) not null check (kilometers > 0 and kilometers <= 200),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists running_entries_player_id_idx
  on public.running_entries(player_id);

create index if not exists running_entries_run_date_idx
  on public.running_entries(run_date desc);

create index if not exists running_entries_created_at_idx
  on public.running_entries(created_at desc);
