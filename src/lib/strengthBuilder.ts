// The automatic strength builder. Pure rules, no AI and no database, so the
// same client notes and the same library always give the same draft, and
// every choice can be explained in a sentence. It reads what the client
// said about strength (intake form, consultation notes), then fills the
// strength slots in a cardio plan with sessions from David's own library.
// Everything it places becomes the client's own copy in the builder, so
// David edits from there rather than building from nothing.

export type Region = "upper" | "lower" | "full";
export type FocusArea = "knee" | "back" | "shoulder" | "ankle" | "hip" | "neck" | "concussion";

export type StrengthBrief = {
  /** Strength came up somewhere in the client's notes or answers. */
  discussed: boolean;
  /** Short quotes showing where, for David to see why it built. */
  evidence: string[];
  upper: number;
  lower: number;
  full: number;
  /** Strength days asked for in total, or null if no number was given. */
  total: number | null;
  experience: "new" | "some" | "experienced" | null;
  setting: "gym" | "home" | null;
  focus: FocusArea[];
  sports: string[];
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, once: 1, two: 2, twice: 2, three: 3, four: 4, five: 5, six: 6,
};

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
    .filter((l) => !l.includes("?")) // the form's own questions
    .filter((l) => !/not covered by the form|not answered|for dr david silver phd to decide/i.test(l))
    .filter((l) => !/^\d*\.?\s*[A-Z][A-Z\s&,]+$/.test(l)); // section headings such as "7. STRENGTH PLAN"
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

/** Reads every intake form and consultation note for one client. */
export function readStrengthBrief(texts: string[]): StrengthBrief {
  const lines = texts.flatMap(usefulLines);
  const all = lines.join("\n");

  const evidence: string[] = [];
  for (const l of lines) {
    if (STRENGTH_WORDS.test(l) && evidence.length < 4) evidence.push(l.length > 120 ? `${l.slice(0, 117)}...` : l);
  }

  // "Strength days: 2 upper, 1 lower" or "3 strength sessions a week".
  let upper = 0;
  let lower = 0;
  let full = 0;
  let total: number | null = null;
  const daysLine = lines.find((l) => /strength (days?|sessions?)\s*[:\-]/i.test(l));
  if (daysLine) {
    const answer = daysLine.replace(/^.*?strength (days?|sessions?)\s*[:\-]\s*/i, "");
    for (const m of answer.matchAll(/(\d+|one|two|three|four|five|six)\s*(?:x\s*)?(upper|lower|full)/gi)) {
      const n = toNumber(m[1]) ?? 0;
      const kind = m[2].toLowerCase();
      if (kind === "upper") upper += n;
      else if (kind === "lower") lower += n;
      else full += n;
    }
    const sum = upper + lower + full;
    if (sum > 0) total = sum;
    else {
      const m = answer.match(/(\d+|one|two|three|four|five|six|once|twice)/i);
      total = m ? toNumber(m[1]) : null;
    }
  } else {
    const m = all.match(/(\d|one|two|three|four|five|once|twice)\s*(?:x\s*)?(?:strength|gym)\s*(?:sessions?|days?)?\s*(?:a|per)\s*week/i);
    if (m) total = toNumber(m[1]);
  }

  let experience: StrengthBrief["experience"] = null;
  const expLine = lines.find((l) => /strength experience\s*[:\-]/i.test(l));
  const expText = expLine ? expLine.replace(/^.*?strength experience\s*[:\-]\s*/i, "") : "";
  if (/very experienced|experienced|advanced|years|heavy/i.test(expText) || /heavy weights|to failure|\d+\s*kg/i.test(all)) {
    experience = "experienced";
  } else if (/none|never|new|beginner|not much|little/i.test(expText)) {
    experience = "new";
  } else if (expText) {
    experience = "some";
  }

  let setting: StrengthBrief["setting"] = null;
  const equipLine = lines.find((l) => /equipment|facilities/i.test(l)) ?? "";
  if (/\bgym\b/i.test(equipLine) || /\bgym\b/i.test(all)) setting = "gym";
  else if (/home|bands?|dumbbells?|kettlebells?|hotel/i.test(equipLine)) setting = "home";

  const focus = FOCUS_WORDS.filter(([, re]) => re.test(all)).map(([area]) => area);
  const sports = SPORT_WORDS.filter(([, re]) => re.test(all)).map(([name]) => name);

  return {
    discussed: evidence.length > 0 || total != null,
    evidence,
    upper,
    lower,
    full,
    total,
    experience,
    setting,
    focus,
    sports,
  };
}

// ---------------------------------------------------------------------------
// The library

export type LibrarySession = {
  id: string;
  name: string;
  high_load: boolean;
  kind: string | null;
  designations: string[];
  /** Usage tags across every block in the session, main strength blocks counted twice. */
  tags: string[];
  blockIds: string[];
};

// Sessions written for one group or one pathway. They are only offered when
// the client's notes point that way, never as a general choice.
const SPECIALIST: { re: RegExp; allowed: (b: StrengthBrief) => boolean }[] = [
  { re: /concussion|r2s/i, allowed: (b) => b.focus.includes("concussion") },
  { re: /ergon|sttc/i, allowed: () => false },
  { re: /netball/i, allowed: (b) => b.sports.includes("netball") },
  { re: /speedworks|pitch return/i, allowed: (b) => b.sports.includes("rugby") || b.sports.includes("football") },
  { re: /rowing/i, allowed: (b) => b.sports.includes("rowing") },
  { re: /mtss/i, allowed: (b) => b.focus.includes("ankle") },
  { re: /pathway|neurodynamics|upper back & neck/i, allowed: () => false },
];

// Test sessions, Running Builder scaffolding and sessions with nothing in them.
const NEVER = /test|running builder|^running\s|^lower back\s|deload|james|hiit/i;

export function isCandidate(s: LibrarySession, brief: StrengthBrief): boolean {
  if ((s.kind ?? "standard") !== "standard") return false;
  if (s.blockIds.length === 0) return false;
  if (s.designations.some((d) => ["mobility", "hiit", "cardio"].includes(d))) return false;
  if (NEVER.test(s.name)) return false;
  const special = SPECIALIST.find((r) => r.re.test(s.name));
  if (special && !special.allowed(brief)) return false;
  return true;
}

export function regionOf(s: LibrarySession): Region {
  if (/\bupper\b/i.test(s.name)) return "upper";
  if (/\blower\b/i.test(s.name)) return "lower";
  const up = s.tags.filter((t) => t === "Upper Body" || t === "Shoulder").length;
  const low = s.tags.filter((t) => t === "Lower Body" || t === "Running" || t === "Plyometric").length;
  if (up > low * 1.5) return "upper";
  if (low > up * 1.5) return "lower";
  return "full";
}

const FOCUS_TAG: Record<FocusArea, string[]> = {
  knee: ["Isolated Knee"],
  back: ["LBP", "Hip Hinge"],
  shoulder: ["Shoulder"],
  ankle: ["Ankle", "Isolated Ankle"],
  hip: ["Hip Extension", "Hip Flexion"],
  neck: ["Thoracic Mobility"],
  concussion: ["Concussion"],
};

function scoreFor(s: LibrarySession, want: Region, brief: StrengthBrief, alreadyChosen: LibrarySession[]): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const region = regionOf(s);
  if (region === want) score += 10;
  else if (region === "full" || want === "full") score += 4;
  else return { score: -100, reasons };

  const isGym = /gym/i.test(s.name) || s.tags.includes("Gym");
  if (brief.setting === "gym" && isGym) {
    score += 4;
    reasons.push("gym based, which matches their facilities");
  }
  if (brief.setting === "home" && /hotel|keep strong/i.test(s.name)) {
    score += 3;
    reasons.push("works with minimal kit");
  }
  if (brief.experience === "experienced" && (isGym || /strength/i.test(s.name))) score += 2;
  if (brief.experience === "new" && /keep strong|return to gym|introduction/i.test(s.name)) {
    score += 2;
    reasons.push("a gentle way in for someone newer to strength work");
  }

  const endurance = brief.sports.some((x) => ["running", "triathlon"].includes(x));
  if (endurance && want !== "upper" && s.tags.includes("Running")) {
    score += 3;
    reasons.push("built around running");
  }

  for (const area of brief.focus) {
    const hits = FOCUS_TAG[area].filter((t) => s.tags.includes(t));
    if (hits.length > 0) {
      score += 3;
      reasons.push(`covers the ${area} history in their notes`);
    }
  }

  // Two sessions of the same kind in a week should not be the same blocks.
  for (const other of alreadyChosen) {
    const shared = s.blockIds.filter((b) => other.blockIds.includes(b)).length;
    if (shared > 0) score -= 6 * shared;
  }

  return { score, reasons };
}

export function pickSessions(
  library: LibrarySession[],
  brief: StrengthBrief,
  want: Region,
  count: number
): { session: LibrarySession; reasons: string[] }[] {
  const pool = library.filter((s) => isCandidate(s, brief));
  const chosen: { session: LibrarySession; reasons: string[] }[] = [];
  for (let i = 0; i < count; i++) {
    const ranked = pool
      .filter((s) => !chosen.some((c) => c.session.id === s.id))
      .map((s) => ({ s, ...scoreFor(s, want, brief, chosen.map((c) => c.session)) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name));
    if (ranked.length === 0) break;
    chosen.push({ session: ranked[0].s, reasons: ranked[0].reasons });
  }
  return chosen;
}

// ---------------------------------------------------------------------------
// Placing sessions on the week

export type PlanSlot = { key: string; week: number; day: number };
export type OtherCard = { week: number; day: number; type: string; title: string; summary: string };

const HARD = /tempo|interval|threshold|quality|reps?\b|hills?|speed|fartlek|race|test|vo2|sprint/i;
const LONG = /\blong\b/i;

function isHard(c: OtherCard): boolean {
  const text = `${c.title} ${c.summary}`;
  if (c.type === "other") return /football|rugby|netball|match|game|hockey/i.test(text);
  return HARD.test(text) && !/^easy/i.test(c.title);
}

function dayBefore(day: number): number {
  return day === 1 ? 7 : day - 1;
}

/** How well a day suits a lower body session: hard days kept hard, the day before a long or hard session kept clear. */
function lowerScore(day: number, others: OtherCard[]): number {
  let score = 0;
  for (const c of others) {
    if (c.day === day && c.type === "run" && isHard(c)) score += 10;
    else if (c.day === day && isHard(c)) score += 5;
    if (dayBefore(c.day) === day && LONG.test(c.title)) score -= 4;
    if (dayBefore(c.day) === day && c.type === "run" && isHard(c)) score -= 3;
  }
  return score;
}

/** The kinds of session wanted this week, in the client's own split. */
export function regionsWanted(brief: StrengthBrief, slots: number): Region[] {
  const fromBrief: Region[] = [
    ...Array<Region>(brief.lower).fill("lower"),
    ...Array<Region>(brief.upper).fill("upper"),
    ...Array<Region>(brief.full).fill("full"),
  ];
  if (fromBrief.length > 0) return fromBrief;
  const n = brief.total ?? slots;
  // No split given: one day is full body, two or more alternate lower and upper.
  if (n === 1) return ["full"];
  return Array.from({ length: n }, (_, i): Region => (i % 2 === 0 ? "lower" : "upper"));
}

export type Placement = {
  /** Fills an existing strength slot; null means a new card on this day. */
  slotKey: string | null;
  week: number;
  day: number;
  region: Region;
  session: LibrarySession;
};

export type BuildResult = {
  placements: Placement[];
  /** One line per chosen session, for David. */
  choices: { name: string; region: Region; reasons: string[] }[];
  notes: string[];
};

const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function buildStrength(
  brief: StrengthBrief,
  library: LibrarySession[],
  slots: PlanSlot[],
  others: OtherCard[],
  weeks: number
): BuildResult {
  const notes: string[] = [];
  const perWeekSlots = new Map<number, PlanSlot[]>();
  for (const s of slots) perWeekSlots.set(s.week, [...(perWeekSlots.get(s.week) ?? []), s]);

  const firstWeekCount = perWeekSlots.get(1)?.length ?? slots.length;
  const wanted = regionsWanted(brief, firstWeekCount);
  if (wanted.length === 0) return { placements: [], choices: [], notes: ["No strength days were given and the plan has no strength slots."] };

  const count = (r: Region) => wanted.filter((w) => w === r).length;
  const chosen: Record<Region, { session: LibrarySession; reasons: string[] }[]> = {
    lower: pickSessions(library, brief, "lower", count("lower")),
    upper: pickSessions(library, brief, "upper", count("upper")),
    full: pickSessions(library, brief, "full", count("full")),
  };
  for (const r of ["lower", "upper", "full"] as Region[]) {
    if (chosen[r].length < count(r)) notes.push(`Your library has no suitable ${r} body session for one of the slots, so it is left empty.`);
  }

  const placements: Placement[] = [];
  for (let week = 1; week <= weeks; week++) {
    const weekOthers = others.filter((o) => o.week === week);
    let weekSlots = [...(perWeekSlots.get(week) ?? [])];

    // Fewer slots in the plan than strength days asked for: add days, kept
    // apart from each other and from days already holding strength.
    if (weekSlots.length < wanted.length) {
      const taken = weekSlots.map((s) => s.day);
      const free = [2, 4, 6, 1, 3, 5, 7].filter((d) => !taken.includes(d));
      const spaced = free.filter((d) => !taken.some((t) => Math.abs(t - d) === 1));
      const extra = [...spaced, ...free.filter((d) => !spaced.includes(d))].slice(0, wanted.length - weekSlots.length);
      weekSlots = [...weekSlots, ...extra.map((day) => ({ key: "", week, day }))];
      if (week === 1 && extra.length > 0) {
        notes.push(`The plan had fewer strength slots than the strength days asked for, so ${extra.map((d) => DAY_NAMES[d]).join(" and ")} were added. Move them if another day suits better.`);
      }
    }
    if (week === 1 && weekSlots.length > wanted.length) {
      notes.push(`The plan has ${weekSlots.length} strength slots but ${wanted.length} strength days were asked for, so the extra slot is left empty for you.`);
    }

    // Lower body first, onto the best days for it; the rest in day order.
    const remaining = [...weekSlots].sort((a, b) => a.day - b.day);
    const assign: { slot: PlanSlot; region: Region }[] = [];
    for (let i = 0; i < count("lower"); i++) {
      remaining.sort((a, b) => lowerScore(b.day, weekOthers) - lowerScore(a.day, weekOthers) || a.day - b.day);
      const slot = remaining.shift();
      if (slot) assign.push({ slot, region: "lower" });
    }
    remaining.sort((a, b) => a.day - b.day);
    for (const r of ["upper", "full"] as Region[]) {
      for (let i = 0; i < count(r); i++) {
        const slot = remaining.shift();
        if (slot) assign.push({ slot, region: r });
      }
    }

    const used: Record<Region, number> = { lower: 0, upper: 0, full: 0 };
    for (const a of [...assign].sort((x, y) => x.slot.day - y.slot.day)) {
      const pick = chosen[a.region][used[a.region]++ % Math.max(1, chosen[a.region].length)];
      if (!pick) continue;
      placements.push({ slotKey: a.slot.key || null, week, day: a.slot.day, region: a.region, session: pick.session });
    }
  }

  const choices = (["lower", "upper", "full"] as Region[]).flatMap((r) =>
    chosen[r].map((c) => ({ name: c.session.name, region: r, reasons: c.reasons }))
  );

  const lowerDays = placements.filter((p) => p.week === 1 && p.region === "lower").map((p) => p.day);
  for (const d of lowerDays) {
    const hard = others.find((o) => o.week === 1 && o.day === d && isHard(o));
    if (hard) notes.push(`Lower body sits on ${DAY_NAMES[d]} with "${hard.title}", so the hard work stays on the same day and the easy days stay easy.`);
  }

  return { placements, choices, notes };
}
