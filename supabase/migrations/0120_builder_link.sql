-- The Programme Builder (a Claude Project using the Supabase connector)
-- reads a client and saves plan code through these few functions instead of
-- David copying text in and out. They live in their own "builder" schema,
-- which the app's public API does not expose, and only the database owner
-- can run them, so no client or browser can call them.

create schema if not exists builder;
revoke all on schema builder from public, anon, authenticated;

-- Find a client by any part of their name or email.
create or replace function builder.find_client(search text)
returns table (client_id uuid, name text, email text, brand text, awaiting_approval boolean, joined date)
language sql stable
set search_path to 'public'
as $$
  select p.id,
         trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
         p.email,
         coalesce(bp.name, 'Athena'),
         p.awaiting_approval,
         p.created_at::date
  from patients p
  left join brand_packs bp on bp.id = p.brand_pack_id
  where trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) ilike '%' || search || '%'
     or p.email ilike '%' || search || '%'
  order by p.created_at desc
  limit 10;
$$;

-- Everything the builder needs about one client, oldest first: their
-- details, every consultation and form, their voice notes, and what they
-- have logged against their current programme.
create or replace function builder.client_context(client uuid)
returns jsonb
language sql stable
set search_path to 'public'
as $$
  with current_prog as (
    select * from programmes
    where patient_id = client and delivery_mode = 'scheduled' and access_paused_at is null
    order by created_at desc limit 1
  )
  select jsonb_build_object(
    'client', (
      select jsonb_build_object(
        'name', trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')),
        'date_of_birth', date_of_birth, 'occupation', occupation, 'sport', sport,
        'presenting_complaint', presenting_complaint, 'date_of_onset', date_of_onset,
        'mechanism_of_injury', mechanism_of_injury, 'referral_goals_history', referral_goals_history,
        'irritability', irritability, 'red_flags', red_flags, 'clinic_location', clinic_location)
      from patients where id = client),
    'consultations_and_forms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', consulted_on, 'timepoint', timepoint,
        'summary', summary_text, 'full_notes', notes_text) order by consulted_on, created_at)
      from client_context_entries where patient_id = client), '[]'::jsonb),
    'voice_notes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', created_at::date, 'about', context_title, 'week', week_number, 'transcript', transcript) order by created_at)
      from voice_notes where patient_id = client), '[]'::jsonb),
    'programmes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', title, 'start', start_date::date, 'weeks', block_length_weeks,
        'mode', delivery_mode, 'paused', access_paused_at is not null) order by created_at)
      from programmes where patient_id = client), '[]'::jsonb),
    'current_programme', (
      select jsonb_build_object(
        'title', cp.title, 'start', cp.start_date::date, 'weeks', cp.block_length_weeks,
        'current_week', least(cp.block_length_weeks, greatest(1, floor((current_date - cp.start_date::date) / 7)::int + 1)),
        'cardio_logs', coalesce((
          select jsonb_agg(jsonb_build_object(
            'week', l.week_number, 'session', coalesce(w.name, 'session'),
            'finished', l.completed_quality, 'pain', l.pain_score,
            'next_morning', l.next_morning_answer, 'note', l.note) order by l.week_number, l.completed_at)
          from programme_card_logs l left join workouts w on w.id = l.workout_id
          where l.programme_id = cp.id), '[]'::jsonb),
        'strength_sessions_completed_by_week', coalesce((
          select jsonb_object_agg(wk, n) from (
            select week_number as wk, count(distinct day_of_week) as n
            from session_completions
            where programme_id = cp.id and status = 'completed'
            group by week_number) s), '{}'::jsonb),
        'repeats_and_flare_ups', coalesce((
          select jsonb_agg(jsonb_build_object('kind', kind, 'week', week_number, 'date', created_at::date) order by created_at)
          from programme_events where programme_id = cp.id), '[]'::jsonb))
      from current_prog cp),
    'drafts_waiting', coalesce((
      select jsonb_agg(jsonb_build_object('draft_id', id, 'title', block_title, 'start', start_date, 'saved', created_at::date) order by created_at)
      from imported_plans where patient_id = client and status = 'draft'), '[]'::jsonb)
  );
$$;

-- Your own strength library, by name, so the builder can suggest sessions
-- you already have rather than inventing new ones.
create or replace function builder.strength_library()
returns table (workout text, high_load boolean, tags text[])
language sql stable
set search_path to 'public'
as $$
  select name, high_load, designations from workouts
  where programme_id is null
  order by name;
$$;

-- Saves plan code as a draft on the client's record, where it appears in
-- Drafts from Claude. The builder app checks it fully when David opens it.
create or replace function builder.save_draft(client uuid, plan jsonb)
returns text
language plpgsql
set search_path to 'public'
as $$
declare
  draft_id uuid;
begin
  if not exists (select 1 from patients where id = client) then
    raise exception 'No client with that id.';
  end if;
  if plan->>'format' is distinct from 'athena-plan-v1' then
    raise exception 'The plan code must have "format": "athena-plan-v1".';
  end if;
  if coalesce(plan->>'client_name', '') = '' or coalesce(plan->>'block_title', '') = '' then
    raise exception 'The plan code needs a client_name and a block_title.';
  end if;
  if (plan->>'start_date') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'The plan code needs a start_date written as YYYY-MM-DD.';
  end if;

  insert into imported_plans (patient_id, raw_json, client_name_in_plan, block_title, start_date, effective_start_date, status)
  values (client, plan, plan->>'client_name', plan->>'block_title', (plan->>'start_date')::date, (plan->>'start_date')::date, 'draft')
  returning id into draft_id;

  return 'Saved. It is waiting in Drafts from Claude on the client''s Overview (draft ' || draft_id || ').';
end;
$$;

revoke all on all functions in schema builder from public, anon, authenticated;
