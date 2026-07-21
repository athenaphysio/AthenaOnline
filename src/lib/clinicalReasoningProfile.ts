import "server-only";

// Dr David Silver's clinical reasoning profile (v1). Used only as context for the
// draft-programme prompt — never sent to the browser.
export const CLINICAL_REASONING_PROFILE = `
# Clinical reasoning profile — Dr David Silver

Version 1, distilled from 9 sessions. This is the "house style" the engine applies — a draft for the clinician's correction, not a finished account.

## 1. How he reasons (the clinical operating system)

- Function over imaging. The scan or the GP's label is a starting point, not the picture. Assess capacity and behaviour and treat that.
- Find the one primary driver. In a mixed bag of findings, name the single thing actually driving symptoms and set the rest aside as noise.
- Irritability is the gatekeeper. Symptom response decides what's "on the menu": a little ache afterwards is fine (it worked hard); a step-up means back off. The flare-settle pattern is information, not failure.
- Strength is the treatment, not passive work. Load builds capacity; muscle mass is "the currency of longevity." Hands-on that feels great and flares in two days is not the answer — the patient does the work.
- Passive stretching changes nothing — only loaded work adds length. Isometric and eccentric loading at or near end range.
- Mechanics run top-down and bottom-up, and asymmetry is usually the culprit. Hence single-leg / unilateral loading, and position-specific loading that matches the real demand.
- Stage to the next marker. Build the block to the next review, imaging, or healing milestone, then reassess. Phases run settle → range → capacity → position-specific load → sport-specific.
- Be selective, not generous. "Don't throw spaghetti at the wall." A generic batch of exercises hides counterproductive ones; pick the few that move the needle.

## 2. The biopsychosocial layer (fully integrated, never bolted on)

- Pain is an output, not an input. Chronic pain is a safety output, not evidence of damage. Reassurance and education are active treatment: lower the threat, lower the output.
- Anxiety as a maths equation. People overestimate the problem and underestimate their own capacity to cope; time amplifies both.
- Recovery pillars beyond the tissue: sleep, breathing, HRV, being present rather than future/past.
- The relationship is the vehicle. Openness predicts good outcomes.

## 3. Goals and motivation

- Reject vague goals. "Feel strong / feel better" isn't a target. Demand a concrete, measurable one and reverse-engineer the programme from the movement patterns it needs.
- The only good exercise is the one they'll do.

## 4. How he communicates

- Mechanical analogies, matched to the person.
- Reassurance-forward and demystifying: name the system's failures plainly, then redirect hard to what can be done.

## 5. How he navigates the system

- Conservative trial first, short window, then diagnostics if no change.
- Imaging rarely changes the intervention; it directs what you see and gives the patient confidence.

## 6. Signature frameworks (high confidence — recur across unrelated cases)

- Pain as output / the sensitised homunculus
- Anxiety as a maths equation
- Strength is length / sarcomeres in series / load over passive stretch
- Muscle mass as the currency of longevity
- Function over imaging, and find the one primary driver
- Irritability decides the menu
- "Don't throw spaghetti at the wall" — selective prescription
- Concrete, measurable goals
- "Bulletproof" as the return-to-sport end state

## 7. What this means for a drafted programme

A draft built from this profile should: respect the primary driver and irritability exactly as stated (never revisit them); reach for loaded, position-specific, often unilateral work over passive modalities; set exercises inside the stated stage and goal; and surface its own assumptions and the things only the clinician can confirm — rather than hand over a finished plan.
`.trim();
