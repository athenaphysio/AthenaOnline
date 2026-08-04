-- David's own manual buckets ("Atomic athletes", "Menopause strength", ...).
-- A patient can be in any number of groups. Deliberately not rule-based --
-- David decides who's in what; automatic/rule-based grouping is a later step.

create table public.patient_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.patient_group_members (
  patient_id uuid not null references public.patients(id) on delete cascade,
  group_id uuid not null references public.patient_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (patient_id, group_id)
);

-- Owner-only via supabaseAdmin, same trust boundary as blocks/workouts/staff
-- (0009_content_hierarchy.sql, 0012_staff_roles.sql) -- no anon/authenticated
-- policy is created, so both tables deny all access by default once RLS is
-- enabled.
alter table public.patient_groups enable row level security;
alter table public.patient_group_members enable row level security;
