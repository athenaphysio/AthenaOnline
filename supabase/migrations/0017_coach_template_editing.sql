-- Two changes to what a Coach can do, both still fully database-enforced:
--
-- 1. A Coach can now edit the templates they're assigned to (not just view
--    them), using the exact same builder Owner uses. That needs write
--    policies, not just read ones.
--
-- 2. The template builder's Workout picker needs a library to pick from.
--    Workouts (and the Blocks/exercises inside them) are shared clinical
--    content, not patient data -- the same category `exercises` already
--    sits in as a fully public-read table (0001_initial_schema.sql). So
--    Workouts/Blocks widen from "reachable through something I'm already
--    assigned to" to "readable by any Coach", exactly like exercises.
--    Patient-identifying data (patients/programmes/session_completions)
--    is untouched -- only the shared, non-patient-specific library widens.

-- Replace the old reachability-scoped read policies from 0016_coach_rls.sql
-- with a straightforward "any coach" policy -- the narrower ones are now
-- fully subsumed and would just be dead weight sitting alongside the new
-- ones, which is worse for staying auditable than removing them outright.
drop policy "Coaches can read reachable workouts" on public.workouts;
drop policy "Coaches can read reachable workout items" on public.workout_items;
drop policy "Coaches can read reachable blocks" on public.blocks;
drop policy "Coaches can read reachable block items" on public.block_items;
drop policy "Coaches can read reachable block item weeks" on public.block_item_weeks;
drop function public.coach_can_read_workout(uuid);

create policy "Coaches can read the workout library" on public.workouts
  for select to authenticated
  using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.role = 'coach'));

create policy "Coaches can read the workout library items" on public.workout_items
  for select to authenticated
  using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.role = 'coach'));

create policy "Coaches can read the block library" on public.blocks
  for select to authenticated
  using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.role = 'coach'));

create policy "Coaches can read the block library items" on public.block_items
  for select to authenticated
  using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.role = 'coach'));

create policy "Coaches can read the block library item weeks" on public.block_item_weeks
  for select to authenticated
  using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.role = 'coach'));

-- A coach may edit a template's own fields (name, block length) only for
-- templates they're assigned to -- same predicate already used for select.
create policy "Coaches can update their assigned templates" on public.programme_templates
  for update to authenticated
  using (public.coach_can_read_template(id))
  with check (public.coach_can_read_template(id));

-- Saving a template's schedule works by replacing all rows fresh (delete
-- then reinsert -- see /api/clinic/programme-templates/[id]/route.ts, which
-- the new /api/coach/programme-templates/[id]/route.ts mirrors).
create policy "Coaches can set their assigned templates' schedule" on public.programme_template_workouts
  for insert to authenticated
  with check (public.coach_can_read_template(template_id));

create policy "Coaches can clear their assigned templates' schedule" on public.programme_template_workouts
  for delete to authenticated
  using (public.coach_can_read_template(template_id));
