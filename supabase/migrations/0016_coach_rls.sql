-- What a Coach account can read, made explicit and reviewable in one file.
--
-- Postgres RLS defaults to deny: a table with RLS enabled and no policy for
-- a given operation refuses it outright, for anyone, via any query -- not
-- just the queries this app's UI happens to send. Everything NOT granted a
-- policy below (patients not enrolled via an assigned template, other
-- coaches' assignments, notifications, picker_selection_history,
-- block_notes, the drafting tool, the reasoning profile) is therefore
-- already refused by the database itself, with nothing further to write.
--
-- Three small helper functions answer one reachability question each, so
-- every policy below is a single call to one of them. They're security
-- definer (bypassing RLS for their own internal existence-check queries) --
-- otherwise a helper checking "am I assigned to this template" would itself
-- be blocked by the very policy it's meant to grant, a classic RLS
-- recursion trap. This mirrors the existing handle_new_patient() trigger's
-- security definer pattern (0007_patient_accounts.sql). Each function only
-- ever answers its one fixed yes/no question -- not a general bypass.

create function public.coach_can_read_template(p_template_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.coach_template_assignments
    where coach_id = auth.uid() and template_id = p_template_id
  );
$$;

create function public.coach_can_read_programme(p_programme_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.programmes
    where id = p_programme_id
      and source_template_id is not null
      and public.coach_can_read_template(source_template_id)
  );
$$;

-- A workout is readable if it appears in an assigned template's own
-- schedule (previewing the template library) OR in the live schedule of a
-- programme that traces back to an assigned template (viewing what a real
-- patient is actually doing today, including any bespoke edits layered on
-- after instantiation).
create function public.coach_can_read_workout(p_workout_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1 from public.programme_template_workouts ptw
      where ptw.workout_id = p_workout_id
        and public.coach_can_read_template(ptw.template_id)
    )
    or exists (
      select 1 from public.programme_workouts pw
      where pw.workout_id = p_workout_id
        and public.coach_can_read_programme(pw.programme_id)
    );
$$;

-- Programme Templates: the coach's own assigned set.
create policy "Coaches can read their assigned templates" on public.programme_templates
  for select to authenticated
  using (public.coach_can_read_template(id));

create policy "Coaches can read their assigned templates' schedule" on public.programme_template_workouts
  for select to authenticated
  using (public.coach_can_read_template(template_id));

-- Patient programmes reachable from an assigned template only.
create policy "Coaches can read programmes from their templates" on public.programmes
  for select to authenticated
  using (public.coach_can_read_programme(id));

create policy "Coaches can read programme schedules from their templates" on public.programme_workouts
  for select to authenticated
  using (public.coach_can_read_programme(programme_id));

-- The people enrolled in those programmes -- and nobody else.
create policy "Coaches can read patients on their programmes" on public.patients
  for select to authenticated
  using (
    exists (
      select 1 from public.programmes p
      where p.patient_id = patients.id
        and public.coach_can_read_programme(p.id)
    )
  );

-- Workout/block content, reachable from something above.
create policy "Coaches can read reachable workouts" on public.workouts
  for select to authenticated
  using (public.coach_can_read_workout(id));

create policy "Coaches can read reachable workout items" on public.workout_items
  for select to authenticated
  using (public.coach_can_read_workout(workout_id));

create policy "Coaches can read reachable blocks" on public.blocks
  for select to authenticated
  using (
    exists (
      select 1 from public.workout_items wi
      where wi.block_id = blocks.id
        and public.coach_can_read_workout(wi.workout_id)
    )
  );

create policy "Coaches can read reachable block items" on public.block_items
  for select to authenticated
  using (
    exists (
      select 1 from public.workout_items wi
      where wi.block_id = block_items.block_id
        and public.coach_can_read_workout(wi.workout_id)
    )
  );

create policy "Coaches can read reachable block item weeks" on public.block_item_weeks
  for select to authenticated
  using (
    exists (
      select 1 from public.block_items bi
      join public.workout_items wi on wi.block_id = bi.block_id
      where bi.id = block_item_weeks.block_item_id
        and public.coach_can_read_workout(wi.workout_id)
    )
  );

-- Exercises are already public-read for everyone (0001_initial_schema.sql,
-- no role restriction at all). Coaches additionally get insert, scoped to
-- staff with role='coach' specifically -- not blanket-open to "any logged
-- in account", which would otherwise also hand patients insert rights.
create policy "Coaches can add exercises" on public.exercises
  for insert to authenticated
  with check (
    exists (select 1 from public.staff where staff.id = auth.uid() and staff.role = 'coach')
  );

-- Completion history for patients reachable the same way.
create policy "Coaches can read completions on their programmes" on public.session_completions
  for select to authenticated
  using (public.coach_can_read_programme(programme_id));
