-- Flows: follow along movement programmes, kept as their own section of the
-- Vault. A flow is standalone (not a block inside a workout) and runs
-- alongside workouts, blocks, exercises, activations, injury prevention and
-- cardio. Each flow is an ordered list of timed moves, which doubles as the
-- script for the filming prompter, and each move can point back to the
-- exercise in the library that it is built from.
create table public.flows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'neurodynamic'
    check (category in ('neurodynamic', 'everyday_task', 'mobility', 'breath')),
  body_area text not null default 'whole_body'
    check (body_area in ('upper_limb', 'lower_limb', 'whole_body')),
  entry_point text,
  summary text,
  status text not null default 'draft'
    check (status in ('draft', 'filmed', 'live')),
  vimeo_url text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.flow_moves (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.flows(id) on delete cascade,
  move_order integer not null,
  name text not null,
  seconds integer not null default 30 check (seconds > 0),
  breath_seconds integer not null default 0 check (breath_seconds >= 0),
  side text not null default '' check (side in ('', 'Left', 'Right', 'Both')),
  cue text,
  exercise_id text references public.exercises(exercise_id) on delete set null
);

create index flow_moves_flow_idx on public.flow_moves (flow_id, move_order);

alter table public.flows enable row level security;
alter table public.flow_moves enable row level security;

-- The six neurodynamic flows planned on 24 Oct 2026 (three upper limb,
-- three lower limb), each a different entry point, built from the glides
-- already in the library. Cue wording is placeholder for David to rewrite.
do $$
declare f uuid;
begin
  -- Upper limb 1
  insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order)
  values ('Upper Limb Glides: Standing', 'neurodynamic', 'upper_limb', 'Standing, any time of day',
    'A short standing flow that moves the nerves of the arm through easy, comfortable range.',
    'draft', 'Draft. Cue wording is placeholder, rewrite in your own clinical language before filming.', 10)
  returning id into f;
  insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, side, cue, exercise_id) values
    (f, 1, 'Settle and breathe', 20, 8, '', 'Stand tall with soft knees. Slow breath in through the nose and a long breath out.', null),
    (f, 2, 'Median nerve glide', 40, 6, 'Right', 'Arm out to the side, palm up. Straighten the elbow as the head tips towards the arm, bend it as the head tips away.', 'EX-067'),
    (f, 3, 'Median nerve glide', 40, 6, 'Left', 'Arm out to the side, palm up. Straighten the elbow as the head tips towards the arm, bend it as the head tips away.', 'EX-067'),
    (f, 4, 'Radial nerve glide', 40, 6, 'Right', 'Arm by the side, palm facing back. Bend the wrist as the head tips towards the arm, release as it tips away.', 'EX-105'),
    (f, 5, 'Radial nerve glide', 40, 6, 'Left', 'Arm by the side, palm facing back. Bend the wrist as the head tips towards the arm, release as it tips away.', 'EX-105'),
    (f, 6, 'Ulnar nerve glide', 40, 6, 'Right', 'Loose ring with finger and thumb. Bring the hand towards the face as the head tips away, then return.', 'EX-112'),
    (f, 7, 'Ulnar nerve glide', 40, 6, 'Left', 'Loose ring with finger and thumb. Bring the hand towards the face as the head tips away, then return.', 'EX-112'),
    (f, 8, 'Finish and shake out', 20, 8, '', 'Let both arms hang heavy and notice how they feel compared with the start.', null);

  -- Upper limb 2
  insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order)
  values ('Upper Limb Glides: Desk and Work Day', 'neurodynamic', 'upper_limb', 'Seated at a desk',
    'A seated flow for the working day, done in the chair without needing space or kit.',
    'draft', 'Draft. Cue wording is placeholder, rewrite in your own clinical language before filming.', 20)
  returning id into f;
  insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, side, cue, exercise_id) values
    (f, 1, 'Sit tall and breathe', 20, 8, '', 'Feet flat, sit tall away from the backrest. Long, easy breath out.', null),
    (f, 2, 'Shoulder rolls', 20, 6, 'Both', 'Slow circles back and down, letting the shoulders settle.', null),
    (f, 3, 'Median nerve glide', 30, 6, 'Right', 'Arm out to the side, palm up. Straighten and bend the elbow with the head moving with you.', 'EX-067'),
    (f, 4, 'Median nerve glide', 30, 6, 'Left', 'Arm out to the side, palm up. Straighten and bend the elbow with the head moving with you.', 'EX-067'),
    (f, 5, 'Radial glide, thumb variant', 30, 6, 'Right', 'Tuck the thumb, arm by the side. Bend the wrist as the head tips towards the arm, release as it tips away.', 'EX-106'),
    (f, 6, 'Radial glide, thumb variant', 30, 6, 'Left', 'Tuck the thumb, arm by the side. Bend the wrist as the head tips towards the arm, release as it tips away.', 'EX-106'),
    (f, 7, 'Back to the keyboard', 15, 8, '', 'Rest the hands, notice the arms, then carry on with your day.', null);

  -- Upper limb 3
  insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order)
  values ('Upper Limb Glides: Gentle Start', 'neurodynamic', 'upper_limb', 'Gentle early version, small range',
    'The softest version for when the arm is sensitive, with smaller range and more time to breathe.',
    'draft', 'Draft. Cue wording is placeholder, rewrite in your own clinical language before filming.', 30)
  returning id into f;
  insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, side, cue, exercise_id) values
    (f, 1, 'Settle and breathe', 30, 8, '', 'Sit or stand, whichever is easiest today. Let the breath slow down.', null),
    (f, 2, 'Small median glide', 45, 8, 'Right', 'Only a small piece of the movement. Stay well inside any symptoms.', 'EX-067'),
    (f, 3, 'Small median glide', 45, 8, 'Left', 'Only a small piece of the movement. Stay well inside any symptoms.', 'EX-067'),
    (f, 4, 'Small ulnar glide', 45, 8, 'Right', 'Tiny movement, smooth and unhurried.', 'EX-112'),
    (f, 5, 'Small ulnar glide', 45, 8, 'Left', 'Tiny movement, smooth and unhurried.', 'EX-112'),
    (f, 6, 'Rest and notice', 30, 8, '', 'Let the arms rest and notice what has changed.', null);

  -- Lower limb 1
  insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order)
  values ('Lower Limb Glides: Seated', 'neurodynamic', 'lower_limb', 'Seated on a chair',
    'A seated flow for the back of the leg, easy to do at home or at work.',
    'draft', 'Draft. Cue wording is placeholder, rewrite in your own clinical language before filming.', 40)
  returning id into f;
  insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, side, cue, exercise_id) values
    (f, 1, 'Settle and breathe', 20, 8, '', 'Sit tall at the edge of a chair. Slow breath in and a long breath out.', null),
    (f, 2, 'Seated sciatic glide', 40, 6, 'Right', 'Straighten the knee as the head looks up, bend the knee as the head looks down. Gentle, no pulling.', 'EX-120'),
    (f, 3, 'Seated sciatic glide', 40, 6, 'Left', 'Straighten the knee as the head looks up, bend the knee as the head looks down. Gentle, no pulling.', 'EX-120'),
    (f, 4, 'Seated sciatic glide', 40, 6, 'Right', 'Second round, a little more range if it feels easy.', 'EX-120'),
    (f, 5, 'Seated sciatic glide', 40, 6, 'Left', 'Second round, a little more range if it feels easy.', 'EX-120'),
    (f, 6, 'Stand and walk it out', 20, 8, '', 'Stand, shake both legs out and take a few easy steps.', null);

  -- Lower limb 2
  insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order)
  values ('Lower Limb Glides: Floor', 'neurodynamic', 'lower_limb', 'On the floor, side lying',
    'A floor based flow that works through the back and front of the leg in side lying.',
    'draft', 'Draft. Cue wording is placeholder, rewrite in your own clinical language before filming.', 50)
  returning id into f;
  insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, side, cue, exercise_id) values
    (f, 1, 'Settle and breathe', 20, 8, '', 'Lie on your side with a pillow under the head. Let the breath slow down.', null),
    (f, 2, 'Side line sciatic glide', 40, 6, 'Right', 'Guide the top leg through a smooth, easy glide.', 'EX-153'),
    (f, 3, 'Front line femoral glide', 40, 6, 'Right', 'Take the top heel towards the buttock and back, head moving with you.', 'EX-152'),
    (f, 4, 'Roll over', 10, 0, '', 'Roll slowly onto the other side.', null),
    (f, 5, 'Side line sciatic glide', 40, 6, 'Left', 'Guide the top leg through a smooth, easy glide.', 'EX-153'),
    (f, 6, 'Front line femoral glide', 40, 6, 'Left', 'Take the top heel towards the buttock and back, head moving with you.', 'EX-152'),
    (f, 7, 'Rest and notice', 20, 8, '', 'Lie on your back and notice how both legs feel.', null);

  -- Lower limb 3
  insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order)
  values ('Lower Limb Glides: After Sport', 'neurodynamic', 'lower_limb', 'After training or a match',
    'A post sport flow mixing seated and kneeling glides to settle the legs after load.',
    'draft', 'Draft. Cue wording is placeholder, rewrite in your own clinical language before filming.', 60)
  returning id into f;
  insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, side, cue, exercise_id) values
    (f, 1, 'Breathe down', 20, 8, '', 'Long breath out to bring the heart rate down.', null),
    (f, 2, 'Seated sciatic glide', 40, 6, 'Right', 'Straighten and bend the knee with the head moving with you.', 'EX-120'),
    (f, 3, 'Seated sciatic glide', 40, 6, 'Left', 'Straighten and bend the knee with the head moving with you.', 'EX-120'),
    (f, 4, 'Kneeling femoral glide', 40, 6, 'Right', 'Half kneeling, ease the hips forward and back with the head moving with you.', 'EX-122'),
    (f, 5, 'Kneeling femoral glide', 40, 6, 'Left', 'Half kneeling, ease the hips forward and back with the head moving with you.', 'EX-122'),
    (f, 6, 'Walk it out', 20, 8, '', 'Stand and take a few easy steps.', null);
end $$;
