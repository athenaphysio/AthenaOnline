import "server-only";
import JSZip from "jszip";
import { Decoder, Stream } from "@garmin/fitsdk";

// Reads a workout file a client has uploaded: a .FIT file, the format
// Garmin, Wattbike, Zwift, Concept2 and most other devices and apps can
// save, or a .zip holding one (Garmin Connect's "Export original" gives a
// zip). Uses Garmin's own FIT reader. Only the numbers are kept; the file
// itself is never stored.

export type WorkoutSport = "row" | "run" | "ride" | "other";

export type WorkoutLap = {
  n: number;
  seconds: number;
  distanceM: number | null;
  avgHr: number | null;
  avgPower: number | null;
  avgCadence: number | null;
};

export type WorkoutSummary = {
  sport: WorkoutSport;
  /** Plain words for the client and David, e.g. "Indoor cycling". */
  sportLabel: string;
  startedAt: string;
  durationSeconds: number;
  distanceM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgPower: number | null;
  maxPower: number | null;
  avgCadence: number | null;
  calories: number | null;
  device: string | null;
  laps: WorkoutLap[];
};

export class WorkoutFileError extends Error {}

const MAX_LAPS = 60;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

function round(v: number | null, places = 0): number | null {
  if (v == null) return null;
  const f = Math.pow(10, places);
  return Math.round(v * f) / f;
}

function words(camel: string): string {
  const s = camel.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function classify(sport: string | undefined, subSport: string | undefined): { sport: WorkoutSport; label: string } {
  const sp = sport ?? "";
  const sub = subSport ?? "";
  if (sp === "rowing" || sub === "indoorRowing") return { sport: "row", label: sub === "indoorRowing" ? "Indoor rowing" : "Rowing" };
  if (sp === "running") return { sport: "run", label: sub === "treadmill" ? "Treadmill running" : sub === "trail" ? "Trail running" : "Running" };
  if (sp === "cycling" || sub === "indoorCycling" || sub === "spin") {
    return { sport: "ride", label: sub === "indoorCycling" || sub === "spin" || sub === "virtualActivity" ? "Indoor cycling" : "Cycling" };
  }
  if (sub && sub !== "generic") return { sport: "other", label: words(sub) };
  return { sport: "other", label: sp && sp !== "generic" ? words(sp) : "Workout" };
}

async function fitBytes(bytes: Uint8Array, fileName: string): Promise<Uint8Array> {
  const lower = fileName.toLowerCase();
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip || lower.endsWith(".zip")) {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(bytes);
    } catch {
      throw new WorkoutFileError("That zip file couldn't be opened. Try exporting the workout again.");
    }
    const entry = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(".fit"));
    if (!entry) throw new WorkoutFileError("There's no .FIT file inside that zip. Look for an export option that gives a FIT file.");
    return entry.async("uint8array");
  }
  if (lower.endsWith(".tcx") || lower.endsWith(".gpx") || lower.endsWith(".csv")) {
    throw new WorkoutFileError("Only .FIT files can be read at the moment. Most apps offer FIT as one of their export options.");
  }
  return bytes;
}

export async function readWorkoutFile(input: Uint8Array, fileName: string): Promise<WorkoutSummary> {
  const bytes = await fitBytes(input, fileName);
  const stream = Stream.fromByteArray(bytes);
  if (!Decoder.isFIT(stream)) throw new WorkoutFileError("That doesn't look like a workout file. Please upload the .FIT file from your device or app.");
  const decoder = new Decoder(stream);
  const { messages, errors } = decoder.read({ convertTypesToStrings: true, convertDateTimesToDates: true, mergeHeartRates: false });
  const session = messages.sessionMesgs?.[0];
  if (!session) {
    throw new WorkoutFileError(
      errors.length ? "That file looks damaged or incomplete. Try exporting it again." : "That file doesn't contain a finished workout."
    );
  }

  const { sport, label } = classify(session.sport as string | undefined, session.subSport as string | undefined);
  const start = session.startTime instanceof Date ? session.startTime : messages.activityMesgs?.[0]?.timestamp;
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) throw new WorkoutFileError("That file has no start time, so it can't be placed in your week.");
  const duration = num(session.totalTimerTime) ?? num(session.totalElapsedTime);
  if (!duration) throw new WorkoutFileError("That file doesn't record how long the workout lasted.");

  const fileId = messages.fileIdMesgs?.[0];
  const maker = typeof fileId?.manufacturer === "string" ? words(fileId.manufacturer) : null;
  const product = typeof fileId?.productName === "string" ? fileId.productName : typeof fileId?.garminProduct === "string" ? words(fileId.garminProduct) : null;
  const device = [maker, product].filter(Boolean).join(" ") || null;

  const laps: WorkoutLap[] = (messages.lapMesgs ?? []).slice(0, MAX_LAPS).map((l, i) => ({
    n: i + 1,
    seconds: Math.round(num(l.totalTimerTime) ?? num(l.totalElapsedTime) ?? 0),
    distanceM: round(num(l.totalDistance)),
    avgHr: round(num(l.avgHeartRate)),
    avgPower: round(num(l.avgPower)),
    avgCadence: round(num(l.avgCadence)),
  }));

  return {
    sport,
    sportLabel: label,
    startedAt: start.toISOString(),
    durationSeconds: Math.round(duration),
    distanceM: round(num(session.totalDistance)),
    avgHr: round(num(session.avgHeartRate)),
    maxHr: round(num(session.maxHeartRate)),
    avgPower: round(num(session.avgPower)),
    maxPower: round(num(session.maxPower)),
    avgCadence: round(num(session.avgCadence)),
    calories: round(num(session.totalCalories)),
    device,
    laps: laps.length > 1 ? laps : [],
  };
}

/** The calendar day in London, which is the day the client thinks of it as. */
export function londonDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
