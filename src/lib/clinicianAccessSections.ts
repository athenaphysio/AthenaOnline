// The sections of a client's record that can be switched on or off for
// each clinician. Shared by the clinic, the clinician area and the client's
// consent page, so the same words are used everywhere.

export const SECTIONS = [
  { key: "details", label: "Personal details", hint: "Email, date of birth, occupation, sport" },
  { key: "context", label: "Client context", hint: "The consultation summary and full background notes" },
  { key: "programme", label: "Programme and progress", hint: "What they are working on and how practice is going, and the client's app" },
  { key: "heart_recovery", label: "Heart and recovery", hint: "Passport: heart rate variability, cardiac screening" },
  { key: "sleep_energy", label: "Sleep and energy", hint: "Passport" },
  { key: "blood", label: "Blood biomarkers", hint: "Passport: blood panel results" },
  { key: "gut", label: "Gut health", hint: "Passport: microbiome" },
  { key: "body_movement", label: "Body and movement", hint: "Passport" },
  { key: "mind_behaviour", label: "Mind and behaviour", hint: "Passport: psychometrics" },
  { key: "physical", label: "Physical capacity notes", hint: "Movement screen, performance scores and physiotherapy notes" },
  { key: "write_notes", label: "Add care team notes", hint: "Can write notes in the sections they can see" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];
export const VIEW_SECTIONS = SECTIONS.filter((s) => s.key !== "write_notes").map((s) => s.key);
export const PASSPORT_SECTIONS = ["heart_recovery", "sleep_energy", "blood", "gut", "body_movement", "mind_behaviour"] as const;

export function sectionLabel(key: string): string {
  return SECTIONS.find((s) => s.key === key)?.label ?? key;
}
