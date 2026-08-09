-- Vault Exercises library needs a category to filter by, mirroring the
-- same five slot types used everywhere else in the app (SLOT_TYPES in
-- src/lib/slotTypes.ts). Nullable because the ~195 real exercises were
-- never tagged with this at import time.
alter table public.exercises
  add column default_category text
    check (default_category in ('warm_up', 'activation', 'main_body', 'injury_prevention', 'cool_down'));
