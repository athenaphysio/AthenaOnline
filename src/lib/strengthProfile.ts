// One strength profile per client, read from their intake form and
// consultation notes, with anything Dr David Silver PhD has corrected on the
// client record taking priority. The strength engine (strengthEngine.ts)
// builds from this profile and nothing else, so what David sees on the
// record is exactly what the sessions are built to.
//
// Pure: no database, so the same notes always give the same profile.

export type FocusArea = "knee" | "back" | "shoulder" | "ankle" | "hip" | "neck" | "concussion";
export type Experience = "new" | "some" | "experienced";
export type Split = "full" | "upper_lower";

/** Kit the strength engine understands. "gym" stands for a full gym and covers everything else. */
export type Kit =
  | "gym"
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "cable"
  | "machine"
  | "bench"
  | "pullup"
  | "band"
  | "step"
  | "none";

export const KIT_LABEL: Record<Kit, string> = {
  gym: "Full gym",
  barbell: "Barbell and rack",
  dumbbell: "Dumbbells",
  kettlebell: "Kettlebells",
  cable: "Cable machine",
  machine: "Resistance machines",
  bench: "Bench",
  pullup: "Pull up bar",
  band: "Resistance bands",
  step: "Step or box",
  none: "Nothing, bodyweight only",
};

export const FOCUS_LABEL: Record<FocusArea, string> = {
  knee: "Knee",
  back: "Back",
  shoulder: "Shoulder",
  ankle: "Ankle, calf or Achilles",
  hip: "Hip or groin",
  neck: "Neck",
  concussion: "Concussion",
};

export const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_WORDS: [number, RegExp][] = [
  [1, /\bmon(day)?s?\b/i],
  [2, /\btue(s|sday)?s?\b/i],
  [3, /\bwed(nesday)?s?\b/i],
  [4, /\bthu(r|rs|rsday)?s?\b/i],
  [5, /\bfri(day)?s?\b/i],
  [6, /\bsat(urday)?s?\b/i],
  [7, /\bsun(day)?s?\b/i],
];

/** The fields David can correct on the client record. Anything left out comes from the notes. */
export type StrengthOverrides = {
  minutesPerSession?: number | null;
  days?: number[];
  /** The client chooses which days to do strength each week. */
  anyDay?: boolean;
  split?: Split | null;
  upper?: number;
  lower?: number;
  full?: number;
  kit?: Kit[];
  experience?: Experience | null;
  currentLifts?: string | null;
  goal?: string | null;
  avoid?: string | null;
  focus?: FocusArea[];
  updatedAt?: string;
};

export type StrengthProfile = {
  /** Strength came up somewhere in the client's notes or answers. */
  discussed: boolean;
  /** Short quotes showing where, for David to see why it built. */
  evidence: string[];
  minutesPerSession: number | null;
  /** Minutes the client said they could train on each day (1 Monday to 7 Sunday); null when not given as minutes. */
  dayMinutes: Record<number, number | null>;
  /** The days the client chose for strength. */
  days: number[];
  /** Strength sessions sit under "any day this week" for the client to choose when. */
  anyDay: boolean;
  upper: number;
  lower: number;
  full: number;
  /** Strength days asked for in total, or null if no number was given. */
  total: number | null;
  split: Split | null;
  kit: Kit[];
  experience: Experience | null;
  currentLifts: string | null;
  goal: string | null;
  avoid: string | null;
  focus: FocusArea[];
  sports: string[];
  currentInjury: boolean;
  /** Which fields David has corrected on the record. */
  corrected: (keyof StrengthOverrides)[];
};

const NUMBER_WORDS: Record<string, number> = { one: 1, once: 1, two: 2, twice: 2, three: 3, four: 4, five: 5, six: 6 };

function toNumber(word: string): number | null {
  const n = Number(word);
  if (Number.isInteger(n) && n > 0 && n < 8) return n;
  return NUMBER_WORDS[word.toLowerCase()] ?? null;
}

// Lines a form prints whatever the client says, or that the client left
// empty, tell us nothing about the client.
function usefulLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !l.includes("?"))
    .filter((l) => !/not covered by the form|not answered|for dr david silver phd to decide/i.test(l))
    .filter((l) => !/^\d*\.?\s*[A-Z][A-Z\s&,]+$/.test(l));
}

/** The answer after "Label:" on the first line starting with that label. */
function answerFor(lines: string[], label: RegExp): string | null {
  for (const l of lines) {
    const m = l.match(new RegExp(`^(?:${label.source})\\s*[:\\-]\\s*(.+)$`, "i"));
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

/** "45 minutes", "1 hour", "1.5 hours", "2 hours or more"; null for anything else. */
export function minutesIn(text: string): number | null {
  const t = text.toLowerCase();
  if (/can'?t train|cannot train|\bnone\b|\bno\b|rest day/.test(t) && !/\d/.test(t)) return 0;
  const hours = t.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  const mins = t.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/);
  if (hours || mins) return Math.round((hours ? Number(hours[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0));
  return null;
}

const STRENGTH_WORDS =
  /\b(strength|gym|weights?|weight training|lifting|lifts?|resistance|squats?|deadlifts?|pull-?ups?|kettlebells?|dumbbells?|barbell|bench press)\b/i;

const SPORT_WORDS: [string, RegExp][] = [
  ["running", /\b(run|running|runner|marathon|5k|10k|parkrun)\b/i],
  ["triathlon", /\b(triathlon|ironman|duathlon)\b/i],
  ["cycling", /\b(cycl\w*|bike|zwift)\b/i],
  ["swimming", /\b(swim\w*)\b/i],
  ["rowing", /\b(row|rowing|rower|concept2)\b/i],
  ["football", /\b(football|soccer)\b/i],
  ["rugby", /\brugby\b/i],
  ["netball", /\bnetball\b/i],
  ["hockey", /\bhockey\b/i],
  ["tennis", /\b(tennis|padel|squash)\b/i],
  ["golf", /\bgolf\b/i],
];

const FOCUS_WORDS: [FocusArea, RegExp][] = [
  ["knee", /\b(knee|patell\w*|acl|menisc\w*)\b/i],
  ["back", /\b(back|lumbar|spine|spinal|disc)\b/i],
  ["shoulder", /\b(shoulder|rotator cuff)\b/i],
  ["ankle", /\b(ankle|achilles|calf|calves)\b/i],
  ["hip", /\b(hip|glute\w*|groin)\b/i],
  ["neck", /\b(neck|cervical)\b/i],
  ["concussion", /\bconcuss\w*\b/i],
];

const KIT_WORDS: [Kit, RegExp][] = [
  ["gym", /\b(full gym|gym)\b/i],
  ["barbell", /\b(barbell|rack|olympic bar)\b/i],
  ["dumbbell", /\bdumb\s?bells?\b/i],
  ["kettlebell", /\bkettle\s?bells?\b/i],
  ["cable", /\bcables?\b/i],
  ["machine", /\bmachines?\b/i],
  ["bench", /\bbench\b/i],
  ["pullup", /\b(pull ?up|chin ?up) bar\b/i],
  ["band", /\b(resistance )?bands?\b/i],
  ["step", /\b(step|box|stairs)\b/i],
  ["none", /\b(nothing|bodyweight only|no equipment)\b/i],
];

function readKit(text: string): Kit[] {
  return KIT_WORDS.filter(([, re]) => re.test(text)).map(([k]) => k);
}

/** Reads every intake form and consultation note for one client. */
export function readStrengthProfile(texts: string[]): StrengthProfile {
  const lines = texts.flatMap(usefulLines);
  const all = lines.join("\n");

  const evidence: string[] = [];
  for (const l of lines) {
    if (STRENGTH_WORDS.test(l) && evidence.length < 5) evidence.push(l.length > 120 ? `${l.slice(0, 117)}...` : l);
  }

  // Minutes per day, from "Monday: 45 minutes".
  const dayMinutes: Record<number, number | null> = {};
  for (const [day, re] of DAY_WORDS) {
    const answer = lines.find((l) => new RegExp(`^${re.source}\\s*:`, "i").test(l));
    dayMinutes[day] = answer ? minutesIn(answer.replace(/^[^:]*:\s*/, "")) : null;
  }

  // Strength days: "Monday and Thursday", or "2 upper, 1 lower", or "3 a week".
  let upper = 0;
  let lower = 0;
  let full = 0;
  let total: number | null = null;
  let days: number[] = [];
  const daysAnswer = answerFor(lines, /strength (?:days?|sessions?)/);
  if (daysAnswer) {
    days = DAY_WORDS.filter(([, re]) => re.test(daysAnswer)).map(([d]) => d);
    for (const m of daysAnswer.matchAll(/(\d+|one|two|three|four|five|six)\s*(?:x\s*)?(upper|lower|full)/gi)) {
      const n = toNumber(m[1]) ?? 0;
      const kind = m[2].toLowerCase();
      if (kind === "upper") upper += n;
      else if (kind === "lower") lower += n;
      else full += n;
    }
    const sum = upper + lower + full;
    if (sum > 0) total = sum;
    else if (days.length > 0) total = days.length;
    else {
      const m = daysAnswer.match(/(\d+|one|two|three|four|five|six|once|twice)/i);
      total = m ? toNumber(m[1]) : null;
    }
  } else {
    const m = all.match(/(\d|one|two|three|four|five|once|twice)\s*(?:x\s*)?(?:strength|gym)\s*(?:sessions?|days?)?\s*(?:a|per)\s*week/i);
    if (m) total = toNumber(m[1]);
  }

  const lengthAnswer = answerFor(lines, /strength session length|strength minutes|minutes per strength session/);
  const minutesPerSession = lengthAnswer ? minutesIn(lengthAnswer) : null;

  let split: Split | null = null;
  const splitAnswer = answerFor(lines, /strength split/);
  if (splitAnswer) {
    if (/whole|full/i.test(splitAnswer)) split = "full";
    else if (/upper|lower|different/i.test(splitAnswer)) split = "upper_lower";
  } else if (upper + lower > 0) split = "upper_lower";

  // Kit: the strength equipment question if answered, otherwise the general facilities answer.
  const kitAnswer = answerFor(lines, /strength equipment|strength kit/);
  const facilities = answerFor(lines, /equipment and facilities|equipment|facilities/) ?? "";
  let kit = readKit(kitAnswer ?? facilities);
  if (kit.length === 0 && /\bgym\b/i.test(all)) kit = ["gym"];

  let experience: Experience | null = null;
  const expText = answerFor(lines, /strength experience/) ?? "";
  if (/very experienced|regularly|experienced|advanced|years|heavy/i.test(expText) || /heavy weights|to failure|\d+\s*kg/i.test(all)) {
    experience = "experienced";
  } else if (/none|never|new|beginner|not much|little/i.test(expText)) {
    experience = "new";
  } else if (expText) {
    experience = "some";
  }

  const currentLifts = answerFor(lines, /current lifts|what they lift/) ?? (lines.find((l) => /^gym\s*[-:]/i.test(l)) ?? null);
  const goal = answerFor(lines, /strength goal/);
  const avoid = answerFor(lines, /strength likes and avoids|exercises to avoid|avoid/);
  const injuryAnswer = answerFor(lines, /current injury, pain or condition/);
  const currentInjury = Boolean(injuryAnswer && /^yes/i.test(injuryAnswer));

  const focus = FOCUS_WORDS.filter(([, re]) => re.test(all)).map(([area]) => area);
  const sports = SPORT_WORDS.filter(([, re]) => re.test(all)).map(([name]) => name);

  return {
    discussed: evidence.length > 0 || total != null || minutesPerSession != null,
    evidence,
    minutesPerSession,
    dayMinutes,
    days,
    anyDay: Boolean(daysAnswer && /\b(any ?day|any time|flexible|whenever|no fixed)\b/i.test(daysAnswer)),
    upper,
    lower,
    full,
    total,
    split,
    kit,
    experience,
    currentLifts,
    goal,
    avoid,
    focus,
    sports,
    currentInjury,
    corrected: [],
  };
}

/** The profile from the notes, with David's corrections on top. */
export function applyOverrides(read: StrengthProfile, saved: StrengthOverrides | null | undefined): StrengthProfile {
  if (!saved) return read;
  const out: StrengthProfile = { ...read, corrected: [] };
  const keys: (keyof StrengthOverrides)[] = [
    "minutesPerSession",
    "days",
    "anyDay",
    "split",
    "upper",
    "lower",
    "full",
    "kit",
    "experience",
    "currentLifts",
    "goal",
    "avoid",
    "focus",
  ];
  for (const k of keys) {
    if (saved[k] === undefined) continue;
    (out as Record<string, unknown>)[k] = saved[k];
    out.corrected.push(k);
  }
  if (saved.upper !== undefined || saved.lower !== undefined || saved.full !== undefined) {
    const sum = out.upper + out.lower + out.full;
    out.total = sum > 0 ? sum : out.days.length || out.total;
  } else if (saved.days !== undefined && saved.days.length > 0) {
    out.total = Math.max(saved.days.length, out.upper + out.lower + out.full);
  }
  if (out.corrected.length > 0) out.discussed = true;
  return out;
}

/** Cleans whatever the record page sends before it is saved. */
export function cleanOverrides(raw: unknown): StrengthOverrides {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: StrengthOverrides = {};
  const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : null);
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 1000) : null);
  if ("minutesPerSession" in r) out.minutesPerSession = num(r.minutesPerSession, 240);
  if (Array.isArray(r.days)) out.days = Array.from(new Set(r.days.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))).sort();
  if ("anyDay" in r) out.anyDay = r.anyDay === true;
  if ("split" in r) out.split = r.split === "full" || r.split === "upper_lower" ? r.split : null;
  for (const k of ["upper", "lower", "full"] as const) if (k in r) out[k] = num(r[k], 7) ?? 0;
  if (Array.isArray(r.kit)) out.kit = r.kit.filter((k): k is Kit => typeof k === "string" && k in KIT_LABEL);
  if ("experience" in r) out.experience = r.experience === "new" || r.experience === "some" || r.experience === "experienced" ? r.experience : null;
  if ("currentLifts" in r) out.currentLifts = text(r.currentLifts);
  if ("goal" in r) out.goal = text(r.goal);
  if ("avoid" in r) out.avoid = text(r.avoid);
  if (Array.isArray(r.focus)) out.focus = r.focus.filter((f): f is FocusArea => typeof f === "string" && f in FOCUS_LABEL);
  out.updatedAt = new Date().toISOString();
  return out;
}
