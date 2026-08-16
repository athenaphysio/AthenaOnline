-- David's own clinical reasoning on a programme or programme template, in
-- his own words -- same isolated-table pattern as block_notes.notes
-- (0051_block_notes_text.sql) and workout_notes.notes
-- (0052_workout_notes.sql). Confirmed via the Phase 4 audit that no
-- equivalent free-text field exists on either programmes or
-- programme_templates today.
create table public.programme_notes (
  programme_id uuid primary key references public.programmes(id) on delete cascade,
  notes text
);

create table public.programme_template_notes (
  programme_template_id uuid primary key references public.programme_templates(id) on delete cascade,
  notes text
);

alter table public.programme_notes enable row level security;
alter table public.programme_template_notes enable row level security;
