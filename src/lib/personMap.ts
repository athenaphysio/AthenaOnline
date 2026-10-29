// The shape of Client profile: the person at the centre, with three arms
// around them. Safe to use in the browser and on the server.

export const PERSON_ARMS = [
  {
    key: "physiology",
    label: "Physiology",
    source: "Health passport",
    detail: "Randox bloods, Firstbeat HRV, sleep and gut",
    domains: ["heart_recovery", "sleep_energy", "blood", "gut"],
  },
  {
    key: "psychology",
    label: "Psychology",
    source: "Psychometrics",
    detail: "Professor Lee Smith's psychometric profile",
    domains: ["mind_behaviour"],
  },
  {
    key: "physicality",
    label: "Physicality",
    source: "Physical capacity",
    detail: "Movement screen, performance scores and physiotherapy notes",
    domains: ["body_movement"],
  },
] as const;

export type ArmKey = (typeof PERSON_ARMS)[number]["key"];
export type BackgroundPart = "person" | ArmKey;

export const PHYSICAL_SECTIONS = [
  { key: "movement_screen", label: "Movement screen", hint: "What the movement screen showed, test by test." },
  { key: "performance", label: "Performance scores", hint: "Strength, power, endurance and capacity results, with the numbers." },
  { key: "physio_notes", label: "Physiotherapy notes", hint: "Your clinical reading of how this client moves." },
] as const;

export type PhysicalSection = (typeof PHYSICAL_SECTIONS)[number]["key"];
