-- Close off four database helpers that anyone, even without logging in,
-- could call directly through the database API.
--
-- handle_new_patient and handle_new_staff only ever run as triggers when a
-- login account is created. A trigger runs whether or not the person
-- creating the account has EXECUTE on the function, so nobody needs to call
-- them directly and nobody may.
--
-- coach_can_read_programme and coach_can_read_template are used inside the
-- row level security rules for logged in clinicians, so logged in users
-- keep EXECUTE (the rules would stop working without it). People who are not
-- logged in have no use for them, so they lose it.
revoke execute on function public.handle_new_patient() from public, anon, authenticated;
revoke execute on function public.handle_new_staff() from public, anon, authenticated;
revoke execute on function public.coach_can_read_programme(uuid) from public, anon;
revoke execute on function public.coach_can_read_template(uuid) from public, anon;

-- Functions created later in this schema do not hand EXECUTE to people who
-- are not logged in unless a migration grants it on purpose.
alter default privileges in schema public revoke execute on functions from public, anon;
