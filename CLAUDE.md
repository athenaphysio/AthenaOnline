# Project Brief: Voice, Copy and Programme Model

**How to use this file.** Save it into the top level folder of your app project with the filename `CLAUDE.md`. Claude Code reads that file automatically at the start of every session, so you will not have to explain any of this again.

---

## 1. Who this app is for and what it is trying to do

This app supports clients of Dr David Silver PhD through rehabilitation and beyond. The clients are adults recovering from injury, from concussion and from long standing pain, and many of them have lost confidence in their own bodies as much as they have lost physical capacity.

The app has two jobs at once and must never do only one of them. It has to drive real, measured, progressive change in physical capacity, and it has to rebuild the client's willingness to move. An app that produces beautiful numbers and a frightened client has failed, and so has an app that produces a confident client with no measurable progress.

## 2. Voice

Write as Dr David Silver PhD would speak to a client he respects. The register is warm, precise, unhurried and adult. Assume intelligence. Never talk down.

**Hard rules, no exceptions:**

- Never use em dashes or en dashes anywhere in any copy. Use commas, semicolons or restructure the sentence.
- Always say client, never patient.
- Always write his name as Dr David Silver PhD, with PhD following the name.
- Default to longer flowing sentences rather than clipped fragments.
- British English spelling throughout.
- Never invent credentials, claims, statistics or clinical evidence. If a claim is needed and the source is unknown, leave a placeholder and flag it.

**Tone rules:**

- No exclamation marks in clinical copy.
- No cheerleading, no "You've got this", no "Crush it", no fitness app hype.
- No shaming for missed sessions, no punitive streak language, no red warning states for inactivity.
- No emoji in clinical or programme copy.
- Encouragement is specific and evidence based, so "your tolerance has gone from four minutes to eleven" rather than "great work".

## 3. Vocabulary substitutions

Apply these everywhere, including button labels, notifications, error states and emails.

| Do not use | Use instead |
|---|---|
| Patient | Client |
| Corrective exercise | Movement experiment, or enquiry |
| Compliance, adherence | Practice |
| Your bad knee, injured side | The side that is telling us the most |
| Protect it, be careful | Find your current edge |
| Listen to your body | Notice what changes when you |
| Failed, missed, behind | That is information |
| Prescription, prescribed | Programme, this is what we are working on |
| Assessment, screening | Reading how you move |
| Workout, session smashed | Practice, today's practice |
| Rest until it settles | Here is what we do while it settles |

## 4. The programme model, three stages

Every programme in the app is built from three stages. They are sequential in intent but overlapping in practice, and clients move backwards as well as forwards. The app must treat a return to an earlier stage as a normal, unremarkable event and must never present it as a loss, a reset or a failure.

### Stage 1: Awareness

**Purpose.** Re-inhabit the body, establish honest tolerance, reduce threat.

**Content.** Predictable, self paced, low decision load. Isolated and controlled loading. Range of motion. Isometrics. Breath. Symptom locating and description. Education. Clear ceilings so the client always knows where to stop.

**What the app should do here.** Keep choice small, keep instructions explicit, ask the client to record what they noticed as well as what they completed, and show tolerance improving over time.

**Exit criteria.** The client can describe sensation precisely rather than vaguely. Planned load is tolerated without escalation over the following twenty four hours. Objective baselines exist and are moving in the right direction.

**Example measures.** Range in degrees, isometric force, symptom score, tolerated duration, sleep and load diary, baseline visual and vestibular scores.

### Stage 2: Communication

**Purpose.** Put the body back into dialogue with the world.

**Content.** Reaction. Unpredictability. External pacing. Visual and vestibular integration. Dual task and cognitive interference work. Fatigue. Other people. The specific demands of the client's sport, work or family life.

**What the app should do here.** Introduce variability and timing, support externally paced and reactive tasks, and record performance both fresh and fatigued, and both single task and dual task, so that the cost of adding a second demand is visible.

**Exit criteria.** Capacity is maintained under distraction and under fatigue. Dual task cost sits within an acceptable margin. Task specific benchmarks relevant to that client are met.

**Example measures.** Reaction time, dual task cost as a percentage, repeat effort decrement, sport or role specific benchmarks.

### Stage 3: Creativity

**Purpose.** Meet the unrehearsed. This stage is the discharge criterion, not a bonus.

**Content.** Novel and unpracticed tasks. Constraint led challenges. Unfamiliar environments. Improvisation and play. Chaotic or open scenarios. Sessions the client designs themselves.

**What the app should do here.** Stop giving fully specified instructions and start giving constraints and problems. Support client authored sessions. Capture confidence and self efficacy alongside performance.

**Exit criteria.** The client performs novel, unpracticed tasks at the required intensity. Confidence and self efficacy measures are restored. The client is choosing to do things that are not in the programme.

**Example measures.** Performance on first attempt at unfamiliar tasks, self efficacy scale, return to activity status, unprompted activity.

## 5. How the philosophy shows up in the interface

The philosophy is expressed through structure and copy, not through slogans. Do not scatter the words physical intelligence and physical thinking across the interface.

- Every exercise carries a plain sentence explaining why it exists and what it is building towards. This is the single most important content rule in the app. Nothing appears in a programme without a reason the client can read.
- Every exercise asks the client what they noticed, not only whether they completed it, and that field is optional and never nags.
- Progress is always shown as real numbers against the client's own earlier numbers, never against a population average or another user.
- Setbacks are presented as data. The copy for a bad day should acknowledge it plainly, record it, and show what changes as a result.
- Stage transitions are explained. When a client moves from Awareness to Communication, tell them what is changing and why, in two or three sentences.
- The client can always see where they are in the three stage arc and what the criteria are for moving on.

### Uncertainty is a positive signal, and the app must treat it that way

Clients very commonly report that they were not sure they were doing an exercise correctly. In this practice that is understood as a sign of attention and engagement rather than a problem, and the app must never respond to it with correction, concern or a red state.

- Where a client can log how a practice felt, include an option along the lines of "not sure I was getting it right" and treat it as a positive engagement signal rather than a warning.
- The response copy for that option should affirm it plainly, for example: "That is a good sign. It means you were feeling the movement rather than just completing it. Tell Dr David Silver PhD what felt uncertain and it becomes useful information."
- Never trigger an alert, a flag or an automated correction prompt from a client reporting uncertainty about technique.
- Distinguish this in the data model from two things that are genuinely different and do need escalation, which are the client not understanding the instruction, and the client being unsure whether a sensation was safe. Both of those should offer an immediate route to ask a question rather than being logged and left.
- Repeated reports of comfortable certainty on the same exercise are also a signal, in that direction meaning the task may no longer be challenging the client. Surface that to the clinician as a possible progression prompt.

## 6. Things to avoid building

- Leaderboards, competitive comparison or social ranking.
- Streak mechanics that punish absence.
- Any automated normative comparison such as "your score is below average for your age".
- Vague wellness content with no measurable outcome attached.
- Pain scores presented as the primary progress metric, since a client can improve substantially while pain is unchanged.

## 7. When unsure

If a copy decision is ambiguous, choose the version that treats the client as a capable adult who is entitled to know why. If a clinical decision is ambiguous, do not guess. Flag it and leave it for Dr David Silver PhD to answer.
