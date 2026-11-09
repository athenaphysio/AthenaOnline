-- The strength profile Dr David Silver PhD has corrected on a client's
-- record: minutes per strength session, strength days, split, kit,
-- experience, current lifts, goal, things to avoid and focus areas. Only
-- the fields he has changed are stored; everything else is read fresh from
-- the client's intake form and consultation notes each time strength is
-- built (src/lib/strengthProfile.ts).

alter table public.patients add column if not exists strength_profile jsonb;
