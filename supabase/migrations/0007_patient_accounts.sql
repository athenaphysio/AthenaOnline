-- Patient accounts, backed by Supabase Auth --------------------------------

create table public.patients (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.patients enable row level security;

-- A patient can read their own row and nothing else -- this table holds
-- real names and emails, so there is no public/anon read policy at all.
-- The clinic reads it via the service_role key, which bypasses RLS.
create policy "Patients can read their own row" on public.patients
  for select using (auth.uid() = id);

-- Auto-create the patients row the moment someone signs up through
-- Supabase Auth, using the first_name passed in signUp()'s options.data.
create function public.handle_new_patient()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.patients (id, first_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'first_name', ''), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_patient();

-- Link programmes to the patient who owns them ------------------------------

alter table public.programmes add column patient_id uuid references public.patients(id);

-- Lock reads down to "this is your own data", enforced by Postgres on every
-- query regardless of what the app's UI does -- not just a page-level check.
-- This replaces the old "anyone with the anon key can read every programme"
-- policy from migration 0001.
drop policy "Public read access" on public.programmes;
drop policy "Public read access" on public.programme_items;
drop policy "Public read access" on public.programme_item_weeks;

create policy "Patients can read their own programmes" on public.programmes
  for select using (auth.uid() = patient_id);

create policy "Patients can read their own programme items" on public.programme_items
  for select using (
    exists (
      select 1 from public.programmes
      where programmes.id = programme_items.programme_id
        and programmes.patient_id = auth.uid()
    )
  );

create policy "Patients can read their own programme item weeks" on public.programme_item_weeks
  for select using (
    exists (
      select 1 from public.programme_items
      join public.programmes on programmes.id = programme_items.programme_id
      where programme_items.id = programme_item_weeks.programme_item_id
        and programmes.patient_id = auth.uid()
    )
  );

-- Templates are clinic-internal only -- no anon or patient access at all
-- now, only the service_role key used by /clinic/* routes.
drop policy "Public read access" on public.programme_templates;
drop policy "Public read access" on public.programme_template_items;
drop policy "Public read access" on public.programme_template_item_weeks;
