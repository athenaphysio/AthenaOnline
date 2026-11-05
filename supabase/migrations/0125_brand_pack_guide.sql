-- Client guide: a brand pack can carry a guide written for its clients,
-- for example the Return to Strength guide in Athena Concussion. When the
-- pack marks it as required, a client on that pack sees the guide before
-- anything else in the app opens, and the app opens once they confirm they
-- have read it. They can read it again at any time from their home screen.

alter table public.brand_packs add column if not exists guide_title text;
alter table public.brand_packs add column if not exists guide_body text;
alter table public.brand_packs add column if not exists guide_required boolean not null default false;

create table if not exists public.patient_guide_reads (
  patient_id uuid not null references public.patients(id) on delete cascade,
  brand_pack_id uuid not null references public.brand_packs(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (patient_id, brand_pack_id)
);

-- Written and read only by the server, after it has checked who is asking.
alter table public.patient_guide_reads enable row level security;

update public.brand_packs
set guide_title = 'Your Return to Strength Guide: Phase 1',
    guide_required = true,
    guide_body = $guide$
## Welcome

This guide explains why your programme looks the way it does, so that every exercise, rest period and rule in the app makes sense to you rather than feeling like a list of restrictions.

After a concussion, your brain and nervous system are still settling, and they can react to things that never bothered you before, such as a hard effort, holding your breath, or turning your head quickly. Phase 1 is designed to rebuild your strength in a way that keeps those reactions low, so that you can train consistently and build a solid base before we push on.

You do not need to remember everything here. Read it once now, come back to it whenever something in your programme feels unusual, and message me if anything is unclear.

## The five big ideas behind Phase 1

Everything in your programme comes back to five simple ideas, and if you hold on to these you will understand most of the choices I have made for you.

1. **Calm and steady beats hard and fast.** Big jumps in effort can stir up symptoms, so we build your work up gradually and avoid anything that spikes your heart rate suddenly.
2. **Breathe all the way through.** Every exercise should let you breathe continuously, because holding your breath while you push raises the pressure in your head and chest and is a common trigger for symptoms.
3. **Look after your neck.** Your neck often stays tight and sensitive after a concussion, so we keep your head in comfortable, middle positions and keep heavy work away from it for now.
4. **One or two new things at a time.** Learning new movements takes brain power, which is in shorter supply while you recover, so new exercises arrive slowly.
5. **Boring is good.** Repeating the same sessions lets us see clearly how you respond, and it builds a reliable base that we can then progress with confidence.

## How each session is built

Every session follows the same order, and the order matters, because each stage prepares your body and nervous system for the next one.

1. **Warm up on the bike or treadmill (10 to 15 minutes).** We start with your legs and build your heart rate up slowly. Starting with upper body cardio, such as a rowing machine or ski erg, asks more of your neck and shoulders before they are ready, so that comes later.
2. **Wake up your shoulder blades.** A short set of shoulder blade exercises switches on the muscles that support your upper back, which tend to go quiet after a concussion, so that your upper traps and neck do not take over when you lift.
3. **Movement mobility set.** These are standing and walking movements, such as toe walks, walking lunges and split stance rotations, which start simple and straight and gradually add more turning. When you rotate your body, keep your eyes fixed forward to begin with, and we will add head turns later once you are ready.
4. **Nerve flows.** Gentle, flowing movements for the nerves of your arms and legs come next, and only after the mobility set, because nerves respond much better once your body is already moving and warm.
5. **Strength work.** Your main exercises come last, blending on from the mobility work so that there is no sudden jump in effort.

## Looking after your neck and head

Your neck is closely linked to many concussion symptoms, so in Phase 1 we keep it calm, supported and away from extreme positions.

- **Keep your gaze level or slightly down.** When you hinge forward, for example in a Romanian deadlift, keep your eyes on the floor a little ahead of you rather than looking up, because looking up puts the back of your neck under load.
- **Avoid extreme head positions.** Looking right up, right down or fully over your shoulder can bring on headaches, dizziness or neck pain, so stay in the comfortable middle range.
- **Avoid shrugging.** The muscles on the top of your shoulders and the side of your neck are often already tight, so we leave out shrugs and instead focus on drawing your shoulder blades back and down.
- **Look after your wrists.** Bending your wrists right back, for example on all fours, can tension the nerves that run up to your neck, so we use a yoga brick under your hands to ease this.
- **Choose core work that keeps your spine long.** Crunches and sit ups pull on the neck, so instead we use exercises where you resist being twisted or pulled sideways, such as the Pallof press and suitcase carry.

## Breathing while you work

Your breathing is the simplest guide to whether an exercise is right for you at the moment, so keep it flowing and steady throughout every set.

Breathe out as you push or pull, breathe in as you return, and let each rep follow the rhythm of your breath rather than rushing ahead of it. If you notice yourself holding your breath or straining to get a rep done, that tells us the load is too heavy or the position too hard for now, so make it lighter or easier and let me know.

This is also why we avoid long static holds, such as planks or wall sits held for a long time, because people tend to hold their breath without realising it.

## How hard to work: sets, reps, rest and heart rate

In Phase 1 you should finish each session feeling that you have worked, but never feeling wiped out, and the way we set up your sets and rest is what keeps you there.

- **Rest until your heart rate settles.** Before you start your next set, let your heart rate come back down close to where it was before the last one. If you wear a heart rate monitor, use it, and if you do not, wait until your breathing feels easy again.
- **One arm or one leg at a time.** Single arm and single leg exercises put less load through your spine and make breath holding less likely, and they also show us any difference between your left and right sides.
- **Whole body movements first.** Exercises that use lots of muscles together, such as squats, rows and lunges, spread the effort around, rather than exhausting one small muscle group.
- **Bands before weights.** A resistance band naturally gets easier if you cannot reach the full range, so it adjusts to how you feel on the day in a way that a fixed weight cannot.
- **No high intensity intervals for now.** Short, all out bursts push your heart rate and nervous system hard at the same time, which is exactly what we are trying to avoid in this phase.

## Symptoms that show up later, and your session journal

It is common to feel fine during a session and then notice symptoms 12 to 48 hours later, which is why your feedback after each session matters as much as how the session itself felt.

Your heart and lungs tell you straight away how hard you are working, but your muscles, tendons and nervous system often take a day or two to report back. That is why we progress slowly, even when a session felt easy.

After each session, and again the next day, please note in the app how you felt, including any headache, dizziness, neck stiffness, tiredness, poor sleep or difficulty concentrating. A quick voice note is fine. Over a few weeks this builds a clear picture of what you tolerate well, and it is what I use to decide when you are ready to move on.

## What we hold back for now, and why

Nothing in this table is gone for good; these are simply things we bring back once your body has shown it can cope, and each has a Phase 1 alternative that trains the same qualities more gently.

| For now we leave out | Instead we use | Why |
| --- | --- | --- |
| Shrugs and shoulder lifting | Drawing the shoulder blades back and down | Neck and upper shoulder muscles are often already tight |
| Looking up while hinging or lifting | Hinging with your eyes on the floor ahead | Looking up loads the back of your neck |
| Lifting from the floor and getting up off the floor | Standing and split stance exercises | Getting up and down asks a lot of your neck and balance |
| Crunches, sit ups and hollow holds | Pallof press and suitcase carry | Curling up pulls on the neck |
| Long static holds | Smooth, continuous reps | Long holds encourage breath holding |
| High intensity intervals | Steady, ramped effort with full rest | Sudden spikes in heart rate can trigger symptoms |
| Heavy fixed weights early on | Resistance bands | Bands adjust to how you feel on the day |
| Lots of new exercises at once | One or two new exercises per session | New movements take brain power |

## When to stop and let me know

A small, short lived rise in symptoms that settles quickly is often part of the process, but if your symptoms build during a session, stop, rest, and tell me in the app before your next session.

Please also message me if your symptoms are worse the next day, if a particular exercise keeps bringing them on, or if you are unsure whether something is right for you. I would always rather hear from you early, because small changes to your programme are easy to make and they keep you moving forward.

If you notice a sudden or severe headache, repeated vomiting, new confusion, slurred speech, weakness or numbness, or worsening drowsiness, stop straight away and seek urgent medical help by calling 999 or going to A&E.

Dr David Silver PhD
$guide$
where name = 'Athena Concussion' and guide_body is null;

-- Clients already on Athena Concussion get a notice in the app that their
-- guide is ready. New clients meet it as the first screen after they log in.
insert into public.notifications (patient_id, type, title, body, link)
select p.id, 'guide_ready', 'Your Return to Strength guide is ready',
       'Please read this before you start. It explains why your programme is built the way it is.', '/session/guide'
from public.patients p
join public.brand_packs b on b.id = p.brand_pack_id
where b.name = 'Athena Concussion'
  and not exists (select 1 from public.notifications n where n.patient_id = p.id and n.type = 'guide_ready');
