-- Concept2 (and similar monitor-driven) cardio blocks carry a button
-- sequence rather than something the app derives itself -- the patient
-- just presses buttons in order on the machine's own monitor. PM5 is
-- stored separately from PM3/PM4 since Concept2's own reference confirms
-- the two monitor generations don't always use the same sequence for the
-- same workout, even though the physical A-E button layout is identical
-- across both (see athena_cardio_library_concept2.md). Both nullable --
-- most cardio blocks (the existing general/return-to-run library) have
-- neither, since they're not monitor-preset workouts at all.
alter table public.cardio_blocks add column button_sequence_pm5 text;
alter table public.cardio_blocks add column button_sequence_pm3_4 text;

-- A tiny generic key/value store for single, site-wide assets that don't
-- belong to any one row -- starting with the PM5 button-key image shown
-- alongside any cardio block that has a button sequence. Deliberately not
-- a column on cardio_blocks itself: it's one shared image, not one per
-- workout.
create table public.app_assets (
  key text primary key,
  url text,
  updated_at timestamptz not null default now()
);

alter table public.app_assets enable row level security;

-- Same read-only widening as cardio_blocks itself (0036_cardio_blocks.sql)
-- -- shared reference content, not patient data. Patient-side reads go
-- through supabaseAdmin (service role), same as cardio_blocks, so no
-- patient-facing policy is needed here.
create policy "Coaches can read app assets" on public.app_assets
  for select to authenticated
  using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.role = 'coach'));

insert into public.app_assets (key, url) values ('cardio_pm5_button_key', null);
