-- Clients on a brand pack (for example Regenerate) can now create their own
-- account from their brand's login page. Every account made that way waits
-- for David's approval before it opens the app. Clients David invites are
-- cleared straight away by the invite itself (src/lib/clientInvite.ts), and
-- every existing client is unaffected.
alter table public.patients add column if not exists awaiting_approval boolean not null default false;

-- A new login account still makes its client row, now also taking the last
-- name and, for a sign-up from a brand's own page, that brand. It starts out
-- awaiting approval, whoever made it; only the clinic can clear that.
create or replace function public.handle_new_patient()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  pack uuid;
begin
  if coalesce(new.raw_user_meta_data->>'role', 'patient') = 'patient' then
    select bp.id into pack
    from public.brand_packs bp
    where bp.id::text = new.raw_user_meta_data->>'signup_brand'
      and not bp.is_default;

    insert into public.patients (id, first_name, last_name, email, brand_pack_id, awaiting_approval)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'first_name', ''),
      nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), ''),
      new.email,
      pack,
      true
    );
  end if;
  return new;
end;
$function$;
