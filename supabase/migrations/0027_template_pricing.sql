-- Price and access move onto the real Programme Template, so pricing a shop
-- item is something David does in Content (where the template already
-- lives) rather than a separate hand-edited config file. price_gbp is
-- nullable because it only applies when access = 'paid' -- the app enforces
-- that pairing (see /api/clinic/programme-templates), not a check
-- constraint, same approach already used for the under-18/guardian fields.
alter table public.programme_templates
  add column access text not null default 'paid' check (access in ('paid', 'free')),
  add column price_gbp integer;
