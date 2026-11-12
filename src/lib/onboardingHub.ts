// The consultation hub: the fourteen part onboarding consultation as one
// record per client. Every field holds a value, where it came from, and
// whether Dr David Silver PhD has confirmed it. Anything already known from
// another source (the medical report, the psychometrics, the bloods, the
// wearable, registration) is shown before the conversation, so the client
// is asked to confirm it rather than asked again.
//
// This file is shared by the server and the browser, so it holds the
// definitions only.

export type HubFieldKind = "text" | "scale";

export type HubField = {
  key: string;
  label: string;
  kind: HubFieldKind;
  // A short note on what to capture, shown under the field.
  hint?: string;
};

export type HubSection = {
  key: string;
  number: number;
  title: string;
  purpose: string;
  // Always asked in full, even when everything is already known, because the
  // client's own words are the point of the section.
  alwaysFull?: boolean;
  // A section where a safety concern must be acted on at once.
  safety?: boolean;
  // Passport areas whose results are shown in this section.
  passportDomains?: string[];
  fields: HubField[];
};

export type HubStatus = "confirmed" | "to_confirm";

export type HubFieldValue = {
  field_key: string;
  value: string;
  source: string | null;
  status: HubStatus;
  confirmed_at: string | null;
  updated_at: string;
};

const scale = (key: string, label: string, hint?: string): HubField => ({ key, label, kind: "scale", hint });
const text = (key: string, label: string, hint?: string): HubField => ({ key, label, kind: "text", hint });

export const HUB_SECTIONS: HubSection[] = [
  {
    key: "opening",
    number: 1,
    title: "Opening and framing",
    purpose: "Set out how the conversation will run, confirm consent, and hear why they are here in their own words.",
    fields: [
      text("opening.consent", "Consent to the consultation and to notes being kept"),
      text("opening.referral_route", "Referral route", "Who referred them, and how they came to the programme."),
      text("opening.reason", "Reason for coming, in their own words", "Write it as they said it."),
      scale("opening.readiness", "Readiness to make changes now (0 to 10)"),
    ],
  },
  {
    key: "person",
    number: 2,
    title: "The person and their life",
    purpose: "Understand the shape of their week and the demands on their time and attention.",
    fields: [
      text("person.role", "Role, organisation and seniority"),
      text("person.working_pattern", "Working pattern, hours and travel"),
      text("person.household", "Household and dependants"),
      text("person.protected_time", "Protected time, and when it happens"),
      scale("person.control", "Sense of control over their time (0 to 10)"),
    ],
  },
  {
    key: "goals",
    number: 3,
    title: "Goals",
    purpose: "Capture up to three goals in their own words, and the value that sits beneath each.",
    alwaysFull: true,
    fields: [
      text("goals.goal_1", "Goal one, verbatim"),
      text("goals.goal_2", "Goal two, verbatim"),
      text("goals.goal_3", "Goal three, verbatim"),
      text("goals.values", "The value beneath each goal"),
      text("goals.anchor", "Anchor statement", "One sentence the client would recognise as theirs."),
      scale("goals.importance", "Importance of these goals (0 to 10)"),
    ],
  },
  {
    key: "health",
    number: 4,
    title: "Health and medical history",
    purpose: "Confirm what the medical report and bloods already tell us, and fill only the gaps.",
    safety: true,
    passportDomains: ["blood", "heart_recovery"],
    fields: [
      text("health.history", "Past medical and surgical history"),
      text("health.medication", "Medication and supplements"),
      text("health.allergies", "Allergies"),
      text("health.cardio_screen", "Cardiovascular screen"),
      text("health.family_history", "Family history"),
      text("health.gp", "GP, and permission to share with them"),
      scale("health.rating", "Rating of their own health (0 to 10)"),
    ],
  },
  {
    key: "body",
    number: 5,
    title: "Body, pain and injury",
    purpose: "Hear how their body is now, in their own words, including what they have stopped doing.",
    alwaysFull: true,
    fields: [
      text("body.symptoms", "Current symptoms"),
      text("body.injury_history", "Injury history"),
      text("body.previous_treatment", "Previous treatment, and what helped"),
      text("body.own_explanation", "Their own explanation, verbatim"),
      text("body.avoided", "Activities they now avoid"),
      scale("body.pain_interference", "Pain interference (0 to 10)"),
      scale("body.pain_intensity", "Pain intensity (0 to 10)"),
    ],
  },
  {
    key: "movement",
    number: 6,
    title: "Movement",
    purpose: "Read how they move now, what they have moved like before, and what they have access to.",
    alwaysFull: true,
    passportDomains: ["body_movement"],
    fields: [
      text("movement.current", "Current activity"),
      text("movement.history", "Training and sport history"),
      text("movement.everyday", "Everyday tasks that are harder than they should be"),
      text("movement.equipment", "Equipment and access"),
      text("movement.wearables", "Wearables in use"),
      scale("movement.body_confidence", "Confidence in their body (0 to 10)"),
      scale("movement.body_connection", "Connection with their body (0 to 10)"),
    ],
  },
  {
    key: "energy",
    number: 7,
    title: "Energy, sleep and recovery",
    purpose: "Set the wearable and questionnaire picture beside how they say they sleep and recover.",
    passportDomains: ["sleep_energy", "heart_recovery"],
    fields: [
      text("energy.sleep", "Sleep and wake times, hours and quality"),
      text("energy.caffeine_alcohol", "Caffeine and alcohol"),
      text("energy.recovery", "Recovery practices"),
      text("energy.pattern", "Energy pattern through the day"),
      scale("energy.rested", "How rested they feel (0 to 10)"),
      scale("energy.energy", "Energy level (0 to 10)"),
    ],
  },
  {
    key: "nutrition",
    number: 8,
    title: "Nutrition",
    purpose: "Understand how and when they eat, and whether they want support with it.",
    passportDomains: ["gut"],
    fields: [
      text("nutrition.pattern", "Eating pattern and timing"),
      text("nutrition.choices", "Dietary choices and allergies"),
      text("nutrition.hydration", "Hydration"),
      text("nutrition.interest", "Interest in nutrition support"),
      scale("nutrition.rating", "Satisfaction with how they eat (0 to 10)"),
    ],
  },
  {
    key: "mind",
    number: 9,
    title: "Mind and stress",
    purpose: "Confirm what the psychometrics show and hear how they cope, in their own words.",
    safety: true,
    passportDomains: ["mind_behaviour"],
    fields: [
      text("mind.stressors", "Sources of stress"),
      text("mind.coping", "How they cope, in their words"),
      text("mind.previous_support", "Previous support"),
      text("mind.interest", "Interest in mental fitness work"),
      scale("mind.stress", "Stress level (0 to 10)"),
      scale("mind.coping_scale", "How well they feel they are coping (0 to 10)"),
    ],
  },
  {
    key: "work",
    number: 10,
    title: "Work",
    purpose: "Understand what work asks of them and the conditions in which they do their best work.",
    fields: [
      text("work.demands", "Demands profile"),
      text("work.best_conditions", "Conditions for their best performance"),
      text("work.ergonomics", "Ergonomics and workspace"),
      scale("work.performance", "Current work performance (0 to 10)"),
    ],
  },
  {
    key: "relationships",
    number: 11,
    title: "Relationships and support",
    purpose: "Find who will help, what will get in the way, and the organisational context.",
    fields: [
      text("relationships.supporters", "Key supporters"),
      text("relationships.enablers_barriers", "Enablers and barriers"),
      text("relationships.organisation", "Organisational context"),
      scale("relationships.support", "How supported they feel (0 to 10)"),
    ],
  },
  {
    key: "habits",
    number: 12,
    title: "Habits and readiness",
    purpose: "Learn from changes they have made before, and how they like to be held to account.",
    fields: [
      text("habits.past_success", "Past changes that worked"),
      text("habits.past_unsuccessful", "Past changes that did not hold"),
      text("habits.helpful", "Helpful habits already in place"),
      text("habits.barriers", "Barriers"),
      text("habits.accountability", "Accountability style"),
      scale("habits.confidence", "Confidence in making the change (0 to 10)"),
    ],
  },
  {
    key: "contact",
    number: 13,
    title: "Contact and data",
    purpose: "Agree how and when to stay in touch, and what data they are happy to share.",
    fields: [
      text("contact.channel", "Preferred channel, times and frequency"),
      text("contact.devices", "Devices and data permissions"),
      text("contact.platform", "Platform onboarding status"),
      text("contact.travel", "Travel calendar"),
    ],
  },
  {
    key: "closing",
    number: 14,
    title: "Closing",
    purpose: "Read back what was heard, agree the first action, and set the next contact.",
    alwaysFull: true,
    fields: [
      text("closing.summary", "Summary read back, and corrections"),
      text("closing.priority", "Top priority"),
      text("closing.first_action", "First action"),
      text("closing.next_contact", "Next contact"),
      text("closing.referrals", "Referrals"),
      scale("closing.confidence", "Confidence in the first action (0 to 10)"),
    ],
  },
];

export const HUB_FIELDS: (HubField & { section: string })[] = HUB_SECTIONS.flatMap((s) =>
  s.fields.map((f) => ({ ...f, section: s.key })),
);

export function hubFieldByKey(key: string) {
  return HUB_FIELDS.find((f) => f.key === key) ?? null;
}
