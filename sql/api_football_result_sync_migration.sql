alter table public.matches
add column if not exists manual_result_override boolean not null default false;

alter table public.matches
add column if not exists api_football_fixture_id bigint;
