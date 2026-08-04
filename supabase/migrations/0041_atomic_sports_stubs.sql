-- Seven bare Programme Template rows, one per Atomic Sports sub-programme
-- David is building out (Golf, Netball, Hockey, Padel, Martial Arts,
-- Basketball, Swimming). Each is a real row purely so the existing Template
-- Builder's cover-image upload has somewhere to attach David's branding
-- image to -- no real weekly schedule, price, or content is invented here.
-- price_gbp of 1 is a technical placeholder only (satisfies the "paid
-- requires price > 0" check if this row is ever edited through the Owner
-- UI); it's never shown, since shopProgrammes.ts marks the matching shop
-- entry comingSoon: true, which suppresses price display entirely.
-- Fixed ids so they match the templateId values already hard-coded in
-- src/lib/shopProgrammes.ts.
insert into public.programme_templates (id, name, block_length_weeks, delivery_mode, is_under_18, access, price_gbp)
values
  ('a1000000-0000-4000-8000-000000000001', 'Atomic Golf', 4, 'scheduled', false, 'paid', 1),
  ('a1000000-0000-4000-8000-000000000002', 'Atomic Netball', 4, 'scheduled', false, 'paid', 1),
  ('a1000000-0000-4000-8000-000000000003', 'Atomic Hockey', 4, 'scheduled', false, 'paid', 1),
  ('a1000000-0000-4000-8000-000000000004', 'Atomic Padel', 4, 'scheduled', false, 'paid', 1),
  ('a1000000-0000-4000-8000-000000000005', 'Atomic Martial Arts', 4, 'scheduled', false, 'paid', 1),
  ('a1000000-0000-4000-8000-000000000006', 'Atomic Basketball', 4, 'scheduled', false, 'paid', 1),
  ('a1000000-0000-4000-8000-000000000007', 'Atomic Swimming', 4, 'scheduled', false, 'paid', 1)
on conflict (id) do nothing;
