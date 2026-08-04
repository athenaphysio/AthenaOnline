-- Staff accounts (Coach role, to begin with), backed by Supabase Auth --------
--
-- Mirrors public.patients exactly: id is the real auth.users id, RLS lets a
-- staff member read only their own row. Owner is never given a row here --
-- Owner keeps using the existing shared clinic password and supabaseAdmin,
-- completely unchanged. This table only ever holds role='coach' rows in
-- practice; 'owner' is allowed by the check constraint purely so an
-- individual Owner login could be added later without a schema change.

create table public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('owner', 'coach')),
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

create policy "Staff can read their own row" on public.staff
  for select using (auth.uid() = id);

-- handle_new_patient() previously fired unconditionally for every new
-- auth.users row. Left as-is, creating a Coach account would also silently
-- create a phantom patients row for them. Gate it to only fire when the
-- signup is genuinely a patient signup (no role, or role='patient').
create or replace function public.handle_new_patient()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data->>'role', 'patient') = 'patient' then
    insert into public.patients (id, first_name, email)
    values (new.id, coalesce(new.raw_user_meta_data->>'first_name', ''), new.email);
  end if;
  return new;
end;
$$;

-- Mirror trigger for staff: fires only when role='coach' is explicitly set
-- in user metadata at creation time (src/app/api/clinic/staff/route.ts sets
-- this via supabaseAdmin.auth.admin.createUser).
create function public.handle_new_staff()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.raw_user_meta_data->>'role' = 'coach' then
    insert into public.staff (id, name, email, role)
    values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), new.email, 'coach');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created_staff
  after insert on auth.users
  for each row execute function public.handle_new_staff();
