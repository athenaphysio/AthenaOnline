-- Tools tab, part two: a Recovery area (which covers sleep), a per flow
-- choice of which Tools area it shows under, and breath patterns on moves
-- (in-hold-out-hold, for example 4-4-4-4) so box breathing and long
-- exhale practices pace correctly. Then draft shells, never shown to
-- clients, for every practice in the Tools build plan document.
alter table public.flows drop constraint if exists flows_category_check;
alter table public.flows
  add constraint flows_category_check
  check (category in ('neurodynamic', 'everyday_task', 'mobility', 'breath', 'mind', 'recovery'));

alter table public.flows add column if not exists tools_area text
  check (tools_area is null or tools_area in ('breath', 'nervous', 'mind', 'recovery'));

alter table public.flow_moves add column if not exists breath_pattern text;

do $$
declare f uuid;
begin
  if not exists (select 1 from public.flows where title = 'Long Exhale Settle') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('Long Exhale Settle', 'breath', 'whole_body', 'Seated or lying, after a stressful meeting or a hard session', 'A slow lengthening of the breath out, used to bring the body down after stress or load.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 100, null)
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Arrive', 30, 0, '4-0-4-0', '', 'Sit or lie comfortably and let the breath find its own pace.', null),
      (f, 2, 'Lengthen the breath out', 60, 0, '4-0-6-0', '', 'Breathe in through the nose for four, then let the breath out slowly for six.', null),
      (f, 3, 'Longer still', 90, 0, '4-0-8-0', '', 'Stretch the breath out to eight if it stays comfortable; return to six if not.', null),
      (f, 4, 'Back to your own breath', 30, 0, null, '', 'Let the breath return to its own rhythm and notice what has changed.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'Box Breathing') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('Box Breathing', 'breath', 'whole_body', 'Seated, before a presentation, a big meeting or a match', 'An even, four sided breath that steadies attention before something that matters.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 110, null)
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Settle', 20, 0, '4-0-4-0', '', 'Sit tall with both feet on the floor and soften the shoulders.', null),
      (f, 2, 'Box breathing', 200, 0, '4-4-4-4', '', 'In for four, hold for four, out for four, hold for four.', null),
      (f, 3, 'Release', 20, 0, null, '', 'Let the count go and breathe normally.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'Steady Rhythm Breathing') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('Steady Rhythm Breathing', 'breath', 'whole_body', 'Seated, any time of day', 'Slow, even breathing at about six breaths a minute, used to settle into a steady rhythm.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 120, null)
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Settle', 30, 0, '4-0-4-0', '', 'Find a comfortable seat and let the breath slow down by itself.', null),
      (f, 2, 'Steady rhythm', 240, 0, '5-0-5-0', '', 'Breathe in for five and out for five, smooth and unforced.', null),
      (f, 3, 'Release', 30, 0, null, '', 'Let the rhythm go and notice how you feel now.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'Walking Nose Breathing') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('Walking Nose Breathing', 'breath', 'whole_body', 'Walking outdoors at an easy pace', 'A walking practice that keeps the breath through the nose and lets the out breath lengthen.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 130, null)
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Walk easy', 60, 0, null, '', 'Walk at a pace where you could hold a conversation.', null),
      (f, 2, 'Nose only', 120, 0, null, '', 'Breathe in and out through the nose, matching the breath to your steps.', null),
      (f, 3, 'Longer out breath', 90, 0, null, '', 'Take a few more steps on each breath out than on each breath in.', null),
      (f, 4, 'Finish', 30, 0, null, '', 'Let the breath be natural and notice how your body feels walking now.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'Eyes and Balance: Eye Tracking') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('Eyes and Balance: Eye Tracking', 'neurodynamic', 'whole_body', 'Seated, with a pen or your thumb as a target', 'Smooth following and quick switching of the eyes, part of the VOMS eye and balance series.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 140, null)
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Settle', 20, 0, '4-0-4-0', '', 'Sit tall, head still, and hold your thumb at arm''s length.', null),
      (f, 2, 'Smooth pursuit, side to side', 30, 0, null, '', 'Follow your thumb slowly side to side with the eyes only, keeping the head still.', null),
      (f, 3, 'Smooth pursuit, up and down', 30, 0, null, '', 'Follow your thumb slowly up and down with the eyes only.', null),
      (f, 4, 'Rest and notice', 15, 0, null, '', 'Close your eyes and notice any change in symptoms.', null),
      (f, 5, 'Saccades, side to side', 30, 0, null, '', 'Hold two targets apart and switch your eyes quickly between them.', null),
      (f, 6, 'Saccades, up and down', 30, 0, null, '', 'Switch your eyes quickly between a target above and a target below.', null),
      (f, 7, 'Rest and notice', 20, 0, null, '', 'Rest your eyes and notice how they feel compared with the start.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'Eyes and Balance: Gaze Stability') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('Eyes and Balance: Gaze Stability', 'neurodynamic', 'whole_body', 'Seated first, standing when ready', 'Keeping the eyes fixed on a target while the head moves, part of the VOMS eye and balance series.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 150, null)
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Settle', 20, 0, '4-0-4-0', '', 'Fix your eyes on a target at arm''s length.', null),
      (f, 2, 'Head turns, side to side', 30, 0, null, '', 'Turn the head side to side while the eyes stay on the target.', null),
      (f, 3, 'Rest and notice', 20, 0, null, '', 'Stop and notice any change in symptoms.', null),
      (f, 4, 'Head nods, up and down', 30, 0, null, '', 'Nod the head up and down while the eyes stay on the target.', null),
      (f, 5, 'Rest and notice', 20, 0, null, '', 'Rest and notice how your head and eyes feel.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'Eyes and Balance: Near Focus') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('Eyes and Balance: Near Focus', 'neurodynamic', 'whole_body', 'Seated, with a pen', 'Bringing both eyes together on a near target, part of the VOMS eye and balance series.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 160, null)
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Settle', 15, 0, '4-0-4-0', '', 'Hold a pen at arm''s length, level with your nose.', null),
      (f, 2, 'Pen towards the nose', 45, 0, null, '', 'Bring the pen slowly towards your nose until it doubles, then move it back.', null),
      (f, 3, 'Rest and notice', 20, 0, null, '', 'Look into the distance and notice any change.', null),
      (f, 4, 'Pen towards the nose', 45, 0, null, '', 'Repeat slowly, keeping the pen single for as long as you can.', null),
      (f, 5, 'Rest and notice', 15, 0, null, '', 'Look into the distance and let the eyes relax.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'Eyes and Balance: Busy Visual Worlds') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('Eyes and Balance: Busy Visual Worlds', 'neurodynamic', 'whole_body', 'Standing, feet comfortably apart', 'Turning the body while the eyes hold a moving target, for busy places such as shops and stations. Part of the VOMS eye and balance series.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 170, null)
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Settle', 15, 0, '4-0-4-0', '', 'Stand with feet comfortably apart and thumb at arm''s length.', null),
      (f, 2, 'Turn with your thumb', 30, 0, null, '', 'Turn the head and trunk together side to side, eyes on your thumb.', null),
      (f, 3, 'Rest and notice', 20, 0, null, '', 'Stand still and notice any change in symptoms.', null),
      (f, 4, 'Turn with your thumb', 30, 0, null, '', 'Repeat at a pace you can manage comfortably.', null),
      (f, 5, 'Rest and notice', 20, 0, null, '', 'Stand still and let everything settle.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'Travel Reset') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('Travel Reset', 'mobility', 'whole_body', 'In your seat on a plane, train or in a parked car', 'A seated reset for long journeys that keeps the legs, back and neck moving without leaving your seat.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 180, 'nervous')
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Settle and breathe', 20, 0, '4-0-6-0', '', 'Sit tall and take a few long breaths out.', null),
      (f, 2, 'Ankle pumps', 40, 0, null, 'Both', 'Lift the toes, then the heels, in a steady rhythm.', null),
      (f, 3, 'Seated knee lifts', 40, 0, null, 'Both', 'Lift one knee a little, then the other, like marching in your seat.', null),
      (f, 4, 'Seated rotation', 30, 0, null, 'Right', 'Hands across the chest, turn gently to the right.', null),
      (f, 5, 'Seated rotation', 30, 0, null, 'Left', 'Hands across the chest, turn gently to the left.', null),
      (f, 6, 'Chin nods', 30, 0, null, '', 'Small nods, as if saying yes, keeping the movement easy.', null),
      (f, 7, 'Shoulder blade squeeze', 30, 0, null, '', 'Draw the shoulder blades gently back and down, then release.', null),
      (f, 8, 'Seated sciatic glide', 30, 0, null, 'Right', 'Straighten the knee as the head looks up, bend it as the head looks down.', 'EX-120'),
      (f, 9, 'Seated sciatic glide', 30, 0, null, 'Left', 'Straighten the knee as the head looks up, bend it as the head looks down.', 'EX-120'),
      (f, 10, 'Finish and breathe', 20, 0, '4-0-6-0', '', 'Settle back and notice how your body feels now.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'Desk Reset') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('Desk Reset', 'mobility', 'whole_body', 'Seated at a desk, between meetings', 'A short reset at the desk for the neck, back, arms and eyes, done without needing space or kit.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 190, 'nervous')
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Sit tall and breathe', 20, 0, '4-0-6-0', '', 'Feet flat, sit tall away from the backrest.', null),
      (f, 2, 'Shoulder rolls', 20, 0, null, 'Both', 'Slow circles back and down.', null),
      (f, 3, 'Chin nods', 20, 0, null, '', 'Small, easy nods to free the neck.', null),
      (f, 4, 'Seated extension', 30, 0, null, '', 'Hands behind the head, lift the chest gently towards the ceiling.', null),
      (f, 5, 'Seated rotation', 20, 0, null, 'Right', 'Turn gently to the right using the chair for support.', null),
      (f, 6, 'Seated rotation', 20, 0, null, 'Left', 'Turn gently to the left using the chair for support.', null),
      (f, 7, 'Median nerve glide', 30, 0, null, 'Right', 'Arm out to the side, palm up; straighten and bend the elbow with the head moving with you.', 'EX-067'),
      (f, 8, 'Median nerve glide', 30, 0, null, 'Left', 'Arm out to the side, palm up; straighten and bend the elbow with the head moving with you.', 'EX-067'),
      (f, 9, 'Sit to stand', 30, 0, null, '', 'Stand up and sit down slowly a few times.', null),
      (f, 10, 'Eye break', 20, 0, null, '', 'Look at something far away and let the eyes soften.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'Body Scan') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('Body Scan', 'mind', 'whole_body', 'Seated or lying somewhere quiet', 'Moving attention slowly through the body and describing what you find, as precisely as you can.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 200, null)
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Arrive', 30, 0, '4-0-4-0', '', 'Get comfortable and let the eyes close or rest on the floor.', null),
      (f, 2, 'Feet and lower legs', 45, 0, null, '', 'Notice temperature, contact and pressure. Describe it rather than judge it.', null),
      (f, 3, 'Knees and thighs', 45, 0, null, '', 'Notice what is there, and what is not.', null),
      (f, 4, 'Hips and lower back', 45, 0, null, '', 'Notice where the body meets the chair or floor.', null),
      (f, 5, 'Belly and chest', 45, 0, null, '', 'Notice the movement of the breath without changing it.', null),
      (f, 6, 'Hands, arms and shoulders', 45, 0, null, '', 'Notice any holding, and whether it changes as you notice it.', null),
      (f, 7, 'Neck, face and head', 45, 0, null, '', 'Notice the jaw, the eyes and the forehead.', null),
      (f, 8, 'Whole body', 45, 0, null, '', 'Take in the whole body at once.', null),
      (f, 9, 'Return', 15, 0, null, '', 'Open the eyes and notice what you see.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'Grounding Practice') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('Grounding Practice', 'mind', 'whole_body', 'Anywhere, when things feel like too much', 'Using the five senses to bring attention back to where you are right now.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 210, null)
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Arrive', 15, 0, '4-0-6-0', '', 'Pause where you are and take one long breath out.', null),
      (f, 2, 'Five things you can see', 30, 0, null, '', 'Name five things you can see, slowly.', null),
      (f, 3, 'Four things you can feel', 30, 0, null, '', 'Name four things you can feel, such as your feet on the floor.', null),
      (f, 4, 'Three things you can hear', 30, 0, null, '', 'Name three things you can hear, near and far.', null),
      (f, 5, 'Two things you can smell', 30, 0, null, '', 'Name two things you can smell, or two smells you like.', null),
      (f, 6, 'One thing you can taste', 20, 0, null, '', 'Name one thing you can taste.', null),
      (f, 7, 'Feet on the floor', 25, 0, '4-0-6-0', '', 'Press the feet into the floor and breathe out long.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'Practice for Pain') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('Practice for Pain', 'mind', 'whole_body', 'Seated or lying, when pain is loud', 'A way of meeting pain with attention rather than alarm: locating it, describing it, and finding what helps while it settles.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 220, null)
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Arrive', 30, 0, '4-0-6-0', '', 'Find the most comfortable position available right now.', null),
      (f, 2, 'Locate it', 45, 0, null, '', 'Where exactly is it? How big is the area, and where are its edges?', null),
      (f, 3, 'Describe it', 60, 0, null, '', 'Is it sharp, dull, warm, tight, moving or still? Find the most accurate words.', null),
      (f, 4, 'Sensation and story', 45, 0, null, '', 'Notice the sensation itself, and separately notice any thoughts about what it means.', null),
      (f, 5, 'Breathe around it', 60, 0, '4-0-6-0', '', 'Let the breath out lengthen and notice the area around the pain.', null),
      (f, 6, 'Small easy movement nearby', 45, 0, null, '', 'Move a part close to the pain, gently, within your current edge.', null),
      (f, 7, 'What we do while it settles', 15, 0, null, '', 'Choose one small next step for the next hour.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'After Load Wind Down') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('After Load Wind Down', 'recovery', 'whole_body', 'After training, a match or a long day on your feet', 'Bringing the body down after load with long breaths out, legs up and easy movement.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 230, null)
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Breathe down', 30, 0, '4-0-6-0', '', 'Long breath out to bring the heart rate down.', null),
      (f, 2, 'Walk it out', 30, 0, null, '', 'A few easy steps, shaking out the legs.', null),
      (f, 3, 'Legs up the wall', 90, 0, '4-0-6-0', '', 'Lie with the legs resting up a wall or on a chair.', null),
      (f, 4, 'Rest position', 60, 0, null, '', 'Kneel and fold forward, or lie on your side, whichever is easiest.', null),
      (f, 5, 'Seated sciatic glide', 30, 0, null, 'Right', 'Straighten and bend the knee with the head moving with you.', 'EX-120'),
      (f, 6, 'Seated sciatic glide', 30, 0, null, 'Left', 'Straighten and bend the knee with the head moving with you.', 'EX-120'),
      (f, 7, 'Notice', 30, 0, null, '', 'Notice how the body feels now compared with the start.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'End of the Working Day') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('End of the Working Day', 'recovery', 'whole_body', 'At your desk, as you finish work', 'A short transition from work to the rest of the day, for body and attention.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 240, null)
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Close the laptop', 15, 0, null, '', 'Close the laptop or turn the screen away.', null),
      (f, 2, 'Stand and lengthen', 30, 0, null, '', 'Stand up and reach tall, then let the arms fall.', null),
      (f, 3, 'Shoulder and neck release', 30, 0, null, '', 'Slow shoulder rolls and gentle chin nods.', null),
      (f, 4, 'Long breath out', 60, 0, '4-0-6-0', '', 'Breathe in for four and out for six.', null),
      (f, 5, 'Done and next', 30, 0, null, '', 'Name one thing you finished today and one thing for tomorrow.', null),
      (f, 6, 'Walk away', 15, 0, null, '', 'Walk away from the desk.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'Sleep Wind Down') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('Sleep Wind Down', 'recovery', 'whole_body', 'In bed, lights low', 'A slow practice in bed that releases the body and lengthens the breath before sleep.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 250, null)
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Settle', 60, 0, '4-0-6-0', '', 'Lie in your usual sleeping position and let the breath slow.', null),
      (f, 2, 'Feet and legs, tense and release', 60, 0, null, '', 'Tighten the feet and legs gently for a few seconds, then let them go heavy.', null),
      (f, 3, 'Hands and arms, tense and release', 60, 0, null, '', 'Make soft fists and tighten the arms, then let them go heavy.', null),
      (f, 4, 'Shoulders and face, tense and release', 60, 0, null, '', 'Lift the shoulders and scrunch the face, then let everything soften.', null),
      (f, 5, 'Short body scan', 120, 0, null, '', 'Move attention slowly from the feet to the head, noticing heaviness and warmth.', null),
      (f, 6, 'Long breath out', 120, 0, '4-0-8-0', '', 'Breathe in for four and out for eight, letting each breath out be slower.', null);
  end if;
  if not exists (select 1 from public.flows where title = 'Back to Sleep') then
    insert into public.flows (title, category, body_area, entry_point, summary, status, notes, sort_order, tools_area)
    values ('Back to Sleep', 'recovery', 'whole_body', 'In bed, in the middle of the night', 'A quiet practice for waking in the night, best listened to rather than watched.', 'draft', 'Draft from the Tools build plan (Nov 2026). Cue wording is placeholder, rewrite in your own clinical language before filming.', 260, null)
    returning id into f;
    insert into public.flow_moves (flow_id, move_order, name, seconds, breath_seconds, breath_pattern, side, cue, exercise_id) values
      (f, 1, 'Notice the breath', 60, 0, null, '', 'Stay still and notice the breath without changing it.', null),
      (f, 2, 'Long breath out', 120, 0, '4-0-8-0', '', 'Breathe in for four and out for eight.', null),
      (f, 3, 'Heavy body', 120, 0, null, '', 'Feel each part of the body sink into the bed, from the feet upwards.', null);
  end if;
end $$;
