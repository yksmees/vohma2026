alter table public.matches
add column if not exists api_status_short text,
add column if not exists went_extra boolean not null default false;
