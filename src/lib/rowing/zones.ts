// Rowing training zones, all worked out from one number: the client's
// average split (seconds per 500m) on their 20 minute test. Pure and
// isomorphic, so the builder screen and the server agree exactly.
//
// DRAFT CLINICAL VALUES FOR DR DAVID SILVER PhD TO CHECK. The offsets and
// stroke rates below are sensible starting points, not verified figures.
// They are shown on the Rowing Builder screen and can be changed per
// client there before a plan is built, so nothing here is final.

export type ZoneId = "UT2" | "UT1" | "AT" | "TR" | "EVENT";

export type ZoneOffsets = {
  /** Seconds slower (+) or faster (-) than the 20 minute split, fast edge then slow edge. */
  UT2: [number, number];
  UT1: [number, number];
  AT: [number, number];
  TR: [number, number];
};

export const DEFAULT_ZONE_OFFSETS: ZoneOffsets = {
  UT2: [18, 24],
  UT1: [10, 14],
  AT: [2, 5],
  TR: [-6, -3],
};

export const ZONE_INFO: Record<ZoneId, { name: string; rate: string; feel: string }> = {
  UT2: { name: "Easy steady", rate: "18 to 20", feel: "Easy enough to hold a conversation the whole way through." },
  UT1: { name: "Steady", rate: "20 to 22", feel: "Comfortably hard; you can talk in short sentences." },
  AT: { name: "Threshold", rate: "24 to 26", feel: "Hard but controlled, the effort you could hold for about half an hour." },
  TR: { name: "Fast", rate: "26 to 30", feel: "Very hard, kept short, with full easy recovery in between." },
  EVENT: { name: "Event pace", rate: "22 to 24", feel: "The rhythm you plan to hold on the day, smooth and repeatable." },
};

/** Split in seconds per 500m from a 20 minute test distance. */
export function splitFromTwentyMinutes(distanceM: number): number {
  return Math.round((1200 * 500 * 100) / distanceM) / 100;
}

export function splitFromResult(distanceM: number, timeSeconds: number): number {
  return Math.round(((timeSeconds * 500) / distanceM) * 100) / 100;
}

/** 135.4 -> "2:15.4" */
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

/** Event pace sits between steady and threshold, slower for longer events. */
export function eventOffsetFor(eventMinutes: number): number {
  if (eventMinutes <= 40) return 4;
  if (eventMinutes <= 100) return 8;
  return 12;
}

export type ZoneBand = { zone: ZoneId; fast: number; slow: number };

export function zoneBand(reference: number, zone: ZoneId, offsets: ZoneOffsets, eventMinutes: number): ZoneBand {
  if (zone === "EVENT") {
    const off = eventOffsetFor(eventMinutes);
    return { zone, fast: reference + off - 1.5, slow: reference + off + 1.5 };
  }
  const [a, b] = offsets[zone];
  return { zone, fast: reference + a, slow: reference + b };
}

export function bandText(band: ZoneBand): string {
  return `${formatSplit(band.fast)} to ${formatSplit(band.slow)} /500m`;
}

export function cleanOffsets(value: unknown): ZoneOffsets {
  const out: ZoneOffsets = { ...DEFAULT_ZONE_OFFSETS };
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
