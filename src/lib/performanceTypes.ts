// Goals and tests, shared by the Performance metrics card, the forms that
// add to it and the server routes that save it. No server code here, so the
// browser can use the same lists and the same reading of a typed result.

export type PerformanceType =
  | "marathon"
  | "half_marathon"
  | "10k_run"
  | "5k_run"
  | "20min_erg"
  | "2k_erg"
  | "10k_row"
  | "long_row"
  | "other";

export type PerformanceTypeInfo = {
  value: PerformanceType;
  label: string;
  // What the result is: a finishing time, or average watts for a fixed time.
  measure: "time" | "watts" | "either";
  // The distance a time is over, for working out pace and predictions.
  distanceM: number | null;
  family: "run" | "row" | "other";
  // Offered as a goal as well as a test.
  goal: boolean;
};

export const PERFORMANCE_TYPES: PerformanceTypeInfo[] = [
  { value: "marathon", label: "Marathon", measure: "time", distanceM: 42195, family: "run", goal: true },
  { value: "half_marathon", label: "Half marathon", measure: "time", distanceM: 21097.5, family: "run", goal: false },
  { value: "10k_run", label: "10K run", measure: "time", distanceM: 10000, family: "run", goal: false },
  { value: "5k_run", label: "5K run", measure: "time", distanceM: 5000, family: "run", goal: true },
  { value: "20min_erg", label: "20 min erg", measure: "watts", distanceM: null, family: "row", goal: true },
  { value: "2k_erg", label: "2K erg", measure: "time", distanceM: 2000, family: "row", goal: true },
  { value: "10k_row", label: "10K row", measure: "time", distanceM: 10000, family: "row", goal: true },
  { value: "long_row", label: "Long row (set the distance)", measure: "time", distanceM: null, family: "row", goal: true },
  { value: "other", label: "Other", measure: "either", distanceM: null, family: "other", goal: true },
];

export const GOAL_TYPES = PERFORMANCE_TYPES.filter((t) => t.goal);

export function performanceType(value: string | null | undefined): PerformanceTypeInfo | null {
  return PERFORMANCE_TYPES.find((t) => t.value === value) ?? null;
}

/**
 * Reads a typed time such as 25:00, 4:05:00, 1:47.3 or 3h 58m into
 * seconds. Null when it can't be read as a time.
 */
export function parseTimeText(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return null;
  const hms = t.match(/^(?:(\d+)h)?(?:(\d+)m(?:in)?)?(?:(\d+(?:\.\d+)?)s)?$/);
  if (hms && (hms[1] || hms[2] || hms[3])) {
    return Number(hms[1] || 0) * 3600 + Number(hms[2] || 0) * 60 + Number(hms[3] || 0);
  }
  const clean = t.replace(/\/.*$/, "");
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(clean)) return null;
  const parts = clean.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 1) return null; // a bare number is not a time
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** Reads 290, 290 W or 290w into watts. */
export function parseWattsText(text: string): number | null {
  const m = text.trim().toLowerCase().match(/^(\d{2,4})(?:\.\d+)?\s*(w|watts)?$/);
  return m ? Number(m[1]) : null;
}

/** 3725 as 1:02:05, 1500 as 25:00, 107.3 as 1:47.3. */
export function formatSeconds(seconds: number, withTenths = false): string {
  const total = withTenths ? Math.round(seconds * 10) / 10 : Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const sText = withTenths ? s.toFixed(1).padStart(4, "0") : String(Math.round(s)).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sText}` : `${m}:${sText}`;
}

/**
 * Riegel: T2 = T1 x (D2 / D1) ^ 1.06. A test time over one distance as a
 * predicted time over another.
 */
export function riegel(testSeconds: number, testDistanceM: number, goalDistanceM: number): number {
  return testSeconds * Math.pow(goalDistanceM / testDistanceM, 1.06);
}

/**
 * The numbers to store for a typed result: seconds for a time, watts for
 * an erg power result. An error message when it can't be read.
 */
export function readResult(
  type: PerformanceTypeInfo,
  text: string,
  distanceM: number | null = type.distanceM
): { seconds: number | null; watts: number | null; error: string | null } {
  let seconds = parseTimeText(text);
  const watts = parseWattsText(text);
  // A pace such as 1:47 /500m becomes the time for the whole distance.
  if (seconds && /\/\s*500/.test(text)) {
    seconds = distanceM ? Math.round(seconds * (distanceM / 500) * 10) / 10 : null;
    if (!seconds) return { seconds: null, watts: null, error: "Give a finishing time rather than a pace for this one." };
  }
  // A time that would mean an impossible pace was almost always meant as a
  // split, such as 01:47:00 typed for 1:47 /500m, so ask rather than save it.
  if (seconds && distanceM && (type.family === "row" || type.family === "run")) {
    const per = type.family === "row" ? (seconds * 500) / distanceM : (seconds * 1000) / distanceM;
    const [fastest, slowest] = type.family === "row" ? [70, 240] : [150, 900];
    if (per < fastest || per > slowest) {
      const unit = type.family === "row" ? "/500m" : "/km";
      return {
        seconds: null,
        watts: null,
        error: `That works out at ${formatSeconds(per, true)} ${unit}, which looks like a typing slip. Write the finishing time, for example 35:40, or the pace with its unit, for example 1:47 ${unit}.`,
      };
    }
  }
  if (type.measure === "time") {
    return seconds ? { seconds, watts: null, error: null } : { seconds: null, watts: null, error: "Write the time as hours, minutes and seconds, for example 25:00 or 4:05:00." };
  }
  if (type.measure === "watts") {
    return watts ? { seconds: null, watts, error: null } : { seconds: null, watts: null, error: "Write the average watts as a number, for example 262." };
  }
  return { seconds, watts: seconds ? null : watts, error: null };
}
