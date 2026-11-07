-- Getting client data to the Programme Builder (brief of 6 November 2026).
--
-- 1. Concept2 sessions of every kind (row, SkiErg, BikeErg) are kept with
--    their watts, drag factor and intervals, and a CSV export from the
--    Concept2 online logbook can be uploaded (source 'upload').
-- 2. Goals and performance tests, the records behind the Performance
--    metrics card. Goals are set by Dr David Silver PhD; tests are added by
--    the client or by him.
-- 3. Screenshots of training data a client uploads, kept for David to read.
--    Nothing is read from them automatically.
-- 4. A helper that moves everything from one client record to another, for
--    when two records turn out to be the same person.
-- 5. builder.client_context gains synced_sessions, synced_weekly, goals and
--    performance_tests, says what kind of record each consultation or form
--    is, and keeps every field it already returned, unchanged.

-- 1. Synced and uploaded sessions -----------------------------------------

alter table public.rowing_results drop constraint if exists rowing_results_sport_check;
alter table public.rowing_results add constraint rowing_results_sport_check check (sport in ('row', 'run', 'ski', 'bike'));

alter table public.rowing_results drop constraint if exists rowing_results_source_check;
alter table public.rowing_results add constraint rowing_results_source_check check (source in ('concept2', 'manual', 'file', 'upload'));

alter table public.rowing_results add column if not exists avg_watts smallint;
alter table public.rowing_results add column if not exists drag_factor smallint;
alter table public.rowing_results add column if not exists calories integer;
-- One entry per interval or split: { distance_m, time_tenths, split_seconds, stroke_rate, rest_seconds }
alter table public.rowing_results add column if not exists intervals jsonb not null default '[]'::jsonb;

-- 2. Goals and performance tests ------------------------------------------

create table public.client_goals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  goal_type text not null check (goal_type in ('marathon', 'half_marathon', '10k_run', '5k_run', '20min_erg', '2k_erg', '10k_row', 'long_row', 'other')),
  -- What David typed, for example 4:05:00, 290 W or 1:47 /500m.
  target_text text not null,
  -- The same target as a number the graphs can use: seconds for a time,
  -- watts for an erg power goal.
  target_seconds numeric(9,1),
  target_watts smallint,
  -- For a goal type of 'long_row' or 'other', the distance it is over.
  distance_m integer,
  goal_date date,
  event_name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_goals_patient on public.client_goals (patient_id, sort_order, created_at);

create table public.performance_tests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  tested_on date not null,
  test_type text not null check (test_type in ('marathon', 'half_marathon', '10k_run', '5k_run', '20min_erg', '2k_erg', '10k_row', 'long_row', 'other')),
  -- What was typed, kept as written, plus the number the graphs read.
  result_text text not null,
  result_seconds numeric(9,1),
  result_watts smallint,
  distance_m integer,
  avg_split_seconds numeric(6,2),
  stroke_rate smallint,
  drag_factor smallint,
  is_race boolean not null default false,
  notes text,
  added_by text not null default 'client' check (added_by in ('client', 'clinician')),
  -- Set when a test was copied over from a logged session or a Concept2 row.
  rowing_result_id uuid references public.rowing_results(id) on delete set null,
  created_at timestamptz not null default now()
);

create index performance_tests_patient on public.performance_tests (patient_id, tested_on);

-- 3. Screenshots of training data -----------------------------------------

create table public.training_screenshots (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  storage_path text not null,
  note text,
  uploaded_at timestamptz not null default now(),
  -- When David has looked at it.
  seen_at timestamptz
);

create index training_screenshots_patient on public.training_screenshots (patient_id, uploaded_at desc);

insert into storage.buckets (id, name, public)
values ('training-screenshots', 'training-screenshots', false)
on conflict (id) do nothing;

-- Clients can read their own goals, tests and screenshots. Every change goes
-- through the app's server, which checks it is the client themselves or
-- Dr David Silver PhD, so nobody can write here from a browser directly.
alter table public.client_goals enable row level security;
alter table public.performance_tests enable row level security;
alter table public.training_screenshots enable row level security;

create policy "Clients can read their own goals" on public.client_goals
  for select using (auth.uid() = patient_id);
create policy "Clients can read their own tests" on public.performance_tests
  for select using (auth.uid() = patient_id);
create policy "Clients can read their own screenshots" on public.training_screenshots
  for select using (auth.uid() = patient_id);

-- 4. Moving one client record into another ---------------------------------
--
-- select public.merge_client_records(keep => '<surviving id>', merge_from => '<duplicate id>');
--
-- Moves every form, log, synced session, programme and everything else
-- linked to the duplicate onto the surviving record. Where the surviving
-- record already holds the one row a table allows (a Concept2 connection,
-- say), the surviving record's row is kept and the duplicate's is left on
-- the duplicate. The duplicate record itself is not deleted, so Dr David
-- Silver PhD can check it is empty and remove it himself. Only the database
-- owner can run it.

create or replace function public.merge_client_records(keep uuid, merge_from uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  fk record;
  moved integer;
  report jsonb := '{}'::jsonb;
begin
  if keep = merge_from then
    raise exception 'The two records are the same.';
  end if;
  if not exists (select 1 from patients where id = keep) or not exists (select 1 from patients where id = merge_from) then
    raise exception 'Both client ids must exist.';
  end if;

  for fk in
    select cl.relnamespace::regnamespace::text as schema_name, cl.relname as table_name, a.attname as column_name
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.patients'::regclass
      and array_length(c.conkey, 1) = 1
  loop
    begin
      execute format('update %I.%I set %I = $1 where %I = $2', fk.schema_name, fk.table_name, fk.column_name, fk.column_name)
        using keep, merge_from;
      get diagnostics moved = row_count;
    exception when unique_violation then
      -- Move what can be moved one row at a time; rows that would clash
      -- with one the surviving record already has stay where they are.
      moved := 0;
      declare
        r record;
      begin
        for r in execute format('select ctid from %I.%I where %I = $1', fk.schema_name, fk.table_name, fk.column_name) using merge_from loop
          begin
            execute format('update %I.%I set %I = $1 where ctid = $2', fk.schema_name, fk.table_name, fk.column_name)
              using keep, r.ctid;
            moved := moved + 1;
          exception when unique_violation then
            null;
          end;
        end loop;
      end;
    end;
    if moved > 0 then
      report := report || jsonb_build_object(fk.table_name || '.' || fk.column_name, moved);
    end if;
  end loop;

  return report;
end;
$$;

revoke all on function public.merge_client_records(uuid, uuid) from public, anon, authenticated;

-- 5. What the Programme Builder reads ---------------------------------------

-- 1234 tenths of a second as 2:03.4, or 1:02:03.4 past an hour.
create or replace function builder.time_text(tenths numeric)
returns text
language sql immutable
as $$
  select case
    when tenths is null then null
    when tenths >= 36000 then
      (floor(tenths / 36000))::int || ':' || lpad((floor(mod(tenths, 36000) / 600))::int::text, 2, '0') || ':' ||
      lpad(to_char(mod(tenths, 600) / 10.0, 'FM00.0'), 4, '0')
    else
      (floor(tenths / 600))::int || ':' || lpad(to_char(mod(tenths, 600) / 10.0, 'FM00.0'), 4, '0')
  end;
$$;

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
