create or replace function public.leaderboard()
returns table(player_id uuid, display_name text, points bigint) as $$
  select p.id as player_id, p.display_name, coalesce(sum(pr.points),0)::bigint as points
  from public.players p
  left join public.predictions pr on pr.player_id = p.id
  group by p.id, p.display_name
  order by points desc, p.display_name asc;
$$ language sql stable;
