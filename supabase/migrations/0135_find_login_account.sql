-- One person can be both a coach and a client on the same login. To link a
-- new role to a login that already exists, the server needs to find that
-- login by email address. Only the server (service role) may call this.
create or replace function public.find_login_account(p_email text)
returns table (id uuid, email text, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = auth, public
as $$
  select u.id, u.email::text, u.last_sign_in_at
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke execute on function public.find_login_account(text) from public, anon, authenticated;
grant execute on function public.find_login_account(text) to service_role;
