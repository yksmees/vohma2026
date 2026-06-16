-- Liikumise challenge tabel.
-- Täiesti eraldi ennustusmängu punktidest ja ennustustest.
-- Käivita Supabase SQL Editoris enne Liikumise/Jooks vaate kasutamist.

create table if not exists public.running_entries (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  activity_type text not null default 'run',
  activity_multiplier numeric(5,2) not null default 1.00,
  run_date date not null,
  kilometers numeric(6,2) not null check (kilometers > 0 and kilometers <= 200),
  note text,
  created_at timestamptz not null default now()
);

alter table public.running_entries
  add column if not exists activity_type text not null default 'run';

alter table public.running_entries
  add column if not exists activity_multiplier numeric(5,2) not null default 1.00;

create index if not exists running_entries_player_id_idx
  on public.running_entries(player_id);

create index if not exists running_entries_run_date_idx
  on public.running_entries(run_date desc);

create index if not exists running_entries_created_at_idx
  on public.running_entries(created_at desc);

create index if not exists running_entries_activity_type_idx
  on public.running_entries(activity_type);
