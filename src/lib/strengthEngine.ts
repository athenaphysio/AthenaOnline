// The strength engine. Builds each client's strength sessions exercise by
// exercise from David's own exercise library, to fit the client's minutes,
// kit, experience, injury history and sport, and writes a week by week
// progression into every exercise (a lighter fourth week, then heavier
// cycles). Pure rules, no AI and no database: the same profile, library and
// plan always give the same sessions, and every choice has a reason David can
// read. Day placement still follows strengthBuilder.ts, so strength sits with
// the hard cardio days and away from the day before a long session.

import { regionsWanted, type OtherCard, type PlanSlot, type Region } from "@/lib/strengthBuilder";
import { DAY_NAMES, type FocusArea, type Kit, type StrengthProfile } from "@/lib/strengthProfile";

// ---------------------------------------------------------------------------
// The library, as the engine sees it

export type EngineExercise = {
  exercise_id: string;
  name: string;
  movement_pattern: string | null;
  equipment: string | null;
  difficulty: string | null;
  rehab_stage: string | null;
  body_site: string | null;
  condition_use_case: string | null;
  contraindication_flags: string | null;
  progression: string | null;
  cues_notes: string | null;
  has_video: boolean;
};

export type PrepBlock = {
  name: string;
  items: { exercise_id: string; sets: number | null; reps: number | null; hold_seconds: number | null; prescription_mode: string; rationale: string | null }[];
};

// ---------------------------------------------------------------------------
// What the engine produces

export type WeekRow = {
  week: number;
  exercise_id: string;
  sets: number;
  reps: number | null;
  hold_seconds: number | null;
  prescription_mode: "reps_and_sets" | "time_under_load";
  rationale: string;
};

export type BuiltItem = { rows: WeekRow[] };

export type BuiltBlock = {
  name: string;
  slot: "activation" | "main_body" | "injury_prevention";
  sequence: "straight_sets" | "superset";
  items: BuiltItem[];
};

export type BuiltSession = {
  key: string;
  name: string;
  region: Region;
  high_load: boolean;
  minutes: number;
  targetMinutes: number;
  blocks: BuiltBlock[];
  /** One line per exercise, for David. */
  reasons: string[];
};

/** day null: the client does it on any day of that week. */
export type EnginePlacement = { slotKey: string | null; week: number; day: number | null; sessionKey: string };

export type EngineResult = {
  sessions: BuiltSession[];
  placements: EnginePlacement[];
  notes: string[];
};

// ---------------------------------------------------------------------------
// Settings Dr David Silver PhD may want to tune, gathered in one place.

export const ENGINE_RULES = {
  /** Used when the client gave no minutes for strength or for the day. */
  defaultMinutes: 45,
  /** Rough minutes per set, including rest, used to fit a session to the time. */
  minutesPerHeavySet: 3,
  minutesPerPairedRound: 3.5,
  minutesPerSupportSet: 1.5,
  minutesForPrep: 6,
  /** Every fourth week is lighter: one set less, effort around 6 out of 10. */
  lighterEvery: 4,
  lighterEffort: 6,
  maxEffort: 8,
};

const LIGHT = "Lighter week, keep it smooth.";
const EFFORT_MEANING =
  "Effort out of 10 means how hard the last rep felt: 10 is a rep you could not repeat, 8 leaves about two in the tank.";

// ---------------------------------------------------------------------------
// Kit

const KIT_ALIASES: [RegExp, Kit[]][] = [
  [/barbell|bar\b|rack|olympic/i, ["barbell"]],
  [/dumbbell/i, ["dumbbell"]],
  [/kettlebell/i, ["kettlebell"]],
  [/cable/i, ["cable"]],
  [/machine|leg press|leg extension|smith/i, ["machine"]],
  [/bench/i, ["bench"]],
  [/pull ?up|chin ?up/i, ["pullup"]],
  [/band/i, ["band"]],
  [/step|box|stair|plate/i, ["step"]],
  [/\bload\b|weight/i, ["dumbbell", "kettlebell", "barbell"]],
  [/none|mat|floor|wall|chair|doorway|pad\b|towel/i, ["none"]],
];

/**
 * Whether the client's kit covers an exercise's equipment. "Bench + barbell"
 * needs both; "Dumbbell / kettlebell" needs either; "(optional)" needs
 * nothing. Equipment the engine does not recognise (a sled, a hill, a
 * suspension trainer) is only assumed in a full gym.
 */
export function kitCovers(equipment: string | null, kit: Kit[]): boolean {
  const have = new Set<Kit>(kit.includes("gym") ? ["barbell", "dumbbell", "kettlebell", "cable", "machine", "bench", "pullup", "band", "step", "none"] : [...kit, "none"]);
  if (!equipment || !equipment.trim() || equipment.trim() === "-") return true;
  const groups = equipment.split("+").map((g) => g.trim()).filter((g) => g && !/optional/i.test(g));
  return groups.every((group) => {
    const options = group.split(/\/|\bor\b|,/i).map((o) => o.trim()).filter(Boolean);
    return options.some((option) => {
      const matched = KIT_ALIASES.filter(([re]) => re.test(option));
      if (matched.length === 0) return kit.includes("gym");
      return matched.some(([, kits]) => kits.some((k) => have.has(k)));
    });
  });
}

// ---------------------------------------------------------------------------
// What each place in a session is for

type Role =
  | "squat"
  | "squat_alt"
  | "hinge"
  | "hinge_heavy"
  | "lunge"
  | "knee"
  | "calf"
  | "groin"
  | "push_h"
  | "push_v"
  | "pull_h"
  | "pull_v"
  | "row_rotate"
  | "rotation"
  | "anti_rotation"
  | "carry"
  | "side_trunk"
  | "trunk";

type Kind = "heavy" | "main" | "support";

const BALLISTIC = /\b(jumps?|hops?|bounds?|bounded|plyo\w*|throws?|throwing|sprints?|landing|runs?|running|skips?|catch)\b/i;

const ROLE_FITS: Record<Role, (e: EngineExercise) => boolean> = {
  squat: (e) => /squat|leg press/i.test(e.name) && !/split|bulgarian|spanish|horse|sumo|step|drop/i.test(e.name),
  squat_alt: (e) => /goblet|leg press|front squat|squat/i.test(e.name) && !/split|bulgarian|spanish|horse|sumo|back squat|step|drop/i.test(e.name),
  hinge: (e) => /romanian|rdl|single leg .*deadlift|hip thrust|bridge|good morning/i.test(e.name) && !/isometric|floor bridge|plank|side bridge/i.test(e.name),
  hinge_heavy: (e) => /deadlift|hip thrust/i.test(e.name) && !/single leg|suitcase/i.test(e.name),
  lunge: (e) => /split squat|lunge|step-?up/i.test(e.name) && !/rotation|overhead|jump|curtsy|clock/i.test(e.name),
  knee: (e) => /spanish|leg extension|reverse nordic|step down/i.test(e.name) || /knee/i.test(e.condition_use_case ?? ""),
  calf: (e) => /calf raise/i.test(e.name) && !/hip thrust|bridge/i.test(e.name),
  groin: (e) => /copenhagen|adductor/i.test(e.name),
  push_h: (e) => /bench press|push-?up|floor press|chest press|dumbbell press/i.test(e.name) && !/neck|bird dog/i.test(e.name),
  push_v: (e) => /overhead press|push press|shoulder press|landmine press/i.test(e.name),
  pull_h: (e) => /\brow\b|rows\b/i.test(e.name) && !/rotation|rowing machine|interval/i.test(e.name),
  pull_v: (e) => /pulldown|pull-?up|chin/i.test(e.name),
  row_rotate: (e) => /row with rotation|pull and rotate/i.test(e.name),
  rotation: (e) => /woodchop|chop/i.test(e.name) && !/neck|head fixed/i.test(e.name),
  anti_rotation: (e) => /pallof/i.test(e.name),
  carry: (e) => /carry/i.test(e.name),
  side_trunk: (e) => /side (bridge|plank)|suitcase carry/i.test(e.name),
  trunk: (e) => /plank|pallof|dead ?bug|bird dog/i.test(e.name),
};

/** Within a role, the classic first choice, when the client's kit allows it. */
const ROLE_PREFER: Partial<Record<Role, RegExp>> = {
  hinge: /romanian|rdl/i,
  push_h: /bench press/i,
  pull_v: /lat pulldown|pull-?up/i,
  pull_h: /seated row|bent over row/i,
  rotation: /cable/i,
  carry: /farmer/i,
  calf: /^single leg calf raise/i,
};

const IS_HOLD = (e: EngineExercise) => /plank|carry|hold|isometric|spanish|bridge plank|wall sit/i.test(e.name);
const IS_UNILATERAL = (e: EngineExercise) => /single|split|bulgarian|one arm|lunge|step-?up|suitcase|copenhagen|pallof|woodchop|side (bridge|plank)/i.test(e.name);

type Spec = { role: Role; kind: Kind };
type BlockSpec = { name: string; slot: BuiltBlock["slot"]; sequence: BuiltBlock["sequence"]; specs: Spec[] };
type SessionSpec = { name: string; blocks: BlockSpec[] };

function supportFor(region: Region, profile: StrengthProfile, variant: number): Spec[] {
  const sport = (s: string[]) => s.some((x) => profile.sports.includes(x));
  const out: Spec[] = [];
  if (region !== "upper") {
    if (profile.focus.includes("knee")) out.push({ role: "knee", kind: "support" });
    if (sport(["running", "triathlon", "football", "rugby", "netball", "hockey", "tennis"]) || profile.focus.includes("ankle")) out.push({ role: "calf", kind: "support" });
    if (sport(["football", "rugby", "hockey", "netball"]) || profile.focus.includes("hip")) out.push({ role: "groin", kind: "support" });
    if (out.length < 2) out.push({ role: "trunk", kind: "support" });
  } else if (variant % 2 === 0) {
    out.push({ role: "anti_rotation", kind: "support" }, { role: "carry", kind: "support" });
  } else {
    out.push({ role: "side_trunk", kind: "support" }, { role: "trunk", kind: "support" });
  }
  return out.slice(0, 3);
}

function sessionSpec(region: Region, variant: number, profile: StrengthProfile): SessionSpec {
  const support = supportFor(region, profile, variant);
  if (region === "lower") {
    return variant % 2 === 0
      ? {
          name: "Lower Strength: Squat and Hinge",
          blocks: [
            { name: "Main Lift", slot: "main_body", sequence: "straight_sets", specs: [{ role: "squat", kind: "heavy" }] },
            { name: "Hinge and Single Leg", slot: "main_body", sequence: "superset", specs: [{ role: "hinge", kind: "main" }, { role: "lunge", kind: "main" }] },
            { name: "Support", slot: "injury_prevention", sequence: "straight_sets", specs: support },
          ],
        }
      : {
          name: "Lower Strength: Hinge and Single Leg",
          blocks: [
            { name: "Main Lift", slot: "main_body", sequence: "straight_sets", specs: [{ role: "hinge_heavy", kind: "heavy" }] },
            { name: "Squat and Single Leg", slot: "main_body", sequence: "superset", specs: [{ role: "squat_alt", kind: "main" }, { role: "lunge", kind: "main" }] },
            { name: "Support", slot: "injury_prevention", sequence: "straight_sets", specs: support },
          ],
        };
  }
  if (region === "upper") {
    return variant % 2 === 0
      ? {
          name: "Upper Strength: Press and Pull",
          blocks: [
            { name: "Heavy Pair", slot: "main_body", sequence: "superset", specs: [{ role: "push_h", kind: "heavy" }, { role: "pull_v", kind: "heavy" }] },
            { name: "Second Pair", slot: "main_body", sequence: "superset", specs: [{ role: "push_v", kind: "main" }, { role: "pull_h", kind: "main" }] },
            { name: "Trunk", slot: "injury_prevention", sequence: "straight_sets", specs: support },
          ],
        }
      : {
          name: "Upper Strength: Rotation and Trunk",
          blocks: [
            { name: "Row and Push", slot: "main_body", sequence: "superset", specs: [{ role: "row_rotate", kind: "main" }, { role: "push_h", kind: "main" }] },
            { name: "Rotation and Pull", slot: "main_body", sequence: "superset", specs: [{ role: "rotation", kind: "main" }, { role: "pull_v", kind: "main" }] },
            { name: "Trunk", slot: "injury_prevention", sequence: "straight_sets", specs: support },
          ],
        };
  }
  return variant % 2 === 0
    ? {
        name: "Full Body Strength A",
        blocks: [
          { name: "Squat and Pull", slot: "main_body", sequence: "superset", specs: [{ role: "squat", kind: "heavy" }, { role: "pull_h", kind: "heavy" }] },
          { name: "Hinge and Press", slot: "main_body", sequence: "superset", specs: [{ role: "hinge", kind: "main" }, { role: "push_h", kind: "main" }] },
          { name: "Support", slot: "injury_prevention", sequence: "straight_sets", specs: [...support.slice(0, 2), { role: "lunge", kind: "support" }] },
        ],
      }
    : {
        name: "Full Body Strength B",
        blocks: [
          { name: "Hinge and Pull", slot: "main_body", sequence: "superset", specs: [{ role: "hinge_heavy", kind: "heavy" }, { role: "pull_v", kind: "heavy" }] },
          { name: "Single Leg and Press", slot: "main_body", sequence: "superset", specs: [{ role: "lunge", kind: "main" }, { role: "push_v", kind: "main" }] },
          { name: "Support", slot: "injury_prevention", sequence: "straight_sets", specs: [...support.slice(0, 2), { role: "carry", kind: "support" }] },
        ],
      };
}

// ---------------------------------------------------------------------------
// Choosing an exercise

const FOCUS_USE: Record<FocusArea, RegExp> = {
  knee: /knee/i,
  back: /back|lumbar/i,
  shoulder: /shoulder/i,
  ankle: /ankle|calf|achilles/i,
  hip: /hip|groin|adductor/i,
  neck: /neck/i,
  concussion: /concussion/i,
};

function avoidWords(avoid: string | null): string[] {
  if (!avoid) return [];
  // Only the "avoid" half of a "likes and avoids" answer.
  const part = avoid.split(/\b(?:avoid|can'?t|cannot|not do|prefer not|hate|dislike)\b/i).slice(1).join(" ") || "";
  return part
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3 && !["anything", "exercises", "exercise", "really", "would", "rather", "because", "with", "that", "them", "they", "please", "doing", "those", "these"].includes(w))
    // "lunges" should catch "Step Lunge", "squats" should catch "Goblet Squat".
    .map((w) => w.replace(/(es|s)$/, (m) => (w.length > 5 ? "" : m)));
}

function candidates(library: EngineExercise[], spec: Spec, profile: StrengthProfile): EngineExercise[] {
  const avoid = avoidWords(profile.avoid);
  return library.filter((e) => {
    if (!ROLE_FITS[spec.role](e)) return false;
    if (spec.kind !== "support" && BALLISTIC.test(e.name)) return false;
    if (!kitCovers(e.equipment, profile.kit.length ? profile.kit : ["none"])) return false;
    if (profile.experience === "new" && /advanced/i.test(e.difficulty ?? "")) return false;
    const flags = (e.contraindication_flags ?? "").toLowerCase();
    if (flags && profile.focus.some((f) => FOCUS_USE[f].test(flags))) return false;
    const name = e.name.toLowerCase();
    if (avoid.some((w) => name.includes(w))) return false;
    return true;
  });
}

function score(e: EngineExercise, spec: Spec, profile: StrengthProfile, used: Set<string>): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;
  const kitText = profile.kit.includes("gym") ? "the gym" : "their kit";
  if (spec.kind === "heavy" && /barbell/i.test(e.equipment ?? "") && profile.experience !== "new") {
    s += 3;
    reasons.push("a barbell lift for an experienced lifter");
  }
  if (e.has_video) s += 2;
  // Experienced lifters in a gym get loaded lifts rather than bodyweight drills in the main work.
  const loaded = /barbell|dumbbell|kettlebell|cable|machine|load/i.test(e.equipment ?? "");
  if (spec.kind !== "support" && profile.experience !== "new" && profile.kit.some((k) => k !== "none" && k !== "band")) {
    if (loaded) {
      s += 3;
      if (!reasons.length) reasons.push("a loaded lift that suits their experience");
    } else s -= 2;
  }
  const diff = (e.difficulty ?? "").toLowerCase();
  if (profile.experience === "experienced" && /intermediate|advanced/.test(diff)) s += 1;
  if (profile.experience === "new" && /beginner/.test(diff)) {
    s += 2;
    reasons.push("a beginner friendly choice");
  }
  const stage = (e.rehab_stage ?? "").toLowerCase();
  if (profile.currentInjury ? /early|mid/.test(stage) : /late|performance/.test(stage)) s += 1;
  for (const f of profile.focus) {
    if (FOCUS_USE[f].test(e.condition_use_case ?? "") || FOCUS_USE[f].test(e.body_site ?? "")) {
      s += 3;
      reasons.push(`covers the ${f} history in their notes`);
      break;
    }
  }
  if (ROLE_PREFER[spec.role]?.test(e.name)) s += 2;
  if (profile.experience === "experienced" && /beginner/.test(diff) && spec.kind === "support") s -= 1;
  if (used.has(e.exercise_id)) s -= 8;
  reasons.push(`works with ${kitText}`);
  return { score: s, reasons };
}

function pick(library: EngineExercise[], spec: Spec, profile: StrengthProfile, used: Set<string>): { e: EngineExercise; reasons: string[] } | null {
  const ranked = candidates(library, spec, profile)
    .map((e) => ({ e, ...score(e, spec, profile, used) }))
    .sort((a, b) => b.score - a.score || a.e.exercise_id.localeCompare(b.e.exercise_id));
  return ranked[0] ? { e: ranked[0].e, reasons: ranked[0].reasons } : null;
}

// ---------------------------------------------------------------------------
// Dose and week by week progression

type Dose = { sets: number; reps: number | null; hold: number | null; effort: number };

function baseDose(e: EngineExercise, kind: Kind, profile: StrengthProfile): Dose {
  const exp = profile.experience ?? "some";
  if (IS_HOLD(e)) {
    const hold = /carry/i.test(e.name) ? 40 : /spanish|isometric/i.test(e.name) ? 45 : 30;
    return { sets: exp === "new" ? 2 : 3, reps: null, hold, effort: 7 };
  }
  if (kind === "heavy") {
    if (exp === "experienced") return { sets: 4, reps: 6, hold: null, effort: 7 };
    if (exp === "some") return { sets: 3, reps: 8, hold: null, effort: 7 };
    return { sets: 3, reps: 10, hold: null, effort: 6 };
  }
  if (kind === "main") {
    // Bodyweight work needs more reps to reach the same effort.
    if (!/barbell|dumbbell|kettlebell|cable|machine|load/i.test(e.equipment ?? "")) return { sets: exp === "new" ? 2 : 3, reps: exp === "new" ? 10 : 12, hold: null, effort: exp === "new" ? 6 : 7 };
    if (exp === "experienced") return { sets: 3, reps: 8, hold: null, effort: 7 };
    if (exp === "some") return { sets: 3, reps: 10, hold: null, effort: 7 };
    return { sets: 2, reps: 10, hold: null, effort: 6 };
  }
  return { sets: exp === "new" ? 2 : 3, reps: /calf/i.test(e.name) ? 12 : 10, hold: null, effort: 7 };
}

/** The dose for one week. Holds the jump in sets in a week marked as a big cardio week. */
function doseFor(base: Dose, kind: Kind, week: number, holdWeek: boolean, profile: StrengthProfile): Dose & { lighter: boolean } {
  const every = ENGINE_RULES.lighterEvery;
  const p = ((week - 1) % every) + 1;
  const cycle = Math.floor((week - 1) / every);
  const cap = profile.experience === "new" ? 7 : ENGINE_RULES.maxEffort;
  let { sets, reps, hold } = base;
  // Each new cycle is a little heavier: fewer reps on heavy lifts, more on support work, longer holds.
  if (cycle > 0) {
    if (reps != null) reps = kind === "support" ? reps + 2 * cycle : Math.max(kind === "heavy" ? 3 : 5, reps - cycle);
    if (hold != null) hold = hold + 10 * cycle;
  }
  if (p === every) return { sets: Math.max(Math.min(2, sets), sets - 1), reps, hold, effort: ENGINE_RULES.lighterEffort, lighter: true };
  let effort = Math.min(cap, base.effort + (p >= 2 ? 1 : 0));
  if (p === 3 && !holdWeek) {
    sets += 1;
    effort = Math.min(cap, 8);
  }
  return { sets, reps, hold, effort, lighter: false };
}

// ---------------------------------------------------------------------------
// The reason every exercise carries, in client language

function sportPhrase(profile: StrengthProfile): string {
  const map: Record<string, string> = {
    running: "running",
    triathlon: "swimming, cycling, running",
    cycling: "cycling",
    swimming: "swimming",
    rowing: "rowing",
    football: "football",
    rugby: "rugby",
    netball: "netball",
    hockey: "hockey",
    tennis: "racket sport",
  };
  const words = Array.from(new Set(profile.sports.flatMap((s) => (map[s] ?? "").split(/, | and /)).filter(Boolean)));
  if (words.length === 0) return "";
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function whyFor(role: Role, profile: StrengthProfile): string {
  const sport = sportPhrase(profile);
  const back = profile.focus.includes("back");
  switch (role) {
    case "squat":
    case "squat_alt":
      return sport ? `Builds leg strength behind your ${sport}.` : "Builds the leg strength everything else rests on.";
    case "hinge":
      return "Strengthens the hamstrings and back of the hips through a controlled hinge.";
    case "hinge_heavy":
      return "Your main posterior chain lift, building strength through the hips and hamstrings.";
    case "lunge":
      return sport ? `Builds single leg strength and control for ${sport}.` : "Builds single leg strength and control.";
    case "knee":
      return "Loads the knee and its tendon steadily, so it tolerates more of your training.";
    case "calf":
      return "Builds calf and Achilles capacity for running and changing direction.";
    case "groin":
      return "Strengthens the groin for kicking, cutting and changing direction.";
    case "push_h":
      return "Builds pressing strength through the chest, shoulders and arms.";
    case "push_v":
      return "Builds strong, steady shoulders overhead.";
    case "pull_h":
      return "Strengthens the upper back and shoulder blades.";
    case "pull_v":
      return profile.sports.some((s) => ["swimming", "triathlon", "rowing"].includes(s))
        ? "Builds the pulling strength your stroke relies on."
        : "Builds pulling strength through the back and arms.";
    case "row_rotate":
      return "Builds pulling strength while your trunk controls the rotation.";
    case "rotation":
      return "Trains rotation through the hips and trunk.";
    case "anti_rotation":
      return back ? "Trains your trunk to resist twisting, which supports your back." : "Trains your trunk to resist twisting.";
    case "carry":
      return "Builds grip and whole body stiffness that carries into every sport.";
    case "side_trunk":
      return back ? "Builds endurance in the side of your trunk, which supports your back." : "Builds endurance in the side of your trunk.";
    case "trunk":
      return back ? "Builds trunk endurance, which supports your back." : "Builds trunk endurance.";
  }
}

function firstSentence(text: string | null): string {
  if (!text) return "";
  const s = text.split(/(?<=[.!])\s+/)[0]?.trim() ?? "";
  if (!s || s.length > 140) return "";
  return /[.!]$/.test(s) ? s : `${s}.`;
}

function rationale(
  e: EngineExercise,
  role: Role,
  kind: Kind,
  dose: Dose & { lighter: boolean },
  profile: StrengthProfile,
  explainEffort: boolean,
  paired: boolean
): string {
  const parts: string[] = [];
  if (dose.lighter) parts.push(LIGHT);
  parts.push(whyFor(role, profile));
  const cue = firstSentence(e.cues_notes);
  if (cue) parts.push(cue);
  if (IS_UNILATERAL(e) && !/each/i.test(cue)) parts.push(dose.hold ? "Seconds per side." : "Each side.");
  else if (dose.hold) parts.push("Seconds per hold.");
  if (paired) parts.push("Rest about 90 seconds after each exercise of the pair.");
  else if (kind === "heavy") parts.push("Rest 2 to 3 minutes.");
  if (kind === "heavy" && profile.experience === "experienced") parts.push("Not to failure in this block.");
  if (role === "knee" || (profile.focus.includes("knee") && ["squat", "squat_alt", "lunge"].includes(role))) parts.push("Keep knee pain at 3 out of 10 or less.");
  if (!dose.hold) parts.push(`Effort ${dose.effort} out of 10.`);
  if (explainEffort) parts.push(EFFORT_MEANING);
  return parts.join(" ");
}

/** A progression the library links by EX number, if the client's kit covers it. */
function steppedUp(e: EngineExercise, byId: Map<string, EngineExercise>, profile: StrengthProfile): EngineExercise {
  const m = (e.progression ?? "").match(/EX-\d{3}/);
  const next = m ? byId.get(m[0]) : undefined;
  return next && kitCovers(next.equipment, profile.kit.length ? profile.kit : ["none"]) ? next : e;
}

// ---------------------------------------------------------------------------
// Fitting a session to the time

function estimate(blocks: BuiltBlock[], peakWeek: number, prep: boolean): number {
  let m = 0;
  for (const b of blocks) {
    if (b.slot === "activation") {
      if (prep) m += Math.min(ENGINE_RULES.minutesForPrep, b.items.length * 1.5);
      continue;
    }
    const sets = b.items.map((i) => i.rows.find((r) => r.week === peakWeek)?.sets ?? i.rows[0].sets);
    if (b.sequence === "superset") m += Math.max(...sets) * ENGINE_RULES.minutesPerPairedRound;
    else if (b.slot === "main_body") m += sets.reduce((a, s) => a + s, 0) * ENGINE_RULES.minutesPerHeavySet;
    else m += sets.reduce((a, s) => a + s, 0) * ENGINE_RULES.minutesPerSupportSet;
  }
  return Math.round(m);
}

/** One set less in every week, keeping the week by week pattern, while week 1 stays at or above min. */
function trimOneSet(block: BuiltBlock, min: number): boolean {
  let changed = false;
  for (const item of block.items) {
    if ((item.rows[0]?.sets ?? 0) <= min) continue;
    // Never below two sets, so even the lighter week is worth doing.
    for (const r of item.rows) if (r.sets > 2 || (r.sets === 2 && min < 2)) r.sets -= 1;
    changed = true;
  }
  return changed;
}

/** Shortens a session until it fits, in the order that loses the least, and says what it did. */
function fitToTime(blocks: BuiltBlock[], target: number, peakWeek: number, prep: boolean): { blocks: BuiltBlock[]; notes: string[] } {
  const notes: string[] = [];
  let bs = blocks.map((b) => ({ ...b, items: b.items.map((i) => ({ rows: i.rows.map((r) => ({ ...r })) })) }));
  const support = () => bs.find((b) => b.slot === "injury_prevention");
  const mains = () => bs.filter((b) => b.slot === "main_body");
  const steps: (() => string | null)[] = [
    () => {
      const s = support();
      if (s && s.items.length > 2) {
        s.items.pop();
        return "dropped the third support exercise";
      }
      return null;
    },
    () => {
      const second = mains()[1];
      return second && trimOneSet(second, 2) ? "took a set off the second pair" : null;
    },
    () => {
      const s = support();
      return s && trimOneSet(s, 2) ? "took a set off the support work" : null;
    },
    () => {
      const first = mains()[0];
      return first && trimOneSet(first, 3) ? "took a set off the main lift" : null;
    },
    () => {
      const warm = bs.find((b) => b.slot === "activation");
      if (warm && warm.items.length > 2) {
        warm.items = warm.items.slice(0, 2);
        return "kept two warm up exercises";
      }
      return null;
    },
    () => {
      const s = support();
      if (s && s.items.length > 1) {
        s.items.pop();
        return "kept one support exercise";
      }
      return null;
    },
    () => {
      const first = mains()[0];
      return first && trimOneSet(first, 2) ? "took another set off the main lift" : null;
    },
    () => {
      const second = mains()[1];
      return second && trimOneSet(second, 1) ? "took another set off the second pair" : null;
    },
    () => {
      const second = mains()[1];
      if (second) {
        bs = bs.filter((b) => b !== second);
        return "dropped the second pair";
      }
      return null;
    },
  ];
  for (const step of steps) {
    if (estimate(bs, peakWeek, prep) <= target) break;
    const did = step();
    if (did) notes.push(did);
  }
  return { blocks: bs, notes };
}

// ---------------------------------------------------------------------------
// Building

function cardioMinutes(c: OtherCard & { total?: string }): number {
  const t = `${c.title} ${c.summary} ${c.total ?? ""}`.toLowerCase();
  const h = t.match(/(\d+(?:\.\d+)?)\s*hours?/);
  const m = t.match(/(\d+)\s*min/);
  if (h) return Math.round(Number(h[1]) * 60);
  if (m) return Number(m[1]);
  return 0;
}

const HARD = /tempo|interval|threshold|quality|reps?\b|hills?|speed|fartlek|race|test|vo2|sprint|football|rugby|match|game|long/i;

/** Weeks with the most hard or long cardio, where the strength sets are held rather than raised. */
function bigCardioWeeks(others: OtherCard[], weeks: number): Set<number> {
  const counts = Array.from({ length: weeks }, (_, i) => others.filter((o) => o.week === i + 1 && HARD.test(`${o.title} ${o.summary}`)).length);
  const max = Math.max(0, ...counts);
  const min = Math.min(...counts);
  if (max === min) return new Set();
  return new Set(counts.map((c, i) => (c === max ? i + 1 : 0)).filter(Boolean));
}

export type EngineInput = {
  profile: StrengthProfile;
  library: EngineExercise[];
  prep: { upper: PrepBlock | null; lower: PrepBlock | null };
  slots: PlanSlot[];
  others: (OtherCard & { total?: string })[];
  weeks: number;
};

export function buildStrengthSessions(input: EngineInput): EngineResult {
  const { profile, library, prep, slots, others, weeks } = input;
  const notes: string[] = [];
  const byId = new Map(library.map((e) => [e.exercise_id, e]));

  // Which sessions, and which days: the same rules as before for placement.
  const brief = { ...profile, setting: null as null };
  const perWeekSlots = new Map<number, PlanSlot[]>();
  for (const s of slots) perWeekSlots.set(s.week, [...(perWeekSlots.get(s.week) ?? []), s]);
  let firstWeekSlots = perWeekSlots.get(1) ?? [];
  // Days the client chose, when the plan has no strength slots of its own.
  if (firstWeekSlots.length === 0 && profile.days.length > 0) {
    for (let w = 1; w <= weeks; w++) perWeekSlots.set(w, profile.days.map((day) => ({ key: "", week: w, day })));
    firstWeekSlots = perWeekSlots.get(1) ?? [];
  }
  let wanted = regionsWanted(
    {
      discussed: profile.discussed,
      evidence: profile.evidence,
      upper: profile.upper,
      lower: profile.lower,
      full: profile.full,
      total: profile.total,
      experience: profile.experience,
      setting: brief.setting,
      focus: profile.focus,
      sports: profile.sports,
    },
    firstWeekSlots.length
  );
  if (profile.split === "full" && profile.upper + profile.lower === 0) wanted = wanted.map(() => "full");
  if (wanted.length === 0) return { sessions: [], placements: [], notes: ["No strength days were given and the plan has no strength slots."] };

  const holdWeeks = bigCardioWeeks(others, weeks);
  if (holdWeeks.size > 0) notes.push(`Week ${Array.from(holdWeeks).join(" and ")} has the most hard cardio, so strength sets are held there rather than raised.`);

  // Which sessions: one per region and variant, in the client's own split.
  const variantCount: Record<Region, number> = { lower: 0, upper: 0, full: 0 };
  const sessionFor: { region: Region; key: string }[] = wanted.map((region) => ({ region, key: `${region}-${variantCount[region]++}` }));

  // Place them: lower body onto the hardest cardio days, the rest in day order.
  const placements: EnginePlacement[] = [];
  for (let week = 1; week <= weeks; week++) {
    const weekOthers = others.filter((o) => o.week === week);
    let weekSlots = [...(perWeekSlots.get(week) ?? [])];
    if (weekSlots.length < wanted.length) {
      const taken = weekSlots.map((s) => s.day);
      const free = [2, 4, 6, 1, 3, 5, 7].filter((d) => !taken.includes(d));
      const spaced = free.filter((d) => !taken.some((t) => Math.abs(t - d) === 1));
      const extra = [...spaced, ...free.filter((d) => !spaced.includes(d))].slice(0, wanted.length - weekSlots.length);
      weekSlots = [...weekSlots, ...extra.map((day) => ({ key: "", week, day }))];
      if (week === 1 && extra.length > 0 && !profile.anyDay) notes.push(`The plan had fewer strength days than asked for, so ${extra.map((d) => DAY_NAMES[d]).join(" and ")} were added. Move them if another day suits better.`);
    }
    const remaining = [...weekSlots].sort((a, b) => a.day - b.day);
    const lowerScore = (day: number) =>
      weekOthers.reduce((acc, c) => {
        const text = `${c.title} ${c.summary}`;
        let s = 0;
        if (c.day === day && HARD.test(text) && !/\blong\b/i.test(c.title)) s += c.type === "run" ? 10 : 5;
        const before = c.day === 1 ? 7 : c.day - 1;
        if (before === day && /\blong\b/i.test(c.title)) s -= 4;
        if (before === day && c.type === "run" && HARD.test(text)) s -= 3;
        return acc + s;
      }, 0);
    const order = sessionFor.map((s, i) => ({ ...s, i }));
    const assign: { slot: PlanSlot; key: string }[] = [];
    for (const s of order.filter((o) => o.region === "lower")) {
      remaining.sort((a, b) => lowerScore(b.day) - lowerScore(a.day) || a.day - b.day);
      const slot = remaining.shift();
      if (slot) assign.push({ slot, key: s.key });
    }
    remaining.sort((a, b) => a.day - b.day);
    for (const s of order.filter((o) => o.region !== "lower")) {
      const slot = remaining.shift();
      if (slot) assign.push({ slot, key: s.key });
    }
    for (const a of assign) placements.push({ slotKey: a.slot.key || null, week, day: a.slot.day, sessionKey: a.key });
  }

  // Build one session per region and variant.
  const used = new Set<string>();
  const sessions: BuiltSession[] = [];
  const peakWeek = Math.min(3, weeks);

  for (const { region, key } of sessionFor) {
    const variant = Number(key.split("-")[1]);

    const spec = sessionSpec(region, variant, profile);
    const reasons: string[] = [];
    let explained = false;
    const blocks: BuiltBlock[] = [];

    const prepBlock = region === "upper" ? prep.upper : region === "lower" ? prep.lower : prep.lower ?? prep.upper;
    if (prepBlock && prepBlock.items.length > 0) {
      blocks.push({
        name: `Prep: ${region === "upper" ? "Upper Body" : region === "lower" ? "Lower Body" : "Whole Body"}`,
        slot: "activation",
        sequence: "straight_sets",
        items: prepBlock.items.map((it) => ({
          rows: Array.from({ length: weeks }, (_, i) => ({
            week: i + 1,
            exercise_id: it.exercise_id,
            sets: it.sets ?? 1,
            reps: it.reps,
            hold_seconds: it.hold_seconds,
            prescription_mode: it.prescription_mode === "time_under_load" ? "time_under_load" : "reps_and_sets",
            rationale: it.rationale ?? "Part of your warm up.",
          })),
        })),
      });
    }

    for (const b of spec.blocks) {
      const items: BuiltItem[] = [];
      for (const s of b.specs) {
        // When nothing fits the first choice (a heavy hinge for someone avoiding deadlifts, say), fall back to a gentler version of the same pattern.
        const FALLBACK: Partial<Record<Role, Role>> = { hinge_heavy: "hinge", squat: "squat_alt", push_v: "push_h", pull_v: "pull_h", row_rotate: "pull_h", rotation: "anti_rotation", groin: "trunk", knee: "lunge" };
        const chosen = pick(library, s, profile, used) ?? (FALLBACK[s.role] ? pick(library, { ...s, role: FALLBACK[s.role] as Role }, profile, used) : null);
        if (!chosen) {
          notes.push(`Nothing in your library fitted the ${s.role.replace("_", " ")} place in ${spec.name} with this client's kit, so it is left out.`);
          continue;
        }
        used.add(chosen.e.exercise_id);
        const base = baseDose(chosen.e, s.kind, profile);
        const later = steppedUp(chosen.e, byId, profile);
        const rows: WeekRow[] = [];
        for (let w = 1; w <= weeks; w++) {
          const e = w > ENGINE_RULES.lighterEvery ? later : chosen.e;
          const d = doseFor(base, s.kind, w, holdWeeks.has(w), profile);
          const explain = !explained && s.kind !== "support" && w === 1;
          rows.push({
            week: w,
            exercise_id: e.exercise_id,
            sets: d.sets,
            reps: d.hold != null ? null : d.reps,
            hold_seconds: d.hold,
            prescription_mode: d.hold != null ? "time_under_load" : "reps_and_sets",
            rationale: rationale(e, s.role, s.kind, d, profile, explain, b.sequence === "superset" && b.specs.length > 1),
          });
        }
        if (!explained && s.kind !== "support") explained = true;
        items.push({ rows });
        reasons.push(`${chosen.e.name}${later !== chosen.e ? ` (steps up to ${later.name} after week ${ENGINE_RULES.lighterEvery})` : ""}: ${chosen.reasons.join(", ")}.`);
      }
      if (items.length > 0) blocks.push({ name: b.name, slot: b.slot, sequence: items.length > 1 ? b.sequence : "straight_sets", items });
    }

    // Time available: minutes per strength session, else what is left of the day after its cardio.
    const firstDaySlot = placements.find((p) => p.week === 1 && p.sessionKey === key);
    let target = profile.minutesPerSession ?? null;
    let targetNote = "";
    if (target == null && firstDaySlot) {
      const day = firstDaySlot.day != null ? profile.dayMinutes[firstDaySlot.day] : null;
      if (day != null && day > 0) {
        const cardio = others.filter((o) => o.week === 1 && o.day === firstDaySlot.day).reduce((a, o) => a + cardioMinutes(o), 0);
        if (day - cardio >= 20) {
          target = day - cardio;
          targetNote = ` (what is left of ${DAY_NAMES[firstDaySlot.day ?? 0]}'s ${day} minutes after cardio)`;
        }
      }
    }
    if (target == null) {
      target = ENGINE_RULES.defaultMinutes;
      targetNote = " (assumed, as no minutes were given)";
    }
    const fitted = fitToTime(blocks, target, peakWeek, Boolean(prepBlock));
    const minutes = estimate(fitted.blocks, peakWeek, Boolean(prepBlock));
    if (fitted.notes.length > 0) reasons.push(`To fit ${target} minutes${targetNote}, it ${fitted.notes.join(", then ")}.`);
    else reasons.push(`About ${minutes} minutes at its fullest week, within ${target} minutes${targetNote}.`);

    sessions.push({
      key,
      name: spec.name,
      region,
      high_load: spec.blocks.some((b) => b.specs.some((s) => s.kind === "heavy")),
      minutes,
      targetMinutes: target,
      blocks: fitted.blocks,
      reasons,
    });
  }

  // The client chooses the days: every session goes under "any day this week".
  if (profile.anyDay) {
    for (const p of placements) p.day = null;
    notes.push(`The client chooses the days, so the ${wanted.length} strength session${wanted.length === 1 ? "" : "s"} each week sit under "Any day this week".`);
  }

  if (!profile.minutesPerSession && Object.values(profile.dayMinutes).every((m) => m == null)) {
    notes.push("No minutes were given for strength or for each day, so sessions are sized to about 45 minutes. Add minutes on the client record to resize.");
  }
  if (profile.kit.length === 0) notes.push("No equipment was given, so only bodyweight exercises were used. Add their kit on the client record.");

  return { sessions, placements, notes };
}
