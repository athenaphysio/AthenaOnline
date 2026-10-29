// The Onboarding Consultation Framework (Dr David Silver PhD, version 1,
// October 2026) as data, so the Client context form, the AI reading of
// Twofold notes and the passport all use the same sections, fields and
// scale wording. Scale questions must stay word for word, since they are
// repeated identically at month 6.

export type ContextSectionDef = {
  key: string;
  number: number;
  title: string;
  capture: string[];
};

export const CONTEXT_SECTIONS: ContextSectionDef[] = [
  { key: "opening", number: 1, title: "Opening and framing", capture: ["Consent to assessment, recording and data sharing", "Referral route", "Reason for attending, in their own words"] },
  { key: "person_life", number: 2, title: "The person and their life", capture: ["Role, organisation and seniority", "Working pattern, hours and travel", "Household and dependants", "Protected time"] },
  { key: "goals_meaning", number: 3, title: "Goals, aspirations and meaning", capture: ["Up to three goals, verbatim", "The value beneath each goal", "Anchor statement"] },
  { key: "health_history", number: 4, title: "Health and medical history", capture: ["Past medical and surgical history", "Current medication and supplements", "Allergies", "Cardiovascular screening", "Relevant family history", "GP details and permission to share"] },
  { key: "body_pain", number: 5, title: "Body, pain and injury story", capture: ["Current symptoms and 24 hour pattern", "Injury history with dates and outcomes", "Previous treatment and what they made of it", "Their own explanation of their pain, verbatim", "Activities avoided or modified"] },
  { key: "movement", number: 6, title: "Movement, physical capacity and physical intelligence", capture: ["Current activity", "Training and sport history", "Everyday task difficulties", "Equipment and access", "Wearables in use"] },
  { key: "energy_sleep", number: 7, title: "Energy, sleep and recovery", capture: ["Sleep and wake times, hours, quality", "Caffeine and alcohol", "Recovery practices", "Energy pattern across the day"] },
  { key: "nutrition", number: 8, title: "Nutrition and fuel", capture: ["Eating pattern and meal timing", "Dietary choices", "Hydration", "Interest in nutrition support"] },
  { key: "mind_stress", number: 9, title: "Mind, stress and emotional load", capture: ["Main sources of stress", "Coping strategies, in their words", "Previous or current psychological support", "Interest in mental fitness support"] },
  { key: "work", number: 10, title: "Work, performance and cognitive demand", capture: ["Work demands profile", "When they perform best", "Workstation and travel ergonomics"] },
  { key: "support", number: 11, title: "Relationships, support and environment", capture: ["Key supporters", "Environmental enablers and barriers", "Organisational context"] },
  { key: "habits_readiness", number: 12, title: "Habits, past attempts and readiness for change", capture: ["Past changes that stuck and did not, with reasons", "Existing helpful habits", "Anticipated barriers", "Preferred accountability style"] },
  { key: "contact_data", number: 13, title: "Contact, data and technology preferences", capture: ["Preferred channel, times and frequency", "Devices and data sharing permissions", "Travel calendar"] },
  { key: "closing", number: 14, title: "Closing, reflection and first action", capture: ["Summary and the client's corrections", "Top priority, in their words", "One first action", "Next contact date and channel", "Referrals agreed"] },
];

// The sixteen scales. "domain" is where each one appears in the Human
// Passport, and "better" says which way is an improvement.
export type ScaleDef = {
  key: string;
  label: string;
  question: string;
  low: string;
  high: string;
  section: string;
  domain: "sleep_energy" | "body_movement" | "mind_behaviour";
  better: "higher" | "lower";
};

export const CONTEXT_SCALES: ScaleDef[] = [
  { key: "readiness", label: "Readiness to change", question: "How ready do you feel to make some changes right now?", low: "not at all", high: "completely ready", section: "opening", domain: "mind_behaviour", better: "higher" },
  { key: "control", label: "Control over the week", question: "How much control do you feel you have over your week?", low: "none", high: "complete", section: "person_life", domain: "mind_behaviour", better: "higher" },
  { key: "importance", label: "Importance of goals", question: "How important is this to you?", low: "not at all", high: "the most important thing", section: "goals_meaning", domain: "mind_behaviour", better: "higher" },
  { key: "health", label: "Self rated health", question: "Overall, how would you rate your health right now?", low: "very poor", high: "excellent", section: "health_history", domain: "body_movement", better: "higher" },
  { key: "pain_interference", label: "Pain interference", question: "On a typical day, how much does pain or discomfort get in the way of what you want to do?", low: "not at all", high: "completely", section: "body_pain", domain: "body_movement", better: "lower" },
  { key: "body_confidence", label: "Body confidence", question: "How confident are you in your body's ability to do what you ask of it?", low: "not at all", high: "completely", section: "movement", domain: "body_movement", better: "higher" },
  { key: "body_connection", label: "Body connection", question: "How connected do you feel to your body day to day?", low: "not at all", high: "completely", section: "movement", domain: "body_movement", better: "higher" },
  { key: "rested", label: "Rested on waking", question: "How rested do you usually feel when you wake up?", low: "exhausted", high: "fully refreshed", section: "energy_sleep", domain: "sleep_energy", better: "higher" },
  { key: "energy", label: "Everyday energy", question: "How would you rate your energy on an average day?", low: "", high: "", section: "energy_sleep", domain: "sleep_energy", better: "higher" },
  { key: "eating", label: "Eating supports energy", question: "How well do you feel your eating supports your energy and performance?", low: "not at all", high: "completely", section: "nutrition", domain: "sleep_energy", better: "higher" },
  { key: "stress", label: "Stress load", question: "How much stress are you carrying at the moment?", low: "none", high: "overwhelming", section: "mind_stress", domain: "mind_behaviour", better: "lower" },
  { key: "coping", label: "Coping", question: "How well are you coping with it?", low: "not at all", high: "very well", section: "mind_stress", domain: "mind_behaviour", better: "higher" },
  { key: "work_performance", label: "Work performance", question: "How close to your best are you performing at work right now?", low: "nowhere near", high: "at my best", section: "work", domain: "mind_behaviour", better: "higher" },
  { key: "support", label: "Feeling supported", question: "How supported do you feel in making changes?", low: "not at all", high: "fully", section: "support", domain: "mind_behaviour", better: "higher" },
  { key: "confidence", label: "Confidence to change", question: "How confident are you that you can make the changes we have talked about?", low: "not at all", high: "completely", section: "habits_readiness", domain: "mind_behaviour", better: "higher" },
  { key: "first_action_confidence", label: "First action confidence", question: "How confident are you that you will do that first action?", low: "not at all", high: "completely", section: "closing", domain: "mind_behaviour", better: "higher" },
];

export const FLAG_KINDS = [
  { key: "red_flag", label: "Red flag, needs clinical review" },
  { key: "referral", label: "Referral need" },
  { key: "note", label: "Note for the plan" },
] as const;

export type ContextFlag = { kind: (typeof FLAG_KINDS)[number]["key"]; text: string };
export type ContextGoal = { goal: string; value: string; importance: number | null };
export type ContextSection = { key: string; summary: string; fields: { label: string; value: string }[]; quotes: string[]; codes: string[] };
export type ContextScale = { key: string; score: number | null };

export type ContextContent = {
  sections: ContextSection[];
  scales: ContextScale[];
  goals: ContextGoal[];
  flags: ContextFlag[];
  anchor_statement: string;
  top_priority: string;
  first_action: string;
  referral: {
    presenting_complaint: string;
    date_of_onset: string;
    mechanism_of_injury: string;
    referred_via: string;
    referral_goals_history: string;
  };
};

// An empty form, with every section and scale in place, ready to fill.
export function emptyContext(): ContextContent {
  return {
    sections: CONTEXT_SECTIONS.map((s) => ({ key: s.key, summary: "", fields: s.capture.map((label) => ({ label, value: "" })), quotes: [], codes: [] })),
    scales: CONTEXT_SCALES.map((s) => ({ key: s.key, score: null })),
    goals: [],
    flags: [],
    anchor_statement: "",
    top_priority: "",
    first_action: "",
    referral: { presenting_complaint: "", date_of_onset: "", mechanism_of_injury: "", referred_via: "", referral_goals_history: "" },
  };
}

// Make any stored or AI produced content safe to show in the form: every
// section and scale present, in framework order, and nothing malformed.
export function normaliseContext(raw: Partial<ContextContent> | null | undefined): ContextContent {
  const base = emptyContext();
  if (!raw) return base;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const sections = base.sections.map((empty) => {
    const found = Array.isArray(raw.sections) ? raw.sections.find((s) => s?.key === empty.key) : undefined;
    if (!found) return empty;
    const fields = empty.fields.map((f) => {
      const match = Array.isArray(found.fields) ? found.fields.find((x) => x?.label === f.label) : undefined;
      return { label: f.label, value: str(match?.value) };
    });
    // Keep any extra fields the notes produced beyond the standard list.
    const extra = (Array.isArray(found.fields) ? found.fields : [])
      .filter((x) => x && str(x.label) && !empty.fields.some((f) => f.label === x.label) && str(x.value))
      .map((x) => ({ label: str(x.label), value: str(x.value) }));
    return {
      key: empty.key,
      summary: str(found.summary),
      fields: [...fields, ...extra],
      quotes: (Array.isArray(found.quotes) ? found.quotes : []).map(str).filter(Boolean),
      codes: (Array.isArray(found.codes) ? found.codes : []).map(str).filter(Boolean),
    };
  });
  const scales = base.scales.map((empty) => {
    const found = Array.isArray(raw.scales) ? raw.scales.find((s) => s?.key === empty.key) : undefined;
    const n = typeof found?.score === "number" ? found.score : null;
    return { key: empty.key, score: n != null && n >= 0 && n <= 10 ? Math.round(n * 10) / 10 : null };
  });
  const goals = (Array.isArray(raw.goals) ? raw.goals : [])
    .map((g) => ({ goal: str(g?.goal), value: str(g?.value), importance: typeof g?.importance === "number" && g.importance >= 0 && g.importance <= 10 ? g.importance : null }))
    .filter((g) => g.goal)
    .slice(0, 3);
  const flagKinds = FLAG_KINDS.map((k) => k.key as string);
  const flags = (Array.isArray(raw.flags) ? raw.flags : [])
    .map((f) => ({ kind: (flagKinds.includes(f?.kind as string) ? f.kind : "note") as ContextFlag["kind"], text: str(f?.text) }))
    .filter((f) => f.text);
  const r = raw.referral ?? base.referral;
  return {
    sections,
    scales,
    goals,
    flags,
    anchor_statement: str(raw.anchor_statement),
    top_priority: str(raw.top_priority),
    first_action: str(raw.first_action),
    referral: {
      presenting_complaint: str(r?.presenting_complaint),
      date_of_onset: str(r?.date_of_onset),
      mechanism_of_injury: str(r?.mechanism_of_injury),
      referred_via: str(r?.referred_via),
      referral_goals_history: str(r?.referral_goals_history),
    },
  };
}

export function scaleMarkerKey(scaleKey: string): string {
  return `context.${scaleKey}`;
}
