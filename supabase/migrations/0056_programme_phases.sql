-- Programme phases (e.g. "Protect & restore", weeks 1-2), confirmed to not
-- exist anywhere in the schema. Same template-vs-instance split already
-- used for the rest of a programme's content, so editing one patient's
-- phases never touches the shared template.
create table public.programme_template_phases (
  id uuid primary key default gen_random_uuid(),
  programme_template_id uuid not null references public.programme_templates(id) on delete cascade,
  name text not null,
  start_week integer not null,
  end_week integer not null,
  sort_order integer not null
);

create table public.programme_phases (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  name text not null,
  start_week integer not null,
  end_week integer not null,
  sort_order integer not null
);

-- Same trust boundary as programme_templates itself (0013_programme_templates.sql):
-- service_role only for now, no anon/authenticated policy.
alter table public.programme_template_phases enable row level security;

-- Same trust boundary as programmes itself (0007_patient_accounts.sql): a
-- patient can read their own programme's phases -- needed directly by the
-- patient dashboard's own authenticated client, not just supabaseAdmin.
alter table public.programme_phases enable row level security;

create policy "Patients can read their own programme phases" on public.programme_phases
  for select using (
    exists (
      select 1 from public.programmes
      where programmes.id = programme_phases.programme_id
        and programmes.patient_id = auth.uid()
    )
  );
