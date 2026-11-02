-- Tools tab: the client's hub of breath, nervous system and mind resources.
-- It reads live Flows from the Vault, so Flows gain a Mind type for the
-- mindfulness programming that sits beside breathwork and neurodynamics.
alter table public.flows drop constraint if exists flows_category_check;
alter table public.flows
  add constraint flows_category_check
  check (category in ('neurodynamic', 'everyday_task', 'mobility', 'breath', 'mind'));
