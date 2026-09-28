-- A running ladder is David's own standard sequence of steps (rungs) for
-- building a client's running -- stored once here so a Twofold note only
-- ever needs to say which ladder and which rung a client starts on, never
-- the actual week-by-week detail. Kept as two plain tables, not folded into
-- blocks/cardio_blocks -- a rung isn't an exercise or a single cardio
-- session, it's David's own clinical judgement on how running load steps
-- up, and it needs its own simple list-and-edit screen, not the block
-- builder's machinery.
create table public.running_ladders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phase_label text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- repeats/run_portion/recovery/total_running_minutes are deliberately text,
-- not numeric -- most rungs are clean intervals ("4 x 1.5 min run, 3 min
-- walk"), but the ladder's own final rung is often a continuous or
-- milestone session ("Continuous outdoor 5K", "about 28 to 29 min") that a
-- strict number would force into a false precision nobody actually said.
-- Same trust-the-clinician looseness already used for cardio_blocks.steady_
-- pace and this app's own Run block fields (runBlock.ts).
create table public.running_rungs (
  id uuid primary key default gen_random_uuid(),
  ladder_id uuid not null references public.running_ladders(id) on delete cascade,
  rung_number integer not null,
  repeats integer,
  run_portion text,
  recovery text,
  target_pace text,
  effort_cue text,
  total_running_minutes text,
  notes text,
  unique (ladder_id, rung_number)
);

-- Same RLS shape as blocks/cardio_blocks/workouts (0009_content_hierarchy.sql,
-- 0036_cardio_blocks.sql): shared clinical content, not patient data, no
-- policy created means select/insert/update/delete are all denied by
-- default for anon/authenticated -- the clinic writes via supabaseAdmin
-- (service role), which bypasses RLS entirely.
alter table public.running_ladders enable row level security;
alter table public.running_rungs enable row level security;

-- The starting ladder David gave for Step 2 -- flagged in his own brief as
-- numbers to check first, so these are seeded as given, not treated as
-- clinically verified.
do $$
declare
  ladder_id uuid;
begin
  insert into public.running_ladders (name, phase_label, active)
  values ('Outdoor transition to continuous 5K', 'Phases 1 and 2', true)
  returning id into ladder_id;

  insert into public.running_rungs
    (ladder_id, rung_number, repeats, run_portion, recovery, target_pace, effort_cue, total_running_minutes)
  values
    (ladder_id, 1, 4, '1.5 min run', '3 min walk', '4:45 to 5:00 /km', 'Crisp and controlled', '6 min'),
    (ladder_id, 2, 5, '1.5 min run', '2.5 min walk', '4:45 to 5:00 /km', 'Crisp and controlled', '7.5 min'),
    (ladder_id, 3, 4, '2 min run', '2.5 min walk', '4:45 to 5:00 /km', 'Crisp and controlled', '8 min'),
    (ladder_id, 4, 4, '2.5 min run', '2 min walk', '4:45 to 5:00 /km', 'Crisp and controlled', '10 min'),
    (ladder_id, 5, 4, '3 min run', '2 min walk', '5:00 to 5:15 /km', 'Smooth, sustainable', '12 min'),
    (ladder_id, 6, 3, '5 min run', '2 min walk', '5:15 to 5:30 /km', 'Smooth, sustainable', '15 min'),
    (ladder_id, 7, 3, '6 min run', '1.5 min walk', '5:15 to 5:30 /km', 'Smooth, sustainable', '18 min'),
    (ladder_id, 8, 2, '10 min run', '1.5 min walk', '5:30 to 5:45 /km', 'Comfortable, conversational', '20 min'),
    (ladder_id, 9, 2, '12 min run', '1 min walk', '5:30 to 5:45 /km', 'Comfortable, conversational', '24 min'),
    (ladder_id, 10, null, '25 min continuous', null, '5:30 to 5:45 /km', 'Comfortable, conversational', '25 min'),
    (ladder_id, 11, null, 'Continuous outdoor 5K', null, 'Comfortable', 'Milestone: 5K reached', 'about 28 to 29 min');
end $$;

insert into public.running_ladders (name, phase_label, active) values
  ('5K speed consolidation', 'Phase 3', true),
  ('Distance extension to half marathon', 'Phase 4', true);
