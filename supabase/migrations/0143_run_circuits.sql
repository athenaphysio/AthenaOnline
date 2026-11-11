-- Run Circuits, for return to running clients (brief of 11 November 2026).
--
-- 1. The Run Circuit library: named circuit blocks built by Dr David Silver
--    PhD from his exercise library, each holding his own doses, and phase
--    sets that list blocks in order. Clinic only: no client policies.
-- 2. What a client logs at the end of a Run Circuit, kept beside the usual
--    card log: blocks planned and completed, total run time, whether there
--    was a flare up, and any symptoms in their own words.
-- 3. builder.circuit_library(), read only, so the Programme Builder can use
--    the exact block names.
-- 4. builder.save_draft refuses plan code that names a circuit block that
--    is not in the library, or tries to put exercises inside one.
-- 5. builder.client_context shows the Run Circuit log with each card log,
--    and keeps every field it already returned, unchanged.

-- 1. The library ------------------------------------------------------------

create table if not exists public.run_circuit_blocks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  notes text not null default '',
  -- One entry per exercise, in order:
  -- { exercise_id, name, dose_type: reps | contacts | time, amount, per_side, note }
  exercises jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists run_circuit_blocks_name_key on public.run_circuit_blocks (lower(trim(name)));

create table if not exists public.run_circuit_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  notes text not null default '',
  -- The blocks in this phase, in order.
  block_ids uuid[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists run_circuit_sets_name_key on public.run_circuit_sets (lower(trim(name)));

alter table public.run_circuit_blocks enable row level security;
alter table public.run_circuit_sets enable row level security;

-- 2. The client's log --------------------------------------------------------

-- { blocks_planned, blocks_completed, run_seconds, flare_up, symptoms, not_sure }
alter table public.programme_card_logs add column if not exists run_circuit jsonb;

-- 3. What the Programme Builder reads ---------------------------------------

-- Every circuit block with its exercises and doses, and every phase set with
-- its blocks in order. Read only.
create or replace function builder.circuit_library()
returns jsonb
language sql stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', b.name,
        'notes', b.notes,
        'exercises', coalesce((
          select jsonb_agg(jsonb_build_object(
            'exercise', coalesce(e.name_clinical, x->>'name'),
            'dose', (x->>'amount') || ' ' ||
              case x->>'dose_type' when 'time' then 'seconds' when 'contacts' then 'contacts' else 'reps' end ||
              case when (x->>'per_side')::boolean then ' each side' else '' end,
            'note', nullif(x->>'note', '')) order by ord)
          from jsonb_array_elements(b.exercises) with ordinality as t(x, ord)
          left join exercises e on e.exercise_id = x->>'exercise_id'), '[]'::jsonb),
        'in_phase_sets', coalesce((
          select jsonb_agg(s.name order by s.sort_order, s.name)
          from run_circuit_sets s where b.id = any(s.block_ids)), '[]'::jsonb))
        order by b.sort_order, b.name)
      from run_circuit_blocks b), '[]'::jsonb),
    'phase_sets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', s.name,
        'notes', s.notes,
        'blocks', coalesce((
          select jsonb_agg(b.name order by ord)
          from unnest(s.block_ids) with ordinality as u(bid, ord)
          join run_circuit_blocks b on b.id = u.bid), '[]'::jsonb))
        order by s.sort_order, s.name)
      from run_circuit_sets s), '[]'::jsonb)
  );
$$;

-- 4. Saving a draft ------------------------------------------------------------

create or replace function builder.save_draft(client uuid, plan jsonb)
returns text
language plpgsql
set search_path to 'public'
as $$
declare
  draft_id uuid;
  missing text;
  with_exercises text;
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

  -- Run Circuit sessions: every block must be in the library, by name, and
  -- plan code may never carry exercises of its own.
  with circuit_blocks as (
    select b
    from jsonb_array_elements(case when jsonb_typeof(plan->'weeks') = 'array' then plan->'weeks' else '[]'::jsonb end) w,
         jsonb_array_elements(case when jsonb_typeof(w->'sessions') = 'array' then w->'sessions' else '[]'::jsonb end) s,
         jsonb_array_elements(case when jsonb_typeof(s->'circuit'->'blocks') = 'array' then s->'circuit'->'blocks' else '[]'::jsonb end) b
    where s->>'type' = 'run_circuit' and jsonb_typeof(b) = 'object'
  )
  select
    string_agg(distinct b->>'block', ', ') filter (
      where not exists (select 1 from run_circuit_blocks rb where lower(trim(rb.name)) = lower(trim(coalesce(b->>'block', ''))))),
    string_agg(distinct b->>'block', ', ') filter (where b ? 'exercises' or b ? 'items' or b ? 'exercise')
  into missing, with_exercises
  from circuit_blocks;

  if with_exercises is not null then
    raise exception 'Plan code cannot add or change the exercises in a circuit block (found in: %). Give only the block name, the run and the walk.', with_exercises;
  end if;
  if missing is not null then
    raise exception 'These circuit blocks are not in the Run Circuit library: %. Use builder.circuit_library() for the exact names.', missing;
  end if;

  insert into imported_plans (patient_id, raw_json, client_name_in_plan, block_title, start_date, effective_start_date, status)
  values (client, plan, plan->>'client_name', plan->>'block_title', (plan->>'start_date')::date, (plan->>'start_date')::date, 'draft')
  returning id into draft_id;

  return 'Saved. It is waiting in Drafts from Claude on the client''s Overview (draft ' || draft_id || ').';
end;
$$;

-- 5. The client's record, as the Programme Builder reads it -----------------

create or replace function builder.client_context(client uuid)
returns jsonb
language sql stable
set search_path to 'public'
as $$
  with current_prog as (
    select * from programmes
    where patient_id = client and delivery_mode = 'scheduled' and access_paused_at is null
    order by created_at desc limit 1
  ),
  -- Everything from the last 12 weeks: Concept2, uploaded CSVs and files,
  -- and rows typed in by hand, plus uploaded rides and other files that
  -- never became a result.
  sessions as (
    select r.source, r.rowed_on as day, r.sport, r.workout_type, r.distance_m, r.time_tenths,
           r.avg_watts, r.avg_split_seconds, r.stroke_rate, r.drag_factor, r.avg_hr, r.intervals, r.note, r.created_at
    from rowing_results r
    where r.patient_id = client and r.rowed_on >= current_date - 84
    union all
    select 'file', (u.started_at at time zone 'Europe/London')::date,
           case u.sport when 'ride' then 'bike' else u.sport end,
           u.sport_label, u.distance_m, u.duration_seconds * 10,
           u.avg_power, null, case when u.sport = 'row' then u.avg_cadence end, null, u.avg_hr, '[]'::jsonb, u.note, u.uploaded_at
    from uploaded_workouts u
    where u.patient_id = client and u.rowing_result_id is null
      and (u.started_at at time zone 'Europe/London')::date >= current_date - 84
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
        'type', case
                  when summary_text ilike '%INTAKE FORM,%' then 'intake form'
                  when summary_text ilike 'QUICK UPDATE%' then 'quick update'
                  when summary_text ilike '%filled in by the client%' then 'client form'
                  else 'Twofold note' end,
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
            'next_morning', l.next_morning_answer, 'note', l.note,
            'type', w.plan_session->>'type',
            'run_circuit', l.run_circuit) order by l.week_number, l.completed_at)
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
      from imported_plans where patient_id = client and status = 'draft'), '[]'::jsonb),
    'synced_sessions', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'source', s.source,
        'date', s.day,
        'sport', s.sport,
        'workout_type', s.workout_type,
        'distance_m', s.distance_m,
        'time', builder.time_text(s.time_tenths),
        'avg_watts', coalesce(s.avg_watts,
          case when s.sport in ('row', 'ski') and s.distance_m > 0 and s.time_tenths > 0
               then round(2.80 / power((s.time_tenths / 10.0) / s.distance_m, 3))::int end),
        'avg_split_500m', case when s.sport in ('row', 'ski') and s.distance_m > 0
               then builder.time_text(round(s.time_tenths * 500.0 / s.distance_m)) end,
        'avg_pace_per_km', case when s.sport = 'run' and s.distance_m > 0
               then builder.time_text(round(s.time_tenths * 1000.0 / s.distance_m)) end,
        'avg_stroke_rate', s.stroke_rate,
        'drag_factor', s.drag_factor,
        'avg_heart_rate', s.avg_hr,
        'intervals', case when jsonb_array_length(coalesce(s.intervals, '[]'::jsonb)) > 0 then (
          select jsonb_agg(
            concat_ws(', ',
              case when (i->>'distance_m') is not null then (i->>'distance_m') || ' m' end,
              builder.time_text((i->>'time_tenths')::numeric),
              case when (i->>'split_seconds') is not null then builder.time_text(round((i->>'split_seconds')::numeric * 10)) || ' /500m' end,
              case when (i->>'stroke_rate') is not null then 'rate ' || (i->>'stroke_rate') end,
              case when (i->>'rest_seconds')::numeric > 0 then (i->>'rest_seconds') || ' s rest' end)
            order by ord)
          from jsonb_array_elements(s.intervals) with ordinality as t(i, ord)) end,
        'note', s.note)) order by s.day desc, s.created_at desc)
      from sessions s), '[]'::jsonb),
    'synced_weekly', coalesce((
      select jsonb_agg(jsonb_build_object(
        'week_start', w.week_start, 'sport', w.sport, 'sessions', w.n,
        'total_metres', w.metres, 'total_minutes', w.minutes) order by w.week_start desc, w.sport)
      from (
        select date_trunc('week', s.day)::date as week_start, s.sport, count(*) as n,
               coalesce(sum(s.distance_m), 0) as metres, round(sum(s.time_tenths) / 600.0) as minutes
        from sessions s
        group by 1, 2) w), '[]'::jsonb),
    'goals', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'type', g.goal_type, 'target', g.target_text, 'date', g.goal_date,
        'event_name', g.event_name, 'distance_m', g.distance_m)) order by g.sort_order, g.created_at)
      from client_goals g where g.patient_id = client), '[]'::jsonb),
    'performance_tests', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'date', t.tested_on, 'type', t.test_type, 'result', t.result_text,
        'race_or_test', case when t.is_race then 'race' else 'test' end,
        'distance_m', t.distance_m,
        'avg_split_500m', case when t.avg_split_seconds is not null then builder.time_text(round(t.avg_split_seconds * 10)) end,
        'stroke_rate', t.stroke_rate, 'drag_factor', t.drag_factor,
        'notes', t.notes)) order by t.tested_on, t.created_at)
      from performance_tests t where t.patient_id = client), '[]'::jsonb)
  );
$$;

revoke all on all functions in schema builder from public, anon, authenticated;
