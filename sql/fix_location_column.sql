-- Lisa puuduv location veerg ja kindlusta match_no unikaalsus
alter table public.matches
add column if not exists location text;

create unique index if not exists matches_match_no_uq
on public.matches(match_no);
