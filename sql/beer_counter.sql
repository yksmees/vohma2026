-- Beer Counter tabel.
-- Eraldi tabel, ei mõjuta jalka ennustusi, punkte, edetabeleid, API-Footballit ega cron'i.

create table if not exists public.beer_entries (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  beer_size_liters numeric(4,2) not null check (beer_size_liters in (0.33, 0.50)),
  beer_count integer not null check (beer_count > 0 and beer_count <= 24),
  total_liters numeric(7,2) not null check (total_liters > 0 and total_liters <= 12),
  created_at timestamptz not null default now()
);

create index if not exists beer_entries_player_id_idx
  on public.beer_entries(player_id);

create index if not exists beer_entries_created_at_idx
  on public.beer_entries(created_at desc);

create index if not exists beer_entries_size_idx
  on public.beer_entries(beer_size_liters);
