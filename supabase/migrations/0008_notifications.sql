-- Generic notification centre. One row per notice; "type" distinguishes
-- kinds of notice so future ones (beyond "your programme's ready") don't
-- need a schema change -- just a new type value and title/body text.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Patients can read their own notifications" on public.notifications
  for select using (auth.uid() = patient_id);

-- Patients can mark their own notifications read (the only write they need)
-- but never create one themselves -- those only ever come from the clinic
-- side via the service_role key.
create policy "Patients can mark their own notifications read" on public.notifications
  for update using (auth.uid() = patient_id) with check (auth.uid() = patient_id);
