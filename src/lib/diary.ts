// Diary planner, Phase 1: the shared vocabulary and rules. No server-only
// imports, so the planner screens can use the same lists and labels.
//
// Times are UK time throughout. A PA typing 07:00 means 07:00 in London,
// whatever the computer they are typing on is set to, and every screen and
// calendar entry shows it the same way.

import type { BlockCategory } from "@/lib/blockCategory";

export const DIARY_TIME_ZONE = "Europe/London";

export const SLOT_LENGTHS = [20, 30, 45, 60, 90] as const;
export type SlotLength = (typeof SLOT_LENGTHS)[number];

export const SLOT_LOCATIONS = [
  { value: "home", label: "Home" },
  { value: "office", label: "Office or office gym" },
  { value: "gym", label: "Gym" },
  { value: "hotel", label: "Hotel" },
  { value: "travel", label: "Travelling" },
] as const;
export type SlotLocation = (typeof SLOT_LOCATIONS)[number]["value"];

export function cleanSlotLength(value: unknown): SlotLength | null {
  const n = Number(value);
  return (SLOT_LENGTHS as readonly number[]).includes(n) ? (n as SlotLength) : null;
}

export function cleanSlotLocation(value: unknown): SlotLocation | null {
  return SLOT_LOCATIONS.some((l) => l.value === value) ? (value as SlotLocation) : null;
}

export function locationLabel(value: string): string {
  return SLOT_LOCATIONS.find((l) => l.value === value)?.label ?? "Home";
}

// How a session fits a shorter slot. Nothing is removed: the parts that
// matter most stay at the top, and the rest moves under "If time allows",
// so a client with twenty minutes knows exactly what to do first.
//
//   45 minutes or more  the whole session, as written
//   30 minutes          injury prevention and cool down move to "If time allows"
//   20 minutes          activation also moves to "If time allows"
//
// Warm up, main work, cardio and runs always stay. This is a first version
// of the rule for Dr David Silver PhD to confirm or change; it lives only
// here, so changing it changes it everywhere.
const OPTIONAL_BY_LENGTH: Record<SlotLength, BlockCategory[]> = {
  20: ["activation", "injury_prevention", "cool_down"],
  30: ["injury_prevention", "cool_down"],
  45: [],
  60: [],
  90: [],
};

export function isOptionalInSlot(category: BlockCategory, durationMinutes: number): boolean {
  const length = cleanSlotLength(durationMinutes);
  if (!length) return false;
  return OPTIONAL_BY_LENGTH[length].includes(category);
}

// The parts of a date as UK clock time.
function londonParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DIARY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

// "2026-11-12" and "07:00", read as UK time, to a real moment.
export function londonToUtc(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const wanted = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
  // Guess as if UK time were UTC, then correct by however far off the
  // guess reads in London (one hour in summer, none in winter).
  const guess = new Date(wanted);
  const p = londonParts(guess);
  const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return new Date(wanted - (seen - wanted));
}

// A moment as UK date ("2026-11-12") and time ("07:00") for form fields.
export function utcToLondonFields(iso: string): { date: string; time: string } {
  const p = londonParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

// A calendar date with no time ("2026-11-12") for a Date, in UK time.
export function londonDateKey(date: Date): string {
  return utcToLondonFields(date.toISOString()).date;
}

export function formatSlotWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { timeZone: DIARY_TIME_ZONE, weekday: "long", day: "numeric", month: "long" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: DIARY_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  return `${day} at ${time}`;
}

export type SlotSummary = {
  id: string;
  startsAt: string;
  durationMinutes: number;
  location: SlotLocation;
  placedBy: "client" | "pa" | "clinic";
  googleSynced: boolean;
  googleError: string | null;
};
