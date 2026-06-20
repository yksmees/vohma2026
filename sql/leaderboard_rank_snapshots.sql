-- Edetabeli nooleinfo snapshotid.
-- Eraldi abitable ainult kohtade muutuse noolte jaoks.
-- Ei mõjuta ennustusi, punktiarvestust, mänge, API-Footballit, cron'i, Beer Counterit ega liikumise challenge'it.

create table if not exists public.leaderboard_rank_snapshots (
  id bigserial primary key,
  leaderboard_type text not null check (leaderboard_type in ('group', 'playoff', 'overall')),
  snapshot_role text not null check (snapshot_role in ('previous', 'current')),
  player_id uuid not null references public.players(id) on delete cascade,
  rank integer not null check (rank > 0),
  points integer not null default 0,
  fingerprint text not null,
  snapshot_at timestamptz not null default now()
);

create index if not exists leaderboard_rank_snapshots_type_role_idx
  on public.leaderboard_rank_snapshots(leaderboard_type, snapshot_role);

create index if not exists leaderboard_rank_snapshots_player_idx
  on public.leaderboard_rank_snapshots(player_id);

create index if not exists leaderboard_rank_snapshots_snapshot_at_idx
  on public.leaderboard_rank_snapshots(snapshot_at desc);
