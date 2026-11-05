// Training zones and race predictions for the Rowing and Running Builder.
// Pure and isomorphic, so the builder screen and the server agree exactly.
//
// Rowing paces are seconds per 500m, set from the client's 20 minute test.
// Running paces are seconds per km, set from their 5K pace (worked out from
// whatever time trial or race they did, by Riegel's formula).
//
// DRAFT CLINICAL VALUES FOR DR DAVID SILVER PhD TO CHECK. The zone offsets
// below are sensible starting points, not verified figures. They are shown
// on the builder screen and can be changed per client there before a plan
// is built, so nothing here is final.

export type Sport = "row" | "run";

export type ZoneId = "UT2" | "UT1" | "AT" | "TR" | "EVENT";

export type ZoneOffsets = {
  /** Seconds slower (+) or faster (-) than the reference pace, fast edge then slow edge. */
  UT2: [number, number];
  UT1: [number, number];
  AT: [number, number];
  TR: [number, number];
};

export const DEFAULT_ZONE_OFFSETS: Record<Sport, ZoneOffsets> = {
  // From the 20 minute test split, per 500m.
  row: { UT2: [18, 24], UT1: [10, 14], AT: [2, 5], TR: [-6, -3] },
  // From 5K pace, per km.
  run: { UT2: [60, 90], UT1: [35, 50], AT: [10, 20], TR: [-5, 5] },
};

type ZoneText = { name: string; rate: string | null; feel: string };

export const ZONE_INFO: Record<Sport, Record<ZoneId, ZoneText>> = {
  row: {
    UT2: { name: "Easy steady", rate: "18 to 20", feel: "Easy enough to hold a conversation the whole way through." },
    UT1: { name: "Steady", rate: "20 to 22", feel: "Comfortably hard; you can talk in short sentences." },
    AT: { name: "Threshold", rate: "24 to 26", feel: "Hard but controlled, the effort you could hold for about half an hour." },
    TR: { name: "Fast", rate: "26 to 30", feel: "Very hard, kept short, with full easy recovery in between." },
    EVENT: { name: "Event pace", rate: "22 to 24", feel: "The rhythm you plan to hold on the day, smooth and repeatable." },
  },
  run: {
    UT2: { name: "Easy", rate: null, feel: "Relaxed and conversational the whole way; slower than feels necessary is about right." },
    UT1: { name: "Steady", rate: null, feel: "Comfortably hard; you can talk in short sentences." },
    AT: { name: "Threshold", rate: null, feel: "Hard but controlled, the effort you could hold for about an hour in a race." },
    TR: { name: "Fast", rate: null, feel: "Around your 5K effort, kept short, with easy jogging in between." },
    EVENT: { name: "Goal pace", rate: null, feel: "The rhythm you plan to hold on the day, smooth and repeatable." },
  },
};

export const SPORT_TEXT: Record<Sport, { unit: string; unitMetres: number; noun: string; verb: string; erg: string }> = {
  row: { unit: "/500m", unitMetres: 500, noun: "row", verb: "row", erg: "the PM5" },
  run: { unit: "/km", unitMetres: 1000, noun: "run", verb: "run", erg: "your watch" },
};

export function cleanSport(value: unknown): Sport {
  return value === "run" ? "run" : "row";
}

/** Split in seconds per 500m from a 20 minute test distance. */
export function splitFromTwentyMinutes(distanceM: number): number {
  return Math.round((1200 * 500 * 100) / distanceM) / 100;
}

/** Pace per 500m (rowing) or per km (running) from any result. */
export function paceFromResult(sport: Sport, distanceM: number, timeSeconds: number): number {
  const unit = SPORT_TEXT[sport].unitMetres;
  return Math.round(((timeSeconds * unit) / distanceM) * 100) / 100;
}

/** Kept for the rowing code that already calls it. */
export function splitFromResult(distanceM: number, timeSeconds: number): number {
  return paceFromResult("row", distanceM, timeSeconds);
}

/** Riegel's formula: a time over one distance scaled to another. */
export function riegel(timeSeconds: number, fromM: number, toM: number): number {
  return timeSeconds * Math.pow(toM / fromM, 1.06);
}

/**
 * The single pace every zone is set from.
 * Rowing: the 20 minute test split. Running: 5K pace per km.
 */
export function referenceFromTest(sport: Sport, testDistanceM: number, testTimeSeconds: number): number {
  if (sport === "row") return Math.round(((testTimeSeconds * 500) / testDistanceM) * 100) / 100;
  return Math.round((riegel(testTimeSeconds, testDistanceM, 5000) / 5) * 100) / 100;
}

/**
 * Predicted pace over an event distance from the reference.
 * Rowing: Paul's Law, about 5 seconds per 500m slower each time the
 * distance doubles, from the distance of the reference effort.
 * Running: Riegel's formula from 5K.
 */
export function predictedPace(sport: Sport, reference: number, referenceDistanceM: number, eventDistanceM: number): number {
  if (sport === "row") return reference + 5 * Math.log2(eventDistanceM / referenceDistanceM);
  const t5k = reference * 5;
  return (riegel(t5k, 5000, eventDistanceM) / eventDistanceM) * 1000;
}

export function timeFromPace(sport: Sport, pace: number, distanceM: number): number {
  return (pace * distanceM) / SPORT_TEXT[sport].unitMetres;
}

/** For timed events: the distance covered in `seconds` at predicted pace. */
export function predictedDistanceForTime(sport: Sport, reference: number, referenceDistanceM: number, seconds: number): number {
  let d = referenceDistanceM;
  for (let i = 0; i < 30; i++) {
    const pace = predictedPace(sport, reference, referenceDistanceM, d);
    d = (seconds * SPORT_TEXT[sport].unitMetres) / pace;
  }
  return d;
}

/** 135.4 -> "2:15.4", 300 -> "5:00" */
export function formatSplit(seconds: number): string {
  const whole = Math.max(0, seconds);
  const m = Math.floor(whole / 60);
  const s = whole - m * 60;
  const tenths = Math.round(s * 10) / 10;
  const sText = tenths < 10 ? `0${tenths.toFixed(1)}` : tenths.toFixed(1);
  return `${m}:${sText.endsWith(".0") ? sText.slice(0, -2) : sText}`;
}

/** 5400 -> "1:30:00", 1200 -> "20:00" */
export function formatDuration(totalSeconds: number): string {
  const t = Math.round(totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** "3:30:00" -> 12600, "45:00" -> 2700, "45" -> 2700. Null if it can't be read. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (!/^\d+(:\d{1,2}(\.\d+)?){0,2}$/.test(t)) return null;
  const parts = t.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

export type ZoneBand = { zone: ZoneId; fast: number; slow: number };

export function zoneBand(reference: number, zone: Exclude<ZoneId, "EVENT">, offsets: ZoneOffsets): ZoneBand {
  const [a, b] = offsets[zone];
  return { zone, fast: reference + a, slow: reference + b };
}

/** A narrow band either side of one event pace. */
export function eventBand(sport: Sport, pace: number): ZoneBand {
  const half = sport === "row" ? 1.5 : 3;
  return { zone: "EVENT", fast: pace - half, slow: pace + half };
}

export function bandText(sport: Sport, band: ZoneBand): string {
  return `${formatSplit(band.fast)} to ${formatSplit(band.slow)} ${SPORT_TEXT[sport].unit}`;
}

export function cleanOffsets(sport: Sport, value: unknown): ZoneOffsets {
  const out: ZoneOffsets = { ...DEFAULT_ZONE_OFFSETS[sport] };
  if (value && typeof value === "object") {
    for (const z of ["UT2", "UT1", "AT", "TR"] as const) {
      const v = (value as Record<string, unknown>)[z];
      if (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n))) {
        const [x, y] = v as number[];
        out[z] = [Math.min(x, y), Math.max(x, y)];
      }
    }
  }
  return out;
}
