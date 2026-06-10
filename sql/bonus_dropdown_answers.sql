alter table public.bonus_questions
add column if not exists answer_type text not null default 'text',
add column if not exists options_source text,
add column if not exists correct_answer_value text;

alter table public.bonus_answers
add column if not exists answer_value text;

update public.bonus_questions
set answer_type = case
  when lower(question_text) like '%maailmameistriks%' then 'team'
  when lower(question_text) like '%suurim väravakütt%' then 'player'
  when lower(question_text) like '%messi%' then 'number'
  when lower(question_text) like '%ronaldo%' then 'number'
  when lower(question_text) like '%võidab meie alagrupiturniiri%' then 'registered_user'
  when lower(question_text) like '%jääb meie alagrupiturniiri%' then 'registered_user'
  else coalesce(answer_type, 'text')
end,
options_source = case
  when lower(question_text) like '%maailmameistriks%' then 'fifa_2026_teams'
  when lower(question_text) like '%suurim väravakütt%' then 'fifa_2026_players'
  when lower(question_text) like '%messi%' then 'number_0_20'
  when lower(question_text) like '%ronaldo%' then 'number_0_20'
  when lower(question_text) like '%võidab meie alagrupiturniiri%' then 'registered_users'
  when lower(question_text) like '%jääb meie alagrupiturniiri%' then 'registered_users'
  else options_source
end;
