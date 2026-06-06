-- Püsiv seadistus lisaküsimuste käsitsi lukustamiseks.
-- Käivita see Supabase SQL Editoris üks kord.

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('bonus_manual_locked', 'false')
on conflict (key) do nothing;
