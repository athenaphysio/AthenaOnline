import type { AthenaPlanV1, PlanStep, SessionDay, SessionType } from "@/lib/athenaPlan";
import type { RowingCardMeta } from "@/lib/rowing/rowingPlan";
import { circuitFromLibrary, type CardCircuit, type CircuitLibrary } from "@/lib/runCircuit";

// Turns a validated athena-plan-v1 plan into builder cards. Pure and
// client-safe: no AI, no database, and nothing here changes the plan's own
// wording.

export type PlanCardData = {
  type: SessionType;
  title: string;
  summary: string;
  steps: PlanStep[];
  target: string;
  total: string;
  notes: string;
  /** Set only on cards made by the Rowing Builder: the card's stable key,
   * zone and target splits, read back when PM5 results come in. */
  rowing?: RowingCardMeta;
  /** Set only on a Run Circuit card: the blocks, with this client's own
   * copy of each block's exercises, and the run and walk for each. */
  circuit?: CardCircuit;
};

export type ImportedCard = {
  week: number;
  day: number;
  order: number;
  plan: PlanCardData;
  dayNotSet: boolean;
};

export type ImportedPlan = {
  weeks: number;
  cards: ImportedCard[];
  restCells: { week: number; day: number }[];
  weekLabels: Record<number, string>;
};

const DAY_NUMBER: Record<Exclude<SessionDay, "any">, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
};

// First choice Tuesday, then Saturday, then the rest, so two floating
// sessions land on Tue and Sat.
const SPREAD_PREFERENCE = [2, 6, 4, 1, 5, 3, 7];

function isAdjacent(a: number, b: number): boolean {
  const gap = Math.abs(a - b);
  return gap === 1 || gap === 6;
}

// Picks days for a week's "any" sessions: free days first, and days that
// are not next to a day already in use before ones that are.
export function spreadDays(taken: number[], count: number): number[] {
  const used = [...taken];
  const chosen: number[] = [];
  for (let i = 0; i < count; i++) {
    const free = SPREAD_PREFERENCE.filter((d) => !used.includes(d));
    const spaced = free.filter((d) => !used.some((u) => isAdjacent(d, u)));
    const pick = spaced[0] ?? free[0] ?? SPREAD_PREFERENCE[i % SPREAD_PREFERENCE.length];
    chosen.push(pick);
    used.push(pick);
  }
  return chosen;
}

// A Run Circuit's blocks are copied from the library here. With no library
// to hand, the blocks come through with no exercises, which the card
// editor flags.
export function planToBuilder(plan: AthenaPlanV1, circuitLibrary: CircuitLibrary = { blocks: [], sets: [] }): ImportedPlan {
  const weeks = [...plan.weeks].sort((a, b) => a.week - b.week);
  const cards: ImportedCard[] = [];
  const restCells: { week: number; day: number }[] = [];
  const weekLabels: Record<number, string> = {};

  weeks.forEach((w, idx) => {
    const weekNumber = idx + 1;
    if (w.label.trim()) weekLabels[weekNumber] = w.label.trim();

    const sessions = [...w.sessions].sort((a, b) => a.order - b.order);
    const fixedDays = sessions.filter((s) => s.day !== "any").map((s) => DAY_NUMBER[s.day as Exclude<SessionDay, "any">]);
    const floating = sessions.filter((s) => s.day === "any" && s.type !== "rest");
    const floatingDays = spreadDays(fixedDays, floating.length);
    let floatIdx = 0;

    sessions.forEach((s, order) => {
      if (s.type === "rest") {
        if (s.day !== "any") restCells.push({ week: weekNumber, day: DAY_NUMBER[s.day] });
        return;
      }
      const notSet = s.day === "any";
      const day = notSet ? floatingDays[floatIdx++] : DAY_NUMBER[s.day as Exclude<SessionDay, "any">];
      cards.push({
        week: weekNumber,
        day,
        order,
        dayNotSet: notSet,
        plan: {
          type: s.type,
          title: s.title,
          summary: s.summary,
          steps: s.steps.map((st) => ({ label: st.label, detail: st.detail })),
          target: s.target,
          total: s.total,
          notes: s.notes,
          ...(s.type === "run_circuit" && s.circuit ? { circuit: circuitFromLibrary(s.circuit, circuitLibrary) } : {}),
        },
      });
    });
  });

  return { weeks: weeks.length, cards, restCells, weekLabels };
}

// Rest days are stored as small numbers: 1 to 7 means that weekday in every
// week (the original meaning); week * 10 + weekday means one weekday in one
// week only.
export function restCode(week: number, day: number): number {
  return week * 10 + day;
}

export function isRestDay(restDays: number[], week: number, day: number): boolean {
  return restDays.includes(day) || restDays.includes(restCode(week, day));
}

export function cleanRestCodes(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ok = value.filter((v): v is number => {
    if (!Number.isInteger(v) || v < 1) return false;
    if (v <= 7) return true;
    const day = v % 10;
    return v >= 11 && day >= 1 && day <= 7;
  });
  return Array.from(new Set(ok)).sort((a, b) => a - b);
}

export const CARD_TYPE_LABEL: Record<SessionType, string> = {
  run: "Run",
  bike: "Bike",
  swim: "Swim",
  row: "Row",
  strength: "Strength",
  rest: "Rest",
  other: "Other",
  run_circuit: "Run Circuit",
};
