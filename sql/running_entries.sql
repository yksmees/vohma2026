-- Liikumise challenge tabelid.
-- Täiesti eraldi ennustusmängu punktidest ja ennustustest.
-- Käivita Supabase SQL Editoris enne Liikumise/Jooks vaate kasutamist.

create table if not exists public.running_entries (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  activity_type text not null default 'run',
  activity_multiplier numeric(6,2) not null default 1.00,
  run_date date not null,
  kilometers numeric(6,2) not null check (kilometers > 0 and kilometers <= 200),
  note text,
  created_at timestamptz not null default now()
);

alter table public.running_entries
  add column if not exists activity_type text not null default 'run';

alter table public.running_entries
  add column if not exists activity_multiplier numeric(6,2) not null default 1.00;

create table if not exists public.running_activity_types (
  code text primary key,
  label text not null,
  multiplier numeric(6,2) not null check (multiplier > 0 and multiplier <= 100),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.running_activity_types (code, label, multiplier, is_active, sort_order)
values
  ('run', 'Jooks', 1.00, true, 10),
  ('rollerski', 'Suusarull', 0.60, true, 20),
  ('swim', 'Ujumine', 3.00, true, 30),
  ('bike', 'Ratas', 0.40, true, 40),
  ('walk', 'Kõnd', 1.00, false, 90)
on conflict (code) do nothing;

update public.running_activity_types
set label = 'Jooks', multiplier = 1.00, is_active = true, sort_order = 10, updated_at = now()
where code = 'run';

update public.running_activity_types
set label = 'Suusarull', multiplier = 0.60, is_active = true, sort_order = 20, updated_at = now()
where code = 'rollerski';

update public.running_activity_types
set label = 'Ujumine', multiplier = 3.00, is_active = true, sort_order = 30, updated_at = now()
where code = 'swim';

update public.running_activity_types
set label = 'Ratas', multiplier = 0.40, is_active = true, sort_order = 40, updated_at = now()
where code = 'bike';

update public.running_activity_types
set label = 'Kõnd', multiplier = 1.00, is_active = false, sort_order = 90, updated_at = now()
where code = 'walk';

create index if not exists running_entries_player_id_idx
  on public.running_entries(player_id);

create index if not exists running_entries_run_date_idx
  on public.running_entries(run_date desc);

create index if not exists running_entries_created_at_idx
  on public.running_entries(created_at desc);

create index if not exists running_entries_activity_type_idx
  on public.running_entries(activity_type);

create index if not exists running_activity_types_active_sort_idx
  on public.running_activity_types(is_active, sort_order);
